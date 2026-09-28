const assert = require("node:assert/strict");
const test = require("node:test");
const { randomUUID } = require("node:crypto");
const { createWifiBillService } = require("../services/wifi-bills");

const createDraft = (service, body) => service.createBill({ clientDraftId: randomUUID(), ...body });

// This store deliberately implements the same atomic version comparison and
// transaction rollback boundary as MongoDB, without writing QA customer data.
const storeFixture = () => {
  const state = { customers: new Map(), bills: new Map(), failBillInsert: false, skipNextTokenLookup: false };
  const session = { testSession: true };
  let sequence = 0;
  const nextId = () => (++sequence).toString(16).padStart(24, "0");
  const timestamp = new Date("2026-09-25T12:00:00.000Z");
  const query = (value) => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => value,
    session: async (received) => { assert.equal(received, session); return value; },
  });
  const Customer = {
    init: async () => {},
    create: async (rows, options) => {
      assert.equal(options.session, session);
      return rows.map((row) => {
        const customer = { ...row, _id: nextId(), createdAt: timestamp, updatedAt: timestamp };
        state.customers.set(customer._id, customer);
        return customer;
      });
    },
    findByIdAndUpdate: async (id, update, options) => {
      assert.equal(options.session, session);
      assert.equal(options.runValidators, true);
      const existing = state.customers.get(String(id));
      if (!existing) return null;
      const customer = { ...existing, ...update.$set };
      state.customers.set(customer._id, customer);
      return customer;
    },
    find: () => query([...state.customers.values()]),
    findById: (id) => query(state.customers.get(id) || null),
  };
  const Bill = {
    init: async () => {},
    create: async (rows, options) => {
      assert.equal(options.session, session);
      if (state.failBillInsert) throw new Error("Simulated bill insert failure");
      return rows.map((row) => {
        if ([...state.bills.values()].some((bill) => bill.clientDraftId === row.clientDraftId)) {
          throw Object.assign(new Error("Duplicate clientDraftId"), { code: 11000 });
        }
        const bill = { ...row, _id: nextId(), version: 0, createdAt: timestamp, updatedAt: timestamp };
        state.bills.set(bill._id, bill);
        return bill;
      });
    },
    findOneAndUpdate: async (filter, update, options) => {
      assert.equal(options.session, session);
      assert.equal(options.runValidators, true);
      const previous = state.bills.get(filter._id);
      if (!previous || previous.version !== filter.version) return null;
      const bill = { ...previous, ...update.$set, version: previous.version + update.$inc.version };
      state.bills.set(bill._id, bill);
      return options.new === false ? previous : bill;
    },
    findById: (id) => query(state.bills.get(id) || null),
    findOne: (filter) => {
      if (state.skipNextTokenLookup) {
        state.skipNextTokenLookup = false;
        return query(null);
      }
      return query([...state.bills.values()].find((bill) => bill.clientDraftId === filter.clientDraftId) || null);
    },
    find: (filter) => query([...state.bills.values()].filter((bill) => bill.customer === filter.customer)),
    exists: (filter) => query(state.bills.has(filter._id) ? { _id: filter._id } : null),
  };
  const connection = {
    readyState: 1,
    transaction: async (work) => {
      const customers = new Map(state.customers);
      const bills = new Map(state.bills);
      try {
        return await work(session);
      } catch (error) {
        state.customers = customers;
        state.bills = bills;
        throw error;
      }
    },
  };
  return { state, connection, service: createWifiBillService({ Customer, Bill, connection }) };
};

test("an incomplete draft creates a stable customer reference and roundtrips blank fields", async () => {
  const { service } = storeFixture();
  const created = await createDraft(service, { data: { customerName: "Asha Rao", rentalAmount: "", previousBalance: "0.10" } });
  assert.equal(created.bill.customerId, created.customer.id);
  assert.equal(created.bill.version, 0);
  assert.equal(created.customer.name, "Asha Rao");
  assert.equal(created.bill.data.rentalAmount, "");
  assert.equal(created.bill.data.previousBalance, "0.10");
  assert.deepEqual((await service.getBill(created.bill.id)).bill, created.bill);
  assert.equal((await service.listCustomers()).customers[0].id, created.customer.id);
  assert.equal((await service.getCustomer(created.customer.id)).bills[0].id, created.bill.id);
});

test("same-name customers are separate records; editing a customer leaves other bill snapshots intact", async () => {
  const { service } = storeFixture();
  const first = await createDraft(service, { data: { customerName: "Shared Name", customerAddress: "Original address" } });
  const unrelated = await createDraft(service, { data: { customerName: "Shared Name" } });
  assert.notEqual(first.customer.id, unrelated.customer.id);

  const next = await createDraft(service, { customerId: first.customer.id, data: { customerName: "Updated Name", customerAddress: "New address" } });
  assert.equal(next.bill.customerId, first.customer.id);
  assert.equal((await service.getCustomer(first.customer.id)).customer.name, "Updated Name");
  assert.equal((await service.getCustomer(first.customer.id)).bills.length, 2);
  const original = (await service.getBill(first.bill.id)).bill;
  assert.equal(original.data.customerName, "Shared Name");
  assert.equal(original.data.customerAddress, "Original address");
  assert.equal((await service.getCustomer(unrelated.customer.id)).customer.name, "Shared Name");
});

test("optimistic versions prevent stale updates without changing the customer master", async () => {
  const { service } = storeFixture();
  const created = await createDraft(service, { data: { customerName: "Initial Name" } });
  const saved = await service.updateBill(created.bill.id, { version: 0, data: { customerName: "New Name", rentalAmount: "123.45" } });
  assert.equal(saved.bill.version, 1);
  await assert.rejects(service.updateBill(created.bill.id, { version: 0, data: { customerName: "Stale Tab" } }), { statusCode: 409 });
  assert.equal((await service.getBill(created.bill.id)).bill.data.rentalAmount, "123.45");
  assert.equal((await service.getCustomer(created.customer.id)).customer.name, "New Name");
});

test("editing historical charges preserves newer master details; explicit customer edits update only those fields", async () => {
  const { service } = storeFixture();
  const old = await createDraft(service, { data: { customerName: "Original Name", customerAddress: "Old address", rentalAmount: "100" } });
  await createDraft(service, { customerId: old.customer.id, data: { customerName: "Current Name", customerAddress: "Current address" } });
  const amountEdit = await service.updateBill(old.bill.id, { version: 0, data: { ...old.bill.data, rentalAmount: "200" } });
  assert.equal(amountEdit.bill.data.customerAddress, "Old address");
  assert.equal(amountEdit.customer.address, "Current address");
  assert.equal(amountEdit.customer.name, "Current Name");

  const addressEdit = await service.updateBill(old.bill.id, { version: 1, data: { ...amountEdit.bill.data, customerAddress: "Explicit address edit" } });
  assert.equal(addressEdit.customer.address, "Explicit address edit");
  assert.equal(addressEdit.customer.name, "Current Name");
  assert.equal(addressEdit.bill.data.customerName, "Original Name");
});

test("a repeated create token returns the committed draft without duplicating or applying newer edits", async () => {
  const { service, state } = storeFixture();
  const clientDraftId = randomUUID();
  const first = await service.createBill({ clientDraftId: clientDraftId.toUpperCase(), data: { customerName: "Saved Name", rentalAmount: "10.20" } });
  const retry = await service.createBill({ clientDraftId, data: { customerName: "Unsaved New Edits", rentalAmount: "99.99" } });
  assert.deepEqual(retry, first);
  assert.equal(state.customers.size, 1);
  assert.equal(state.bills.size, 1);
  assert.equal((await service.getCustomer(first.customer.id)).customer.name, "Saved Name");
});

test("a duplicate-key create race rolls back the extra customer and returns the winning draft", async () => {
  const { service, state } = storeFixture();
  const clientDraftId = randomUUID();
  const first = await service.createBill({ clientDraftId, data: { customerName: "Winning Save" } });
  state.skipNextTokenLookup = true;
  const retry = await service.createBill({ clientDraftId, data: { customerName: "Losing Retry" } });
  assert.deepEqual(retry, first);
  assert.equal(state.customers.size, 1);
  assert.equal(state.bills.size, 1);
});

test("customer creation rolls back if its bill cannot be saved", async () => {
  const { service, state } = storeFixture();
  state.failBillInsert = true;
  await assert.rejects(createDraft(service, { data: { customerName: "Unsaved Customer" } }), /Simulated bill insert failure/);
  assert.equal(state.customers.size, 0);
  assert.equal(state.bills.size, 0);
});

test("updating a missing bill differs from updating a stale version", async () => {
  const { service } = storeFixture();
  await assert.rejects(service.updateBill("000000000000000000000001", { version: 0, data: { customerName: "Customer" } }), { statusCode: 404 });
  await assert.rejects(service.getBill("invalid"), { statusCode: 400 });
  await assert.rejects(createDraft(service, { customerId: "000000000000000000000001", data: { customerName: "Customer" } }), { statusCode: 404 });
});

test("request envelopes reject unsupported fields and missing or invalid update versions", async () => {
  const { service } = storeFixture();
  const created = await createDraft(service, { data: { customerName: "Customer" } });
  for (const version of [undefined, -1, "0", 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(service.updateBill(created.bill.id, { data: { customerName: "Customer" }, version }), { statusCode: 400 });
  }
  await assert.rejects(service.updateBill(created.bill.id, { data: { customerName: "Customer" }, version: 0, customerId: "000000000000000000000001" }), { statusCode: 400 });
  await assert.rejects(createDraft(service, { data: { customerName: "Customer" }, administrator: true }), { statusCode: 400 });
  await assert.rejects(service.createBill({ data: { customerName: "Customer" } }), { statusCode: 400 });
  await assert.rejects(createDraft(service, { clientDraftId: "invalid", data: { customerName: "Customer" } }), { statusCode: 400 });
});

test("a disconnected database fails immediately instead of buffering reads and saves", async () => {
  const { service, connection } = storeFixture();
  connection.readyState = 0;
  await assert.rejects(service.listCustomers(), { statusCode: 503 });
  await assert.rejects(service.getCustomer("000000000000000000000001"), { statusCode: 503 });
  await assert.rejects(service.getBill("000000000000000000000001"), { statusCode: 503 });
  await assert.rejects(createDraft(service, { data: { customerName: "Customer" } }), { statusCode: 503 });
  await assert.rejects(service.updateBill("000000000000000000000001", { data: { customerName: "Customer" }, version: 0 }), { statusCode: 503 });
});
