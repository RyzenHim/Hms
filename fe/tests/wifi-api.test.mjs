import assert from "node:assert/strict";
import test from "node:test";
import { wifiApi } from "../src/lib/api.ts";
import { createDefaultWifiBill } from "../src/lib/wifi-bill.ts";
import { getWifiBillingContext, getWifiSavedBill, saveWifiDraft, WifiApiError, wifiBillFingerprint, wifiCustomerFields } from "../src/lib/wifi-api.ts";

test("new draft saves incomplete details with a stable retry identifier and customer reference", async (context) => {
  const calls = [];
  context.mock.method(wifiApi, "request", async (config) => {
    calls.push(config);
    return { data: { bill: { id: "bill1", version: 0 } }, status: 201 };
  });
  const data = { ...createDefaultWifiBill(), customerName: "Example Customer" };
  for (let attempt = 0; attempt < 2; attempt++) await saveWifiDraft(data, "customer1", null, "stable-draft-id");
  assert.equal(calls[0].url, "/bills");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].data, { data, customerId: "customer1", clientDraftId: "stable-draft-id" });
  assert.deepEqual(calls[1].data, calls[0].data);
});

test("editing a saved draft sends its version and retains field-level server errors", async (context) => {
  let request;
  context.mock.method(wifiApi, "request", async (config) => {
    request = config;
    throw {
      isAxiosError: true,
      response: {
        status: 409,
        data: { message: "Newer edits exist.", errors: { customerName: "Required" } },
      },
    };
  });
  const data = createDefaultWifiBill();
  await assert.rejects(saveWifiDraft(data, "customer1", { id: "bill1", version: 3 }, "ignored"), (error) => {
    assert.ok(error instanceof WifiApiError);
    assert.equal(error.status, 409);
    assert.equal(error.errors.customerName, "Required");
    return true;
  });
  assert.match(request.url, /\/bills\/bill1$/);
  assert.equal(request.method, "PUT");
  assert.deepEqual(request.data, { data, version: 3 });
});

test("loading a bill returns its stored month unchanged", async (context) => {
  const bill = { id: "bill1", customerId: "customer1", version: 2, data: { ...createDefaultWifiBill(new Date(2024, 1, 1)), monthMode: "custom" } };
  context.mock.method(wifiApi, "request", async () => ({ data: { bill } }));
  assert.deepEqual(await getWifiSavedBill("bill1"), { bill });
});

test("billing context loads the selected and immediately previous stored records", async (context) => {
  const response = { customer: { id: "customer1", paymentUpiId: "account@bank" }, selectedBill: { id: "aug" }, previousBill: { id: "jul" }, monthlyRecords: [{ id: "aug" }, { id: "jul" }] };
  let requestedUrl = "";
  context.mock.method(wifiApi, "request", async (config) => {
    requestedUrl = String(config.url);
    return { data: response };
  });
  assert.deepEqual(await getWifiBillingContext("customer 1", "2026-08"), response);
  assert.match(requestedUrl, /\/customers\/customer%201\/billing-context\/2026-08$/);
});

test("saved fingerprints normalize decimal storage but preserve meaningful unsaved edits", () => {
  const data = createDefaultWifiBill();
  assert.equal(wifiBillFingerprint(data), wifiBillFingerprint({
    ...data,
    rentalAmount: "999.00",
    discount: "0.00",
    paymentCoupon: "0.00",
    creditLimit: "0.00",
    securityDeposit: "0.00",
  }));
  assert.notEqual(wifiBillFingerprint(data), wifiBillFingerprint({ ...data, rentalAmount: "" }));
  assert.notEqual(wifiBillFingerprint(data), wifiBillFingerprint({ ...data, rentalAmount: "1000" }));
  assert.notEqual(wifiBillFingerprint(data), wifiBillFingerprint({ ...data, notes: "Edited during save" }));
});

test("new customer bills copy one account profile without inheriting old invoice dates or totals", () => {
  const fields = wifiCustomerFields({ name: "Example", addressLine1: "Address", city: "Jaipur", postalCode: "302020", email: "", phone: "9000000000", gstin: "", state: "Rajasthan", stateCode: "08", accountNumber: "A1", wifiId: "W1", fixedlineNumber: "", paymentUpiId: "a1@bank" });
  assert.equal(fields.customerName, "Example");
  assert.equal(fields.customerCity, "Jaipur");
  assert.equal(fields.accountNumber, "A1");
  assert.equal(fields.paymentUpiId, "a1@bank");
  for (const field of ["billMonth", "invoiceNumber", "paymentReceived", "rentalAmount"]) assert.ok(!(field in fields));
});
