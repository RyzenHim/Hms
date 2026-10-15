const assert = require("node:assert/strict");
const test = require("node:test");
const { createWifiBillRouter } = require("../routes/wifi-bills");

// Exercise Express route matching/status/JSON contracts without opening a port.
const request = (router, method, url, body) => new Promise((resolve, reject) => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(result) { resolve({ status: this.statusCode, body: result }); return this; },
  };
  router.handle({ method, url, headers: {}, body }, response, (error) => {
    reject(error || new Error(`No route matched ${method} ${url}`));
  });
});

test("draft routes preserve request arguments and the documented success envelopes", async () => {
  const payload = { clientDraftId: "58b438f0-8596-4d72-ac46-f055609c2757", data: { customerName: "Customer" } };
  const saved = { bill: { id: "draft", version: 0, data: payload.data }, customer: { id: "customer", name: "Customer" } };
  const router = createWifiBillRouter({
    createBill: async (body) => { assert.deepEqual(body, payload); return saved; },
    updateBill: async (id, body) => { assert.equal(id, "draft"); assert.equal(body.version, 0); return { ...saved, bill: { ...saved.bill, version: 1 } }; },
    listCustomers: async () => ({ customers: [saved.customer] }),
    getCustomer: async (id) => { assert.equal(id, "customer"); return { customer: saved.customer, bills: [saved.bill] }; },
    getBillingContext: async (id, billMonth) => {
      assert.equal(id, "customer");
      assert.equal(billMonth, "2026-08");
      return { customer: saved.customer, selectedBill: saved.bill, previousBill: null, monthlyRecords: [saved.bill] };
    },
    getBill: async (id) => { assert.equal(id, "draft"); return { bill: saved.bill }; },
  });
  assert.deepEqual(await request(router, "POST", "/bills", payload), { status: 201, body: saved });
  assert.equal((await request(router, "PUT", "/bills/draft", { data: payload.data, version: 0 })).body.bill.version, 1);
  assert.deepEqual((await request(router, "GET", "/customers")).body, { customers: [saved.customer] });
  assert.deepEqual((await request(router, "GET", "/customers/customer")).body, { customer: saved.customer, bills: [saved.bill] });
  assert.deepEqual((await request(router, "GET", "/customers/customer/billing-context/2026-08")).body, {
    customer: saved.customer, selectedBill: saved.bill, previousBill: null, monthlyRecords: [saved.bill],
  });
  assert.deepEqual((await request(router, "GET", "/bills/draft")).body, { bill: saved.bill });
});

test("validation, stale edits, and database outages retain their API statuses without leaking database details", async () => {
  const cases = [
    [Object.assign(new Error("Invalid draft"), { statusCode: 400, errors: { customerName: "Required" } }), 400, "Invalid draft"],
    [Object.assign(new Error("Reload this draft"), { statusCode: 409 }), 409, "Reload this draft"],
    [Object.assign(new Error("private database connection URI"), { name: "MongoNetworkError" }), 503, "database connection was interrupted"],
    [Object.assign(new Error("private transaction info"), { code: 20 }), 503, "transaction support"],
    [new Error("private internal details"), 500, "Unable to save or load"],
  ];
  for (const [error, status, message] of cases) {
    const router = createWifiBillRouter({ createBill: async () => { throw error; } });
    const response = await request(router, "POST", "/bills", {});
    assert.equal(response.status, status);
    assert.ok(response.body.message.includes(message));
    assert.equal(JSON.stringify(response.body).includes("private"), false);
    if (status === 400) assert.deepEqual(response.body.errors, { customerName: "Required" });
  }
});
