const PDFDocument = require("pdfkit");
const dayjs = require("dayjs");

const currencyFormatter = (currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  });

const formatMoney = (amount, currency) => currencyFormatter(currency).format(amount || 0);

const renderLineItemHeader = (doc, startX, startY) => {
  doc
    .fontSize(10)
    .text("Description", startX, startY)
    .text("Qty", startX + 260, startY, { width: 40, align: "right" })
    .text("Unit", startX + 320, startY, { width: 70, align: "right" })
    .text("Line Total", startX + 400, startY, { width: 80, align: "right" })
    .text("Credits", startX + 490, startY, { width: 60, align: "right" });

  doc
    .moveTo(startX, startY + 14)
    .lineTo(startX + 540, startY + 14)
    .stroke();
};

const renderLineItemRow = (doc, item, currency, startX, startY) => {
  doc
    .fontSize(10)
    .text(item.description || "-", startX, startY, { width: 250 })
    .text(item.quantity || 0, startX + 260, startY, { width: 40, align: "right" })
    .text(formatMoney(item.unitPrice || 0, currency), startX + 320, startY, {
      width: 70,
      align: "right",
    })
    .text(formatMoney(item.lineTotal || 0, currency), startX + 400, startY, {
      width: 80,
      align: "right",
    })
    .text(item.sessionCreditsTotal || 0, startX + 490, startY, {
      width: 60,
      align: "right",
    });
};

const buildInvoicePdf = ({ invoice, trainer, billTo }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const currency = invoice.currency || "USD";

    doc
      .fontSize(20)
      .text("Invoice", { align: "left" })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .text(`Invoice #: ${invoice.invoiceNumber}`, { align: "left" })
      .text(`Status: ${invoice.status}`, { align: "left" })
      .text(`Issued: ${dayjs(invoice.issuedAt).format("MMM D, YYYY")}`, { align: "left" })
      .text(
        `Due: ${invoice.dueAt ? dayjs(invoice.dueAt).format("MMM D, YYYY") : "—"}`,
        { align: "left" }
      )
      .moveDown(0.8);

    doc
      .fontSize(12)
      .text("From", { continued: true })
      .fontSize(10)
      .text(`  ${trainer?.firstName || ""} ${trainer?.lastName || ""}`)
      .text(trainer?.email || "")
      .moveDown(0.5);

    doc
      .fontSize(12)
      .text("Bill To", { continued: true })
      .fontSize(10)
      .text(`  ${billTo?.name || invoice.billToName || ""}`)
      .text(billTo?.email || invoice.billToEmail || "")
      .moveDown(0.8);

    const tableStartY = doc.y + 10;
    renderLineItemHeader(doc, 40, tableStartY);

    let rowY = tableStartY + 22;
    (invoice.lineItems || []).forEach((item) => {
      renderLineItemRow(doc, item, currency, 40, rowY);
      rowY += 18;
      if (rowY > 680) {
        doc.addPage();
        rowY = 60;
        renderLineItemHeader(doc, 40, rowY);
        rowY += 22;
      }
    });

    doc
      .moveDown(1.2)
      .fontSize(10)
      .text(`Subtotal: ${formatMoney(invoice.subtotal, currency)}`, 360, rowY + 10, {
        align: "right",
      })
      .text(`Tax: ${formatMoney(invoice.tax, currency)}`, 360, rowY + 26, {
        align: "right",
      })
      .text(`Discount: ${formatMoney(invoice.discount, currency)}`, 360, rowY + 42, {
        align: "right",
      })
      .text(`Total: ${formatMoney(invoice.total, currency)}`, 360, rowY + 58, {
        align: "right",
      })
      .text(`Paid: ${formatMoney(invoice.amountPaid, currency)}`, 360, rowY + 74, {
        align: "right",
      })
      .text(`Balance: ${formatMoney(invoice.balanceDue, currency)}`, 360, rowY + 90, {
        align: "right",
      });

    if (invoice.notes) {
      doc.moveDown(2).fontSize(10).text(`Notes: ${invoice.notes}`);
    }

    if (invoice.terms) {
      doc.moveDown(0.5).fontSize(10).text(`Terms: ${invoice.terms}`);
    }

    doc.end();
  });

module.exports = {
  buildInvoicePdf,
};
