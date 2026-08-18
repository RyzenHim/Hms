const mongoose = require("mongoose");

const stampConfigurationSchema = new mongoose.Schema(
  {
    // A patient owns one stamp configuration document. Keeping the full stamp
    // array here avoids duplicating large SVG/data-URL images in the report
    // snapshot while still preserving every placement and designer setting.
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      unique: true,
      index: true,
    },
    stamps: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StampConfiguration", stampConfigurationSchema);
