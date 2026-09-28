import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultWifiBill } from "../src/lib/wifi-bill.ts";
import { getWifiSavedBill, saveWifiDraft, WifiApiError, wifiBillFingerprint, wifiCustomerFields } from "../src/lib/wifi-api.ts";

test("new draft saves incomplete details with a stable retry identifier and customer reference", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    return new Response(JSON.stringify({ bill: { id: "bill1", version: 0 } }), { status: 201 });
  });
  const data = { ...createDefaultWifiBill(), customerName: "Example Customer" };
  for (let attempt = 0; attempt < 2; attempt++) await saveWifiDraft(data, "customer1", null, "stable-draft-id");
  assert.match(calls[0].url, /\/api\/wifi\/bills$/);
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), { data, customerId: "customer1", clientDraftId: "stable-draft-id" });
  assert.equal(calls[1].body, calls[0].body);
});

test("editing a saved draft sends its version and retains field-level server errors", async (context) => {
  let request;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, ...options };
    return new Response(JSON.stringify({ message: "Newer edits exist.", errors: { customerName: "Required" } }), { status: 409 });
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
  assert.deepEqual(JSON.parse(request.body), { data, version: 3 });
});

test("loading a bill returns its stored month unchanged", async (context) => {
  const bill = { id: "bill1", customerId: "customer1", version: 2, data: { ...createDefaultWifiBill(new Date(2024, 1, 1)), monthMode: "custom" } };
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ bill })));
  assert.deepEqual(await getWifiSavedBill("bill1"), { bill });
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

test("new customer bills copy profile fields without inheriting old invoice dates or totals", () => {
  const fields = wifiCustomerFields({ name: "Example", address: "Address", email: "", phone: "9000000000", gstin: "", state: "Rajasthan", stateCode: "08", accountNumber: "A1", wifiId: "W1", fixedlineNumber: "" });
  assert.equal(fields.customerName, "Example");
  assert.equal(fields.accountNumber, "A1");
  for (const field of ["billMonth", "invoiceNumber", "paymentReceived", "rentalAmount"]) assert.ok(!(field in fields));
});
