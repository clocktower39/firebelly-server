const mongoose = require("mongoose");

const billingLedgerEntrySchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    sessionTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SessionType",
      default: null,
      index: true,
    },
    entryType: {
      type: String,
      enum: ["CREDIT", "DEBIT", "ADJUSTMENT"],
      required: true,
    },
    delta: { type: Number, required: true },
    source: {
      type: String,
      enum: [
        "INVOICE",
        "APPOINTMENT",
        "CANCELLATION_CHARGED",
        "REVERSAL",
        "ADJUSTMENT",
      ],
      default: "ADJUSTMENT",
    },
    sourceInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
      index: true,
    },
    sourceLineItemId: { type: mongoose.Schema.Types.ObjectId, default: null },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ScheduleEvent",
      default: null,
      index: true,
    },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

billingLedgerEntrySchema.index({ trainerId: 1, clientId: 1, createdAt: -1 });
billingLedgerEntrySchema.index({ trainerId: 1, groupId: 1, createdAt: -1 });
billingLedgerEntrySchema.index({ trainerId: 1, clientId: 1, sessionTypeId: 1, createdAt: -1 });

const BillingLedgerEntry = mongoose.model("BillingLedgerEntry", billingLedgerEntrySchema);
module.exports = BillingLedgerEntry;
