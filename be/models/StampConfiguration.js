const mongoose = require("mongoose");

const stampPlacementSchema = new mongoose.Schema(
  {
    stampId: { type: String, required: true },
    documentType: {
      type: String,
      enum: ["diagnostic", "discharge", "fitness", "opd"],
      required: true,
    },
    page: { type: Number, required: true, min: 1 },
    size: { type: Number, required: true },
    opacity: { type: Number, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    rotation: { type: Number, required: true },
    filter: {
      type: String,
      enum: ["none", "grayscale", "sepia", "brightness"],
      required: true,
    },
  },
  { _id: false },
);

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
    // Queryable, validated placement records. Stamp artwork/designer settings
    // remain in `stamps`; each page usage owns one independent record here.
    placements: {
      type: [stampPlacementSchema],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StampConfiguration", stampConfigurationSchema);
