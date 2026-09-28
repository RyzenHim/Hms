const mongoose = require("mongoose");
const { createWifiBillDataSchema } = require("../services/wifi-bill-data");

const wifiBillSchema = new mongoose.Schema({
  clientDraftId: {
    type: String,
    immutable: true,
    match: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    unique: true,
    sparse: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WifiCustomer",
    required: true,
    index: true,
  },
  // An independent snapshot: editing a customer never rewrites previous bills.
  data: { type: createWifiBillDataSchema(), required: true },
  version: { type: Number, default: 0 },
}, {
  timestamps: true,
  versionKey: "version",
  optimisticConcurrency: true,
  strict: "throw",
  bufferCommands: false,
});
wifiBillSchema.index({ customer: 1, updatedAt: -1 });

module.exports = mongoose.model("WifiBill", wifiBillSchema);
