require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const Patient = require("./models/Patient");
const StampConfiguration = require("./models/StampConfiguration");
const app = express();
const port = process.env.PORT || 8080;
const db = process.env.DB;

app.use(express.json({ limit: "15mb" }));

// The frontend runs on a separate local port during development.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND_ORIGIN || "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const imageFieldNames = new Set(["image", "logoImage", "watermarkImage"]);
const hospitalFieldNames = [
  "hospitalName",
  "hospitalSub",
  "hospitalAddress",
  "hospitalEmail",
  "hospitalPhone",
  "hospitalWebsite",
  "hospitalEmergency",
  "cin",
  "hospitalTagline",
  "dischargeFooterNote",
  "dischargeFooterBrand",
  "fitnessFooterText",
  "radiologyStampLabel",
  "radiologyStampSubtext",
];

const stripImageFields = (value) => {
  if (Array.isArray(value)) return value.map(stripImageFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !imageFieldNames.has(key))
        .map(([key, entry]) => [key, stripImageFields(entry)]),
    );
  }
  return value;
};

const getHospitalDetails = (patientDetails) =>
  Object.fromEntries(
    hospitalFieldNames.map((field) => [field, patientDetails[field] ?? ""]),
  );

const getPatientDetailsFromRequest = (req) => {
  const requestedPatientDetails =
    req.body?.patientDetails && typeof req.body.patientDetails === "object"
      ? req.body.patientDetails
      : {};
  const { dischargeSummaryStamps: embeddedStamps, ...reportDetails } = requestedPatientDetails;
  const requestedStampConfiguration = req.body?.stampConfiguration;
  const stamps = Array.isArray(requestedStampConfiguration?.stamps)
    ? requestedStampConfiguration.stamps
    : Array.isArray(embeddedStamps)
      ? embeddedStamps
      : null;
  const patientDetails = stripImageFields(reportDetails);
  const uhid = typeof patientDetails?.uhid === "string" ? patientDetails.uhid.trim() : "";
  return { patientDetails, stamps, uhid };
};

const getPrimaryConsultant = (patientDetails) =>
  typeof patientDetails?.primaryConsultant === "string"
    ? patientDetails.primaryConsultant
    : "";

const savePatientStampConfiguration = async (patientId, stamps) => {
  // A missing stamp payload means an older client is saving the patient; do
  // not erase an already-persisted configuration in that case.
  if (stamps === null) return null;

  const stampConfiguration = await StampConfiguration.findOneAndUpdate(
    { patient: patientId },
    { $set: { stamps } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  await Patient.findByIdAndUpdate(patientId, {
    $set: { stampConfiguration: stampConfiguration._id },
  });

  return stampConfiguration._id;
};

mongoose
  .connect(db)
  .then(() => console.log("Db connected"))
  .catch((error) => console.log("Error in connecting to db:-", error));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/patients", async (_req, res) => {
  try {
    const patients = await Patient.find({}, "patientName uhid hospitalDetails updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ patients });
  } catch (error) {
    console.error("Error loading patients:", error);
    res.status(500).json({ message: "Unable to load patients." });
  }
});

app.get("/api/patients/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate("stampConfiguration")
      .lean();
    if (!patient) return res.status(404).json({ message: "Patient not found." });

    const stampConfiguration = patient.stampConfiguration;
    const storedStamps = stampConfiguration
      ? stampConfiguration.stamps
      : patient.patientDetails?.dischargeSummaryStamps;

    res.json({
      patient: {
        ...patient,
        stampConfiguration: stampConfiguration?._id ?? null,
        patientDetails: {
          ...patient.patientDetails,
          dischargeSummaryStamps: Array.isArray(storedStamps) ? storedStamps : [],
        },
      },
    });
  } catch (error) {
    console.error("Error loading patient:", error);
    res.status(400).json({ message: "Invalid patient identifier." });
  }
});

app.post("/api/patients", async (req, res) => {
  try {
    const { patientDetails, stamps, uhid } = getPatientDetailsFromRequest(req);

    if (!uhid) {
      return res.status(400).json({ message: "UHID is required to save patient details." });
    }

    const patient = await Patient.findOneAndUpdate(
      { uhid },
      {
        $set: {
          patientName: typeof patientDetails.patientName === "string" ? patientDetails.patientName.trim() : "",
          primaryConsultant: getPrimaryConsultant(patientDetails),
          patientDetails,
          hospitalDetails: getHospitalDetails(patientDetails),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    const stampConfigurationId = await savePatientStampConfiguration(patient._id, stamps);

    res.status(200).json({
      message: "Patient details saved successfully.",
      patient: {
        id: patient._id,
        uhid: patient.uhid,
        patientName: patient.patientName,
        stampConfiguration: stampConfigurationId ?? patient.stampConfiguration,
        updatedAt: patient.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error saving patient details:", error);
    res.status(500).json({ message: "Unable to save patient details." });
  }
});

app.put("/api/patients/:id", async (req, res) => {
  try {
    const { patientDetails, stamps, uhid } = getPatientDetailsFromRequest(req);
    if (!uhid) {
      return res.status(400).json({ message: "UHID is required to save patient details." });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          uhid,
          patientName: typeof patientDetails.patientName === "string" ? patientDetails.patientName.trim() : "",
          primaryConsultant: getPrimaryConsultant(patientDetails),
          patientDetails,
          hospitalDetails: getHospitalDetails(patientDetails),
        },
      },
      { new: true, runValidators: true },
    );
    if (!patient) return res.status(404).json({ message: "Patient not found." });
    const stampConfigurationId = await savePatientStampConfiguration(patient._id, stamps);

    res.json({
      message: "Patient details updated successfully.",
      patient: {
        ...patient.toObject(),
        stampConfiguration: stampConfigurationId ?? patient.stampConfiguration,
      },
    });
  } catch (error) {
    console.error("Error updating patient details:", error);
    res.status(500).json({ message: "Unable to update patient details." });
  }
});

app.delete("/api/patients/:id", async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) return res.status(404).json({ message: "Patient not found." });
    await StampConfiguration.deleteOne({ patient: patient._id });
    res.json({ message: "Patient deleted successfully." });
  } catch (error) {
    console.error("Error deleting patient:", error);
    res.status(400).json({ message: "Invalid patient identifier." });
  }
});

app.listen(port, () => console.log("The server is running on port:- ", port));
