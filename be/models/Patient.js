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
    // Keeps every non-image field from the report form without discarding
    // document-specific settings as the form evolves.
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
  },
  { timestamps: true },
);

module.exports = mongoose.model("Patient", patientSchema);
