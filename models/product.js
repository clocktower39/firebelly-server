const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    itemType: {
      type: String,
      enum: ["SESSION", "PROGRAM", "NUTRITION", "MERCH", "CUSTOM"],
      default: "CUSTOM",
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["USD", "EUR", "JPY"], default: "USD" },
    taxable: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    sessionTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionType", default: null },
    creditsPerUnit: { type: Number, default: 0, min: 0 },
    deliverableType: {
      type: String,
      enum: ["NONE", "FILE", "LINK", "MESSAGE"],
      default: "NONE",
    },
    deliverableValue: { type: String, default: "" },
  },
  { timestamps: true }
);

productSchema.index({ trainerId: 1, name: 1 }, { unique: true });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
