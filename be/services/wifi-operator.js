const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { cloudinary, isCloudinaryConfigured } = require("../config/cloudinary");

const operator = Object.freeze({
  id: "airtel",
  name: "Airtel",
  legalName: "Bharti Hexacom Limited",
});

const assetDirectory = path.join(__dirname, "../assets/wifi");

const isSecureCloudinaryUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
};

const serviceError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

// Only these bundled assets, extracted from the reference bill, can be uploaded.
// The source bill and its customer/payment information never leave the project.
const createWifiOperatorService = ({
  logoPath = path.join(assetDirectory, "airtel-logo.png"),
  paymentLogoPath = path.join(assetDirectory, "airtel-payments-bank-logo.png"),
  signaturePath = path.join(assetDirectory, "airtel-signature.png"),
  manifestPath = path.join(assetDirectory, "operator-logo.json"),
  upload = (filePath, options) => cloudinary.uploader.upload(filePath, options),
  isConfigured = isCloudinaryConfigured,
} = {}) => {
  let pendingUpload;

  const definitions = {
    logo: {
      filePath: logoPath,
      urlKey: "logoUrl",
      publicIdKey: "logoPublicId",
      hashKey: "sourceSha256",
      widthKey: "width",
      heightKey: "height",
      publicIdForHash: (hash) =>
        `hms/wifi/operators/airtel/reference-logo-${hash.slice(0, 16)}`,
    },
    paymentLogo: {
      filePath: paymentLogoPath,
      urlKey: "paymentLogoUrl",
      publicIdKey: "paymentLogoPublicId",
      hashKey: "paymentSourceSha256",
      widthKey: "paymentWidth",
      heightKey: "paymentHeight",
      publicIdForHash: (hash) =>
        `hms/wifi/operators/airtel/reference-payments-bank-logo-${hash.slice(0, 16)}`,
    },
    signature: {
      filePath: signaturePath,
      urlKey: "signatureUrl",
      publicIdKey: "signaturePublicId",
      hashKey: "signatureSourceSha256",
      widthKey: "signatureWidth",
      heightKey: "signatureHeight",
      publicIdForHash: (hash) =>
        `hms/wifi/operators/airtel/reference-signature-${hash.slice(0, 16)}`,
    },
  };

  const sourceHash = async (filePath) =>
    crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");

  const sourceHashes = async () => {
    const [logo, paymentLogo, signature] = await Promise.all([
      sourceHash(definitions.logo.filePath),
      sourceHash(definitions.paymentLogo.filePath),
      sourceHash(definitions.signature.filePath),
    ]);
    return { logo, paymentLogo, signature };
  };

  const readManifest = async () => {
    try {
      return JSON.parse(await fs.readFile(manifestPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) return {};
      throw error;
    }
  };

  const readAsset = (saved, definition, hash) => {
    const publicId = definition.publicIdForHash(hash);
    if (
      !saved ||
      typeof saved !== "object" ||
      saved[definition.hashKey] !== hash ||
      saved[definition.publicIdKey] !== publicId ||
      !isSecureCloudinaryUrl(saved[definition.urlKey])
    ) {
      return null;
    }
    return {
      url: saved[definition.urlKey],
      publicId,
      sourceSha256: hash,
      width: saved[definition.widthKey],
      height: saved[definition.heightKey],
    };
  };

  const readAssets = async (hashes) => {
    const saved = await readManifest();
    return {
      logo: readAsset(saved, definitions.logo, hashes.logo),
      paymentLogo: readAsset(saved, definitions.paymentLogo, hashes.paymentLogo),
      signature: readAsset(saved, definitions.signature, hashes.signature),
    };
  };

  const response = (assets) => ({
    ...operator,
    logoUrl: assets.logo?.url ?? null,
    logoPublicId: assets.logo?.publicId ?? null,
    paymentLogoUrl: assets.paymentLogo?.url ?? null,
    paymentLogoPublicId: assets.paymentLogo?.publicId ?? null,
    signatureUrl: assets.signature?.url ?? null,
    signaturePublicId: assets.signature?.publicId ?? null,
    logoConfigured: isConfigured(),
  });

  const manifestFor = (assets) => ({
    ...operator,
    ...(assets.logo && {
      logoUrl: assets.logo.url,
      logoPublicId: assets.logo.publicId,
      sourceSha256: assets.logo.sourceSha256,
      width: assets.logo.width,
      height: assets.logo.height,
    }),
    ...(assets.paymentLogo && {
      paymentLogoUrl: assets.paymentLogo.url,
      paymentLogoPublicId: assets.paymentLogo.publicId,
      paymentSourceSha256: assets.paymentLogo.sourceSha256,
      paymentWidth: assets.paymentLogo.width,
      paymentHeight: assets.paymentLogo.height,
    }),
    ...(assets.signature && {
      signatureUrl: assets.signature.url,
      signaturePublicId: assets.signature.publicId,
      signatureSourceSha256: assets.signature.sourceSha256,
      signatureWidth: assets.signature.width,
      signatureHeight: assets.signature.height,
    }),
  });

  const persistAssets = async (assets) => {
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    const temporaryPath = `${manifestPath}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(
        temporaryPath,
        `${JSON.stringify(manifestFor(assets), null, 2)}\n`,
        "utf8",
      );
      await fs.rename(temporaryPath, manifestPath);
    } finally {
      await fs.unlink(temporaryPath).catch(() => {});
    }
  };

  const uploadAsset = async (definition, hash) => {
    const publicId = definition.publicIdForHash(hash);
    let uploaded;
    try {
      uploaded = await upload(definition.filePath, {
        resource_type: "image",
        public_id: publicId,
        unique_filename: false,
        overwrite: false,
      });
    } catch {
      throw serviceError("Unable to store the operator logo. Please try again.", 502);
    }
    if (
      !isSecureCloudinaryUrl(uploaded?.secure_url) ||
      uploaded.public_id !== publicId
    ) {
      throw serviceError("The operator logo upload returned an invalid asset.", 502);
    }
    return {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      sourceSha256: hash,
      width: uploaded.width,
      height: uploaded.height,
    };
  };

  const getOperator = async () => {
    const hashes = await sourceHashes();
    return response(await readAssets(hashes));
  };

  const ensureLogo = async () => {
    // Concurrent requests share one operation; a rejected upload remains retryable.
    if (pendingUpload) return pendingUpload;
    pendingUpload = (async () => {
      const hashes = await sourceHashes();
      const assets = await readAssets(hashes);
      if (assets.logo && assets.paymentLogo && assets.signature) return response(assets);
      if (!isConfigured()) {
        throw serviceError("Cloudinary is not configured for the operator logo.", 503);
      }

      // Persist after each valid upload. If the second upload fails, the first is
      // still reusable and will not be uploaded again on the next request.
      for (const key of ["logo", "paymentLogo", "signature"]) {
        if (assets[key]) continue;
        assets[key] = await uploadAsset(definitions[key], hashes[key]);
        await persistAssets(assets);
      }
      return response(assets);
    })();
    try {
      return await pendingUpload;
    } finally {
      pendingUpload = undefined;
    }
  };

  return { getOperator, ensureLogo };
};

module.exports = { createWifiOperatorService };
