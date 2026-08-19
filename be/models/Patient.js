const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    // UHID is the stable identifier used to create or update a patient record.
    uhid: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    patientName: {
      type: String,
      trim: true,
      default: "",
    },
    // Keep this discharge-summary field at the document level too. Besides the
    // complete `patientDetails` snapshot below, this makes the consultant
    // value explicitly persisted and easy to query independently.
    primaryConsultant: {
      type: String,
      default: "",
    },
    // Keeps the complete report form, including document-specific layout,
    // color, logo and watermark settings as the form evolves.
    patientDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Kept separately as well so each patient record retains the hospital
    // context used when their documents were created.
    hospitalDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // The full configuration lives in its own collection so stamp images and
    // editable designer data are restored without bloating patientDetails.
    stampConfiguration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StampConfiguration",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Patient", patientSchema);
