const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createWifiOperatorService } = require("../services/wifi-operator");

const fixture = async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wifi-operator-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const logoPath = path.join(directory, "logo.png");
  const paymentLogoPath = path.join(directory, "payment-logo.png");
  const signaturePath = path.join(directory, "signature.png");
  const manifestPath = path.join(directory, "operator-logo.json");
  await Promise.all([
    fs.writeFile(logoPath, "reference operator logo"),
    fs.writeFile(paymentLogoPath, "reference payments bank logo"),
    fs.writeFile(signaturePath, "reference authorised signature"),
  ]);
  return { logoPath, paymentLogoPath, signaturePath, manifestPath };
};

const uploadResult = (options) => ({
  secure_url: `https://res.cloudinary.com/test/image/upload/v1/${options.public_id}.png`,
  public_id: options.public_id,
  width: 419,
  height: 113,
});

test("GET stays read-only; concurrent ensures upload all bundled artwork once and persist reusable cloud URLs", async (t) => {
  const files = await fixture(t);
  const uploads = [];
  const service = createWifiOperatorService({
    ...files,
    isConfigured: () => true,
    upload: async (file, options) => {
      uploads.push({ file, options });
      return uploadResult(options);
    },
  });
  assert.deepEqual(await service.getOperator(), {
    id: "airtel",
    name: "Airtel",
    legalName: "Bharti Hexacom Limited",
    logoUrl: null,
    logoPublicId: null,
    paymentLogoUrl: null,
    paymentLogoPublicId: null,
    signatureUrl: null,
    signaturePublicId: null,
    logoConfigured: true,
  });
  assert.equal(uploads.length, 0);

  const [first, second] = await Promise.all([service.ensureLogo(), service.ensureLogo()]);
  assert.deepEqual(first, second);
  assert.equal(uploads.length, 3);
  assert.deepEqual(uploads.map(({ file }) => file), [files.logoPath, files.paymentLogoPath, files.signaturePath]);
  assert.ok(uploads.every(({ options }) => options.overwrite === false));
  assert.match(first.logoUrl, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(first.paymentLogoUrl, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(first.signatureUrl, /^https:\/\/res\.cloudinary\.com\//);
  assert.match(first.logoPublicId, /\/reference-logo-[a-f0-9]{16}$/);
  assert.match(first.paymentLogoPublicId, /\/reference-payments-bank-logo-[a-f0-9]{16}$/);
  assert.match(first.signaturePublicId, /\/reference-signature-[a-f0-9]{16}$/);

  await service.ensureLogo();
  assert.equal(uploads.length, 3);

  const afterRestart = createWifiOperatorService({
    ...files,
    isConfigured: () => false,
    upload: () => assert.fail("Persisted logos should not be uploaded again"),
  });
  const reused = await afterRestart.ensureLogo();
  assert.equal(reused.logoUrl, first.logoUrl);
  assert.equal(reused.paymentLogoUrl, first.paymentLogoUrl);
  assert.equal(reused.signatureUrl, first.signatureUrl);

  const manifest = JSON.parse(await fs.readFile(files.manifestPath, "utf8"));
  assert.equal(manifest.sourceSha256.length, 64);
  assert.equal(manifest.paymentSourceSha256.length, 64);
  assert.equal(manifest.signatureSourceSha256.length, 64);
  assert.equal(manifest.logoUrl, first.logoUrl);
  assert.equal(manifest.paymentLogoUrl, first.paymentLogoUrl);
  assert.equal(manifest.signatureUrl, first.signatureUrl);
});

test("a payment-logo failure preserves the uploaded main logo and retries only the missing asset", async (t) => {
  const files = await fixture(t);
  const uploads = [];
  let paymentAttempts = 0;
  const service = createWifiOperatorService({
    ...files,
    isConfigured: () => true,
    upload: async (file, options) => {
      uploads.push(file);
      if (file === files.paymentLogoPath && ++paymentAttempts === 1) {
        throw new Error("private upstream details");
      }
      return uploadResult(options);
    },
  });

  await assert.rejects(service.ensureLogo(), {
    statusCode: 502,
    message: "Unable to store the operator logo. Please try again.",
  });
  const partial = await service.getOperator();
  assert.ok(partial.logoUrl);
  assert.equal(partial.paymentLogoUrl, null);

  const completed = await service.ensureLogo();
  assert.ok(completed.logoUrl);
  assert.ok(completed.paymentLogoUrl);
  assert.ok(completed.signatureUrl);
  assert.equal(uploads.filter((file) => file === files.logoPath).length, 1);
  assert.equal(uploads.filter((file) => file === files.paymentLogoPath).length, 2);
  assert.equal(uploads.filter((file) => file === files.signaturePath).length, 1);
});

test("a main-logo-only manifest is reused while only the missing payment logo uploads", async (t) => {
  const files = await fixture(t);
  const seed = createWifiOperatorService({
    ...files,
    isConfigured: () => true,
    upload: async (_file, options) => uploadResult(options),
  });
  const original = await seed.ensureLogo();
  const manifest = JSON.parse(await fs.readFile(files.manifestPath, "utf8"));
  delete manifest.paymentLogoUrl;
  delete manifest.paymentLogoPublicId;
  delete manifest.paymentSourceSha256;
  delete manifest.paymentWidth;
  delete manifest.paymentHeight;
  await fs.writeFile(files.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const uploads = [];
  const service = createWifiOperatorService({
    ...files,
    isConfigured: () => true,
    upload: async (file, options) => {
      uploads.push(file);
      return uploadResult(options);
    },
  });
  const beforeEnsure = await service.getOperator();
  assert.equal(beforeEnsure.logoUrl, original.logoUrl);
  assert.equal(beforeEnsure.paymentLogoUrl, null);

  const completed = await service.ensureLogo();
  assert.equal(completed.logoUrl, original.logoUrl);
  assert.ok(completed.paymentLogoUrl);
  assert.deepEqual(uploads, [files.paymentLogoPath]);
});

test("missing cloud credentials return an actionable error without uploading any asset", async (t) => {
  const files = await fixture(t);
  const service = createWifiOperatorService({
    ...files,
    isConfigured: () => false,
    upload: () => assert.fail("Unconfigured Cloudinary should not be called"),
  });
  const operator = await service.getOperator();
  assert.equal(operator.logoConfigured, false);
  assert.equal(operator.logoUrl, null);
  assert.equal(operator.paymentLogoUrl, null);
  assert.equal(operator.signatureUrl, null);
  await assert.rejects(service.ensureLogo(), { statusCode: 503 });
});

test("each changed source invalidates and replaces only its own deterministic cloud asset", async (t) => {
  const files = await fixture(t);
  const uploads = [];
  const service = createWifiOperatorService({
    ...files,
    isConfigured: () => true,
    upload: async (file, options) => {
      uploads.push(file);
      return uploadResult(options);
    },
  });
  const original = await service.ensureLogo();

  await fs.writeFile(files.logoPath, "updated reference operator logo");
  const afterMainChange = await service.getOperator();
  assert.equal(afterMainChange.logoUrl, null);
  assert.equal(afterMainChange.paymentLogoUrl, original.paymentLogoUrl);
  const updatedMain = await service.ensureLogo();
  assert.notEqual(updatedMain.logoPublicId, original.logoPublicId);
  assert.equal(updatedMain.paymentLogoPublicId, original.paymentLogoPublicId);
  assert.equal(uploads.filter((file) => file === files.logoPath).length, 2);
  assert.equal(uploads.filter((file) => file === files.paymentLogoPath).length, 1);

  await fs.writeFile(files.paymentLogoPath, "updated reference payments bank logo");
  const afterPaymentChange = await service.getOperator();
  assert.equal(afterPaymentChange.logoUrl, updatedMain.logoUrl);
  assert.equal(afterPaymentChange.paymentLogoUrl, null);
  const updatedPayment = await service.ensureLogo();
  assert.equal(updatedPayment.logoPublicId, updatedMain.logoPublicId);
  assert.notEqual(updatedPayment.paymentLogoPublicId, original.paymentLogoPublicId);
  assert.equal(uploads.filter((file) => file === files.logoPath).length, 2);
  assert.equal(uploads.filter((file) => file === files.paymentLogoPath).length, 2);

  await fs.writeFile(files.signaturePath, "updated reference authorised signature");
  const afterSignatureChange = await service.getOperator();
  assert.equal(afterSignatureChange.logoUrl, updatedMain.logoUrl);
  assert.equal(afterSignatureChange.paymentLogoUrl, updatedPayment.paymentLogoUrl);
  assert.equal(afterSignatureChange.signatureUrl, null);
  const updatedSignature = await service.ensureLogo();
  assert.equal(updatedSignature.logoPublicId, updatedMain.logoPublicId);
  assert.equal(updatedSignature.paymentLogoPublicId, updatedPayment.paymentLogoPublicId);
  assert.notEqual(updatedSignature.signaturePublicId, original.signaturePublicId);
  assert.equal(uploads.filter((file) => file === files.signaturePath).length, 2);
});

test("an insecure or unrelated upload response is rejected before that asset is persisted", async (t) => {
  const files = await fixture(t);
  const service = createWifiOperatorService({
    ...files,
    isConfigured: () => true,
    upload: async (_file, options) => ({
      ...uploadResult(options),
      secure_url: "http://res.cloudinary.com/test/logo.png",
    }),
  });
  await assert.rejects(service.ensureLogo(), { statusCode: 502 });
  await assert.rejects(fs.readFile(files.manifestPath), { code: "ENOENT" });
});
