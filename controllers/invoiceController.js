const mongoose = require("mongoose");
const dayjs = require("dayjs");
const Invoice = require("../models/invoice");
const BillingLedgerEntry = require("../models/billingLedgerEntry");
const Relationship = require("../models/relationship");
const GroupMembership = require("../models/groupMembership");
const Group = require("../models/group");
const User = require("../models/user");
const Product = require("../models/product");
const SessionType = require("../models/sessionType");
const { sendEmail } = require("../services/emailService");
const { buildInvoicePdf } = require("../services/invoicePdf");

const ACTIVE_STATUS = "ACTIVE";
const TRAINER_ROLES = new Set(["TRAINER", "COACH", "ADMIN"]);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const ensureRelationship = async (trainerId, clientId) => {
  if (!trainerId || !clientId) return null;
  return Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
};

const ensureGroupAccess = async (groupId, userId) => {
  if (!groupId || !userId) return null;
  return GroupMembership.findOne({ groupId, userId, status: ACTIVE_STATUS });
};

const ensureGroupWrite = async (groupId, userId) => {
  if (!groupId || !userId) return null;
  const membership = await GroupMembership.findOne({ groupId, userId, status: ACTIVE_STATUS });
  if (!membership) return null;
  if (!TRAINER_ROLES.has(membership.role)) return null;
  return membership;
};

const normalizeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const buildInvoiceNumber = () =>
  `INV-${dayjs().format("YYYYMMDD")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const LINE_ITEM_TYPES = new Set(["SESSION", "PROGRAM", "NUTRITION", "MERCH", "CUSTOM"]);

const normalizeLineItems = (lineItems = []) =>
  lineItems.map((item) => {
    const quantity = Math.max(1, normalizeNumber(item.quantity, 1));
    const unitPrice = Math.max(0, normalizeNumber(item.unitPrice, 0));
    const itemType = LINE_ITEM_TYPES.has(item.itemType) ? item.itemType : "CUSTOM";
    const rawSessionCredits = Math.max(0, normalizeNumber(item.sessionCredits, 0));
    const sessionCredits = itemType === "SESSION" ? rawSessionCredits : 0;
    const lineTotal = unitPrice * quantity;
    const sessionCreditsTotal = sessionCredits * quantity;
    return {
      productId: item.productId || null,
      itemType,
      sessionTypeId: itemType === "SESSION" ? item.sessionTypeId || null : null,
      description: String(item.description || "").trim() || "Line item",
      quantity,
      unitPrice,
      sessionCredits,
      taxable: item.taxable !== false,
      lineTotal,
      sessionCreditsTotal,
    };
  });

const resolveLineItems = async (lineItems = [], trainerId) => {
  const sessionTypeCache = new Map();
  const resolved = [];

  for (const rawItem of lineItems) {
    let item = { ...rawItem };

    if (item.productId) {
      const product = await Product.findById(item.productId).lean();
      if (product && String(product.trainerId) === String(trainerId)) {
        item = {
          ...item,
          itemType: product.itemType,
          description: product.name,
          unitPrice: product.price,
          taxable: product.taxable,
          sessionTypeId: product.sessionTypeId || null,
          sessionCredits:
            product.itemType === "SESSION" ? Number(product.creditsPerUnit) || 0 : 0,
        };
      }
    }

    if (item.itemType === "SESSION") {
      const sessionTypeId = item.sessionTypeId || null;
      if (sessionTypeId) {
        const cacheKey = String(sessionTypeId);
        if (!sessionTypeCache.has(cacheKey)) {
          const sessionType = await SessionType.findOne({
            _id: sessionTypeId,
            trainerId,
          }).lean();
          const credits = Number(sessionType?.creditsRequired);
          sessionTypeCache.set(
            cacheKey,
            Number.isFinite(credits) && credits > 0 ? credits : null
          );
        }
        const resolvedCredits = sessionTypeCache.get(cacheKey);
        if (!resolvedCredits) {
          item.sessionTypeId = null;
          item.sessionCredits = 0;
        } else if (!item.sessionCredits || Number(item.sessionCredits) <= 0) {
          item.sessionCredits = resolvedCredits;
        }
      }
    } else {
      item.sessionCredits = 0;
      item.sessionTypeId = null;
    }

    resolved.push(item);
  }

  return normalizeLineItems(resolved);
};

const normalizePayments = (payments = []) =>
  payments
    .map((payment) => {
      const amount = Math.max(0, normalizeNumber(payment.amount, 0));
      if (!amount) return null;
      return {
        amount,
        currency: payment.currency || "USD",
        paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
        method: String(payment.method || "").trim(),
        notes: String(payment.notes || "").trim(),
      };
    })
    .filter(Boolean);

const calculateTotals = ({ lineItems, tax, discount }) => {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const sessionCreditsTotal = lineItems.reduce(
    (sum, item) => sum + (item.sessionCreditsTotal || 0),
    0
  );
  const normalizedTax = Math.max(0, normalizeNumber(tax, 0));
  const normalizedDiscount = Math.max(0, normalizeNumber(discount, 0));
  const total = subtotal + normalizedTax - normalizedDiscount;
  return {
    subtotal,
    sessionCreditsTotal,
    tax: normalizedTax,
    discount: normalizedDiscount,
    total: Number(total.toFixed(2)),
  };
};

const resolveBillTo = async ({ billToType, clientId, groupId }) => {
  let billToName = "";
  let billToEmail = "";
  if (billToType === "CLIENT" && clientId) {
    const client = await User.findById(clientId).lean();
    billToName = client ? `${client.firstName} ${client.lastName}` : "";
    billToEmail = client?.email || "";
  }
  if (billToType === "GROUP" && groupId) {
    const group = await Group.findById(groupId).lean();
    billToName = group?.name || "";
  }
  return { billToName, billToEmail };
};

const applyInvoiceCredits = async (invoice, userId) => {
  const creditEntries = [];
  const sessionTypeCache = new Map();

  const resolveCreditsPerUnit = async (item) => {
    const direct = Number(item.sessionCredits || 0);
    if (Number.isFinite(direct) && direct > 0) return direct;
    if (!item.sessionTypeId) return 0;
    const cacheKey = String(item.sessionTypeId);
    if (!sessionTypeCache.has(cacheKey)) {
      const type = await SessionType.findById(item.sessionTypeId).lean();
      const credits = Number(type?.creditsRequired || 0);
      sessionTypeCache.set(cacheKey, Number.isFinite(credits) ? credits : 0);
    }
    return sessionTypeCache.get(cacheKey) || 0;
  };

  for (const item of invoice.lineItems || []) {
    let totalCredits = Number(item.sessionCreditsTotal || 0);

    if (!totalCredits && item.itemType === "SESSION") {
      const creditsPerUnit = await resolveCreditsPerUnit(item);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      if (creditsPerUnit > 0) {
        totalCredits = creditsPerUnit * quantity;
      }
    }

    if (!totalCredits) continue;

    const exists = await BillingLedgerEntry.exists({
      sourceInvoiceId: invoice._id,
      sourceLineItemId: item._id,
      entryType: "CREDIT",
    });
    if (exists) continue;

    creditEntries.push({
      trainerId: invoice.trainerId,
      clientId: invoice.clientId || null,
      groupId: invoice.groupId || null,
      sessionTypeId: item.sessionTypeId || null,
      entryType: "CREDIT",
      delta: totalCredits,
      source: "INVOICE",
      sourceInvoiceId: invoice._id,
      sourceLineItemId: item._id,
      notes: `Invoice ${invoice.invoiceNumber}`,
      createdBy: userId,
    });
  }

  if (creditEntries.length) {
    await BillingLedgerEntry.insertMany(creditEntries);
    await Invoice.findByIdAndUpdate(invoice._id, { creditsAppliedAt: new Date() });
  }
};

const reverseInvoiceCredits = async (invoice, userId) => {
  const existingReversals = await BillingLedgerEntry.exists({
    sourceInvoiceId: invoice._id,
    source: "REVERSAL",
  });
  if (existingReversals) return;

  const credits = await BillingLedgerEntry.find({
    sourceInvoiceId: invoice._id,
    entryType: "CREDIT",
  }).lean();

  if (!credits.length) return;

  const reversals = credits.map((credit) => ({
    trainerId: invoice.trainerId,
    clientId: invoice.clientId || null,
    groupId: invoice.groupId || null,
    sessionTypeId: credit.sessionTypeId || null,
    entryType: "ADJUSTMENT",
    delta: -Number(credit.delta || 0),
    source: "REVERSAL",
    sourceInvoiceId: invoice._id,
    sourceLineItemId: credit.sourceLineItemId || null,
    notes: `Void invoice ${invoice.invoiceNumber}`,
    createdBy: userId,
  }));

  await BillingLedgerEntry.insertMany(reversals);
};

const removeInvoiceReversals = async (invoiceId) =>
  BillingLedgerEntry.deleteMany({ sourceInvoiceId: invoiceId, source: "REVERSAL" });

const create_invoice = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const {
      billToType,
      clientId,
      groupId,
      billToEmail,
      invoiceNumber,
      status,
      currency,
      issuedAt,
      dueAt,
      notes,
      terms,
      lineItems = [],
      tax,
      discount,
      payments = [],
    } = req.body;

    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can create invoices." });
    }

    if (!billToType || !["CLIENT", "GROUP"].includes(billToType)) {
      return res.status(400).json({ error: "billToType must be CLIENT or GROUP." });
    }

    if (billToType === "CLIENT" && !clientId) {
      return res.status(400).json({ error: "clientId is required for client invoices." });
    }

    if (billToType === "GROUP" && !groupId) {
      return res.status(400).json({ error: "groupId is required for group invoices." });
    }

    if (billToType === "CLIENT") {
      const relationship = await ensureRelationship(userId, clientId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    if (billToType === "GROUP") {
      const membership = await ensureGroupWrite(groupId, userId);
      if (!membership) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const normalizedLineItems = await resolveLineItems(lineItems, userId);
    const invalidSessionItem = normalizedLineItems.find(
      (item) => item.itemType === "SESSION" && (!item.sessionTypeId || item.sessionCredits <= 0)
    );
    if (invalidSessionItem) {
      return res.status(400).json({
        error: "Session line items must include a session type with credits.",
      });
    }
    const totals = calculateTotals({ lineItems: normalizedLineItems, tax, discount });
    const normalizedPayments = normalizePayments(payments);
    const amountPaid = normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const balanceDue = Math.max(totals.total - amountPaid, 0);

    let { billToName, billToEmail: resolvedBillToEmail } = await resolveBillTo({
      billToType,
      clientId,
      groupId,
    });
    if (billToType === "GROUP") {
      resolvedBillToEmail = String(billToEmail || "").trim();
    }

    const finalInvoiceNumber = String(invoiceNumber || "").trim() || buildInvoiceNumber();
    const resolvedStatus = status && ["DRAFT", "SENT", "PAID", "PAST_DUE", "VOID"].includes(status)
      ? status
      : "DRAFT";

    const invoice = new Invoice({
      trainerId: userId,
      clientId: billToType === "CLIENT" ? clientId : null,
      groupId: billToType === "GROUP" ? groupId : null,
      billToType,
      billToName,
      billToEmail:
        billToType === "CLIENT"
          ? resolvedBillToEmail
          : String(resolvedBillToEmail || "").trim(),
      invoiceNumber: finalInvoiceNumber,
      status: resolvedStatus,
      currency: currency || "USD",
      issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
      dueAt: dueAt ? new Date(dueAt) : null,
      notes: String(notes || "").trim(),
      terms: String(terms || "").trim(),
      lineItems: normalizedLineItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      amountPaid,
      balanceDue,
      payments: normalizedPayments,
      sessionCreditsTotal: totals.sessionCreditsTotal,
      createdBy: userId,
      updatedBy: userId,
    });

    if (invoice.status === "PAID") {
      if (!normalizedPayments.length && totals.total > 0) {
        invoice.payments = [
          {
            amount: totals.total,
            currency: invoice.currency,
            paidAt: new Date(),
            method: "manual",
            notes: "Marked paid at creation",
          },
        ];
        invoice.amountPaid = totals.total;
        invoice.balanceDue = 0;
      } else if (invoice.balanceDue <= 0) {
        invoice.balanceDue = 0;
      }
      invoice.paidAt = new Date();
    }

    if (invoice.status === "VOID") {
      invoice.voidedAt = new Date();
    }

    const saved = await invoice.save();

    if (saved.status === "PAID") {
      await applyInvoiceCredits(saved, userId);
    }

    return res.json({ invoice: saved });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Invoice number already exists." });
    }
    return next(err);
  }
};

const request_invoice = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const {
      trainerId,
      invoiceNumber,
      currency,
      issuedAt,
      dueAt,
      notes,
      terms,
      lineItems = [],
      tax,
      discount,
    } = req.body;

    if (!trainerId || !isValidObjectId(trainerId)) {
      return res.status(400).json({ error: "trainerId is required." });
    }

    if (isTrainer && String(trainerId) === String(userId)) {
      return res.status(400).json({ error: "Trainers should create invoices directly." });
    }

    const relationship = await ensureRelationship(trainerId, userId);
    if (!relationship) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const normalizedLineItems = await resolveLineItems(lineItems, trainerId);
    const invalidSessionItem = normalizedLineItems.find(
      (item) => item.itemType === "SESSION" && (!item.sessionTypeId || item.sessionCredits <= 0)
    );
    if (invalidSessionItem) {
      return res.status(400).json({
        error: "Session line items must include a session type with credits.",
      });
    }
    if (normalizedLineItems.length === 0) {
      return res.status(400).json({ error: "At least one line item is required." });
    }

    const totals = calculateTotals({ lineItems: normalizedLineItems, tax, discount });
    const finalInvoiceNumber = String(invoiceNumber || "").trim() || buildInvoiceNumber();

    const { billToName, billToEmail } = await resolveBillTo({
      billToType: "CLIENT",
      clientId: userId,
      groupId: null,
    });

    const invoice = new Invoice({
      trainerId,
      clientId: userId,
      groupId: null,
      billToType: "CLIENT",
      billToName,
      billToEmail,
      invoiceNumber: finalInvoiceNumber,
      status: "SENT",
      currency: currency || "USD",
      issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
      dueAt: dueAt ? new Date(dueAt) : null,
      notes: String(notes || "").trim(),
      terms: String(terms || "").trim(),
      lineItems: normalizedLineItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      amountPaid: 0,
      balanceDue: totals.total,
      payments: [],
      sessionCreditsTotal: totals.sessionCreditsTotal,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await invoice.save();

    let notificationStatus = "not_sent";
    try {
      const trainer = await User.findById(trainerId).lean();
      const client = await User.findById(userId).lean();
      if (trainer?.email) {
        const lines = normalizedLineItems
          .map((item) => `${item.quantity} × ${item.description}`)
          .join("\n");
        await sendEmail({
          from: trainer.email || process.env.EMAIL_USER,
          to: trainer.email,
          subject: `New invoice request from ${client?.firstName || "Client"}`,
          text:
            `You have a new invoice request from ${client?.firstName || ""} ${
              client?.lastName || ""
            }.\n\nItems:\n${lines}\n\nTotal: ${saved.currency} ${Number(
              saved.total || 0
            ).toFixed(2)}\nInvoice #: ${saved.invoiceNumber}`,
        });
        notificationStatus = "sent";
      }
    } catch (err) {
      notificationStatus = "failed";
    }

    return res.json({ invoice: saved, notificationStatus });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Invoice number already exists." });
    }
    return next(err);
  }
};

const list_invoices = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { trainerId, clientId, groupId, status, limit = 100 } = req.body;

    const query = {};
    if (status) query.status = status;

    if (isTrainer) {
      query.trainerId = trainerId || userId;
      if (String(query.trainerId) !== String(userId)) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else {
      if (clientId && String(clientId) === String(userId)) {
        query.clientId = clientId;
      } else if (groupId) {
        const membership = await ensureGroupAccess(groupId, userId);
        if (!membership) {
          return res.status(403).json({ error: "Unauthorized access." });
        }
        query.groupId = groupId;
      } else {
        query.clientId = userId;
      }
    }

    if (clientId && isTrainer) query.clientId = clientId;
    if (groupId && isTrainer) query.groupId = groupId;

    const invoices = await Invoice.find(query)
      .sort({ issuedAt: -1 })
      .limit(Math.min(Number(limit) || 100, 500))
      .lean();

    return res.json({ invoices });
  } catch (err) {
    return next(err);
  }
};

const get_invoice = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (isTrainer) {
      if (String(invoice.trainerId) !== String(userId)) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else if (invoice.clientId && String(invoice.clientId) === String(userId)) {
      // allowed
    } else if (invoice.groupId) {
      const membership = await ensureGroupAccess(invoice.groupId, userId);
      if (!membership) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    return res.json({ invoice });
  } catch (err) {
    return next(err);
  }
};

const update_invoice_status = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId, status, dueAt, notes, terms } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can update invoices." });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const updates = {};
    const wasVoided = invoice.status === "VOID";
    if (dueAt !== undefined) updates.dueAt = dueAt ? new Date(dueAt) : null;
    if (notes !== undefined) updates.notes = String(notes || "").trim();
    if (terms !== undefined) updates.terms = String(terms || "").trim();

    const nextStatus = status && ["DRAFT", "SENT", "PAID", "PAST_DUE", "VOID"].includes(status)
      ? status
      : null;

    if (nextStatus) updates.status = nextStatus;

    if (nextStatus === "PAID") {
      const remaining = Math.max(invoice.total - invoice.amountPaid, 0);
      if (remaining > 0) {
        invoice.payments.push({
          amount: remaining,
          currency: invoice.currency,
          paidAt: new Date(),
          method: "manual",
          notes: "Marked paid",
        });
        invoice.amountPaid += remaining;
        invoice.balanceDue = 0;
      }
      updates.paidAt = new Date();
    }

    if (nextStatus === "VOID") {
      updates.voidedAt = new Date();
    }
    if (nextStatus && nextStatus !== "VOID") {
      updates.voidedAt = null;
    }

    updates.updatedBy = userId;

    Object.assign(invoice, updates);
    const saved = await invoice.save();

    if (nextStatus === "PAID") {
      await removeInvoiceReversals(saved._id);
      await applyInvoiceCredits(saved, userId);
    } else if (wasVoided && nextStatus && nextStatus !== "VOID") {
      await removeInvoiceReversals(saved._id);
    }

    if (nextStatus === "VOID") {
      await reverseInvoiceCredits(saved, userId);
    }

    return res.json({ invoice: saved });
  } catch (err) {
    return next(err);
  }
};

const record_payment = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId, amount, method, paidAt, notes } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can record payments." });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    if (invoice.status === "VOID") {
      return res.status(400).json({ error: "Cannot record payments for a void invoice." });
    }

    const paymentAmount = Math.max(0, normalizeNumber(amount, 0));
    if (!paymentAmount) {
      return res.status(400).json({ error: "Payment amount must be greater than 0." });
    }

    invoice.payments.push({
      amount: paymentAmount,
      currency: invoice.currency,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      method: String(method || "").trim(),
      notes: String(notes || "").trim(),
    });

    invoice.amountPaid += paymentAmount;
    invoice.balanceDue = Math.max(invoice.total - invoice.amountPaid, 0);

    if (invoice.balanceDue <= 0) {
      invoice.status = "PAID";
      invoice.paidAt = new Date();
      await applyInvoiceCredits(invoice, userId);
    } else if (invoice.status === "DRAFT") {
      invoice.status = "SENT";
    }

    invoice.updatedBy = userId;
    const saved = await invoice.save();
    return res.json({ invoice: saved });
  } catch (err) {
    return next(err);
  }
};

const export_invoice_pdf = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (isTrainer) {
      if (String(invoice.trainerId) !== String(userId)) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else if (invoice.clientId && String(invoice.clientId) === String(userId)) {
      // allowed
    } else if (invoice.groupId) {
      const membership = await ensureGroupAccess(invoice.groupId, userId);
      if (!membership) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const [trainer, billTo] = await Promise.all([
      User.findById(invoice.trainerId).lean(),
      invoice.billToType === "CLIENT" && invoice.clientId
        ? User.findById(invoice.clientId).lean()
        : invoice.groupId
        ? Group.findById(invoice.groupId).lean()
        : null,
    ]);

    const billToPayload =
      invoice.billToType === "CLIENT"
        ? {
            name: billTo ? `${billTo.firstName} ${billTo.lastName}` : invoice.billToName,
            email: billTo?.email || invoice.billToEmail,
          }
        : {
            name: billTo?.name || invoice.billToName,
            email: invoice.billToEmail,
          };

    const pdfBuffer = await buildInvoicePdf({
      invoice,
      trainer,
      billTo: billToPayload,
    });

    const safeNumber = String(invoice.invoiceNumber || "invoice").replace(/[^a-z0-9_-]/gi, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${safeNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return next(err);
  }
};

const email_invoice = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { invoiceId, recipientEmail, subject, message } = req.body;

    if (!invoiceId || !isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: "invoiceId is required." });
    }

    if (!isTrainer) {
      return res.status(403).json({ error: "Only trainers can email invoices." });
    }

    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    if (String(invoice.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const [trainer, billTo] = await Promise.all([
      User.findById(invoice.trainerId).lean(),
      invoice.billToType === "CLIENT" && invoice.clientId
        ? User.findById(invoice.clientId).lean()
        : invoice.groupId
        ? Group.findById(invoice.groupId).lean()
        : null,
    ]);

    const resolvedRecipient =
      String(recipientEmail || "").trim() ||
      (invoice.billToType === "CLIENT" ? billTo?.email : invoice.billToEmail);

    if (!resolvedRecipient) {
      return res.status(400).json({ error: "Recipient email is required." });
    }

    const billToPayload =
      invoice.billToType === "CLIENT"
        ? {
            name: billTo ? `${billTo.firstName} ${billTo.lastName}` : invoice.billToName,
            email: billTo?.email || invoice.billToEmail,
          }
        : {
            name: billTo?.name || invoice.billToName,
            email: invoice.billToEmail,
          };

    const pdfBuffer = await buildInvoicePdf({
      invoice,
      trainer,
      billTo: billToPayload,
    });

    const mailOptions = {
      from: trainer?.email || process.env.EMAIL_USER,
      to: resolvedRecipient,
      subject: subject || `Invoice ${invoice.invoiceNumber} from ${trainer?.firstName || ""}`,
      text:
        message ||
        `Hi ${billToPayload.name || ""},\n\nPlease find invoice ${invoice.invoiceNumber} attached.`,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    };

    await sendEmail(mailOptions);
    return res.json({ status: "sent" });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_invoice,
  request_invoice,
  list_invoices,
  get_invoice,
  update_invoice_status,
  record_payment,
  export_invoice_pdf,
  email_invoice,
};
