const mongoose = require("mongoose");
const { CUSTOMER_FIELD_MAP, WIFI_BILL_TEXT_LIMITS } = require("../services/wifi-bill-data");

const fields = Object.fromEntries(Object.entries(CUSTOMER_FIELD_MAP).map(([field, dataField]) => [
  field,
  {
    type: String,
    default: "",
    maxlength: WIFI_BILL_TEXT_LIMITS[dataField],
    ...(field === "name" ? { required: true, trim: true, index: true } : {}),
  },
]));

// Names can change and can be shared by different customers. The _id is identity.
const wifiCustomerSchema = new mongoose.Schema(fields, {
  timestamps: true,
  strict: "throw",
  bufferCommands: false,
});
wifiCustomerSchema.index({ updatedAt: -1 });
wifiCustomerSchema.virtual("bills", {
  ref: "WifiBill",
  localField: "_id",
  foreignField: "customer",
});

module.exports = mongoose.model("WifiCustomer", wifiCustomerSchema);
