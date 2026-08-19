require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const express = require("express");
const { cloudinary, isCloudinaryConfigured } = require("./config/cloudinary");
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
  const patientDetails = reportDetails;
  const uhid = typeof patientDetails?.uhid === "string" ? patientDetails.uhid.trim() : "";
  return { patientDetails, stamps, uhid };
};

const getPrimaryConsultant = (patientDetails) =>
  typeof patientDetails?.primaryConsultant === "string"
    ? patientDetails.primaryConsultant
    : "";

const cloudinaryPublicIdFromUrl = (imageUrl) => {
  try {
    const url = new URL(imageUrl);
    if (!url.hostname.endsWith("cloudinary.com")) return "";
    const fileName = decodeURIComponent(url.pathname.split("/").pop() || "");
    return fileName.replace(/\.[^.]+$/, "");
  } catch {
    return "";
  }
};

const clearStoredImageReferences = (value, imageUrl, publicId) => {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      clearStoredImageReferences(entry, imageUrl, publicId),
    );
  }
  if (!value || typeof value !== "object") return value;

  const imageFields = new Set(["image", "logoImage", "watermarkImage"]);
  const entries = Object.entries(value);

  return Object.fromEntries(
    entries.map(([key, entry]) => {
      if (imageFields.has(key)) {
        const pairedPublicId = value[`${key}PublicId`];
        if (
          (imageUrl && entry === imageUrl) ||
          (publicId && pairedPublicId === publicId)
        ) {
          return [key, ""];
        }
      }
      if (key.endsWith("PublicId")) {
        const pairedImage = value[key.slice(0, -"PublicId".length)];
        if (
          (publicId && entry === publicId) ||
          (imageUrl && pairedImage === imageUrl)
        ) {
          return [key, ""];
        }
      }
      return [
        key,
        clearStoredImageReferences(entry, imageUrl, publicId),
      ];
    }),
  );
};

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

app.post("/api/uploads/images", async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ message: "Cloudinary is not configured." });
    }

    const requestedDataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    const dataUrlMatch = requestedDataUrl.match(
      /^data:(image\/[a-zA-Z0-9.+-]+)(;base64|;utf8)?,([\s\S]*)$/,
    );
    if (!dataUrlMatch) {
      return res.status(400).json({ message: "A valid image file is required." });
    }
    const dataUrl = dataUrlMatch[2] === ";base64"
      ? requestedDataUrl
      : `data:${dataUrlMatch[1]};base64,${Buffer.from(
          decodeURIComponent(dataUrlMatch[3]),
          "utf8",
        ).toString("base64")}`;

    const assetType = String(req.body?.assetType || "document-image")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .slice(0, 60);
    const contentHash = crypto.createHash("sha256").update(dataUrl).digest("hex").slice(0, 24);
    const publicId = `hms_${assetType}_${contentHash}`;

    const upload = await cloudinary.uploader.upload(dataUrl, {
      resource_type: "image",
      asset_folder: `hms/${assetType}`,
      public_id: publicId,
      unique_filename: false,
      overwrite: false,
    });

    res.json({
      url: upload.secure_url,
      publicId: upload.public_id,
      width: upload.width,
      height: upload.height,
      existing: Boolean(upload.existing),
    });
  } catch (error) {
    console.error("Cloudinary image upload failed:", error);
    res.status(500).json({ message: error?.message || "Unable to upload image." });
  }
});

app.delete("/api/uploads/images", async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ message: "Cloudinary is not configured." });
    }

    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl : "";
    const requestedPublicId =
      typeof req.body?.publicId === "string" ? req.body.publicId : "";
    const publicId = requestedPublicId || cloudinaryPublicIdFromUrl(imageUrl);
    if (publicId && !/^hms_[a-z0-9_-]+$/.test(publicId)) {
      return res.status(400).json({ message: "This image cannot be deleted by HMS." });
    }
    if (!imageUrl && !publicId) {
      return res.status(400).json({ message: "An image reference is required." });
    }

    let cloudinaryResult = "not_applicable";
    if (publicId) {
      const deletion = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      });
      cloudinaryResult = deletion.result;
    }

    const patientId = typeof req.body?.patientId === "string" ? req.body.patientId : "";
    if (patientId && mongoose.isValidObjectId(patientId)) {
      const patient = await Patient.findById(patientId);
      if (patient) {
        patient.patientDetails = clearStoredImageReferences(
          patient.patientDetails,
          imageUrl,
          publicId,
        );
        patient.markModified("patientDetails");
        await patient.save();
      }

      const stampConfiguration = await StampConfiguration.findOne({
        patient: patientId,
      });
      if (stampConfiguration) {
        stampConfiguration.stamps = clearStoredImageReferences(
          stampConfiguration.stamps,
          imageUrl,
          publicId,
        );
        stampConfiguration.markModified("stamps");
        await stampConfiguration.save();
      }
    }

    res.json({ message: "Image deleted successfully.", cloudinaryResult });
  } catch (error) {
    console.error("Cloudinary image deletion failed:", error);
    res.status(500).json({ message: error?.message || "Unable to delete image." });
  }
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
