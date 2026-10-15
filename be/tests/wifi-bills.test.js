const assert = require("node:assert/strict");
const test = require("node:test");
const { randomUUID } = require("node:crypto");
const { createWifiBillService } = require("../services/wifi-bills");

const createDraft = (service, body) => service.createBill({ clientDraftId: randomUUID(), ...body });

const accountData = (billMonth, overrides = {}) => ({
  customerName: "Ms. Jyoti Kumari Singh",
  customerAddressLine1: "Raj Manthan Rd, Sms Colony, Mansarovar",
  customerCity: "Jaipur",
  customerPostalCode: "302020",
  customerState: "Rajasthan",
  customerStateCode: "08",
  accountNumber: "20025842515",
  wifiId: "014122815145_wifi",
  fixedlineNumber: "01414543702",
  paymentUpiId: "20025842515.FL@mairtel",
  billMonth,
  monthMode: "custom",
  hsnSacCode: "998412",
  hsnServiceDescription: "Fixed telephony services",
  rentalAmount: "399",
  discount: "0",
  otherCharges: "0",
  gstRate: "18",
  previousBalance: "0",
  paymentReceived: "0",
  paymentCoupon: "0",
  credits: "0",
  ...overrides,
});

// This store deliberately implements the same atomic version comparison and
// transaction rollback boundary as MongoDB, without writing QA customer data.
const storeFixture = ({ invoiceNumbers = [] } = {}) => {
  const state = { customers: new Map(), bills: new Map(), failBillInsert: false, skipNextTokenLookup: false };
  const session = { testSession: true };
  let sequence = 0;
  let invoiceSequence = 0;
  const nextId = () => (++sequence).toString(16).padStart(24, "0");
  const timestamp = new Date("2026-09-25T12:00:00.000Z");
  const query = (value) => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => value,
    session: async (received) => { assert.equal(received, session); return value; },
  });
  const billMatches = (bill, filter) => {
    if (filter._id !== undefined && String(bill._id) !== String(filter._id)) return false;
    if (filter.version !== undefined && bill.version !== filter.version) return false;
    if (filter.clientDraftId !== undefined && bill.clientDraftId !== filter.clientDraftId) return false;
    if (filter.customer !== undefined && String(bill.customer) !== String(filter.customer)) return false;
    const monthFilter = filter["data.billMonth"];
    const billMonth = String(bill.data?.billMonth || "");
    if (typeof monthFilter === "string" && billMonth !== monthFilter) return false;
    if (monthFilter && typeof monthFilter === "object") {
      if (monthFilter.$ne !== undefined && billMonth === monthFilter.$ne) return false;
      if (monthFilter.$lte !== undefined && billMonth > monthFilter.$lte) return false;
    }
    if (filter.$or) {
      const invoiceNumber = bill.data?.invoiceNumber;
      const matchesBlankInvoice = filter.$or.some((condition) => {
        const expected = condition["data.invoiceNumber"];
        if (expected && typeof expected === "object" && expected.$exists === false) {
          return !("invoiceNumber" in (bill.data || {}));
        }
        return invoiceNumber === expected;
      });
      if (!matchesBlankInvoice) return false;
    }
    return true;
  };
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
        const duplicate = [...state.bills.values()].find((bill) =>
          bill.clientDraftId === row.clientDraftId ||
          (row.data?.billMonth && String(bill.customer) === String(row.customer) && bill.data?.billMonth === row.data.billMonth) ||
          (row.data?.invoiceNumber && bill.data?.invoiceNumber === row.data.invoiceNumber));
        if (duplicate) {
          throw Object.assign(new Error("Duplicate bill key"), { code: 11000 });
        }
        const bill = { ...row, _id: nextId(), version: 0, createdAt: timestamp, updatedAt: timestamp };
        state.bills.set(bill._id, bill);
        return bill;
      });
    },
    findOneAndUpdate: async (filter, update, options) => {
      assert.equal(options.runValidators, true);
      if (options.session !== undefined) assert.equal(options.session, session);
      const previous = [...state.bills.values()].find((bill) => billMatches(bill, filter));
      if (!previous) return null;
      const bill = { ...previous };
      for (const [field, value] of Object.entries(update.$set || {})) {
        if (field === "data.invoiceNumber") bill.data = { ...bill.data, invoiceNumber: value };
        else bill[field] = value;
      }
      bill.version = previous.version + (update.$inc?.version || 0);
      state.bills.set(bill._id, bill);
      return options.new === false ? previous : bill;
    },
    findById: (id) => query(state.bills.get(id) || null),
    findOne: (filter) => {
      if (state.skipNextTokenLookup) {
        state.skipNextTokenLookup = false;
        return query(null);
      }
      return query([...state.bills.values()].find((bill) => billMatches(bill, filter)) || null);
    },
    find: (filter) => query([...state.bills.values()].filter((bill) => billMatches(bill, filter))),
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
  const invoiceNumberFactory = (billMonth) =>
    invoiceNumbers[invoiceSequence++] || `HMS${billMonth.replace("-", "")}I${String(invoiceSequence).padStart(9, "0")}`;
  return {
    state,
    connection,
    service: createWifiBillService({ Customer, Bill, connection, invoiceNumberFactory }),
  };
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
  const first = await createDraft(service, { data: { customerName: "Shared Name", customerAddressLine1: "Original address", customerCity: "Jaipur", customerPostalCode: "302020" } });
  const unrelated = await createDraft(service, { data: { customerName: "Shared Name" } });
  assert.notEqual(first.customer.id, unrelated.customer.id);

  const next = await createDraft(service, { customerId: first.customer.id, data: { customerName: "Updated Name", customerAddressLine1: "New address", customerCity: "Ajmer", customerPostalCode: "305001" } });
  assert.equal(next.bill.customerId, first.customer.id);
  assert.equal((await service.getCustomer(first.customer.id)).customer.name, "Updated Name");
  assert.equal((await service.getCustomer(first.customer.id)).bills.length, 2);
  const original = (await service.getBill(first.bill.id)).bill;
  assert.equal(original.data.customerName, "Shared Name");
  assert.equal(original.data.customerAddressLine1, "Original address");
  assert.equal(original.data.customerCity, "Jaipur");
  assert.equal(original.data.customerPostalCode, "302020");
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
  const old = await createDraft(service, { data: { customerName: "Original Name", customerAddressLine1: "Old address", customerCity: "Jaipur", customerPostalCode: "302020", rentalAmount: "100" } });
  await createDraft(service, { customerId: old.customer.id, data: { customerName: "Current Name", customerAddressLine1: "Current address", customerCity: "Ajmer", customerPostalCode: "305001" } });
  const amountEdit = await service.updateBill(old.bill.id, { version: 0, data: { ...old.bill.data, rentalAmount: "200" } });
  assert.equal(amountEdit.bill.data.customerAddressLine1, "Old address");
  assert.equal(amountEdit.customer.addressLine1, "Current address");
  assert.equal(amountEdit.customer.city, "Ajmer");
  assert.equal(amountEdit.customer.postalCode, "305001");
  assert.equal(amountEdit.customer.name, "Current Name");

  const addressEdit = await service.updateBill(old.bill.id, { version: 1, data: { ...amountEdit.bill.data, customerAddressLine1: "Explicit address edit", customerCity: "Udaipur", customerPostalCode: "313001" } });
  assert.equal(addressEdit.customer.addressLine1, "Explicit address edit");
  assert.equal(addressEdit.customer.city, "Udaipur");
  assert.equal(addressEdit.customer.postalCode, "313001");
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

test("Aug and Sep contexts use their own stored invoice, previous payment, and independent monthly snapshots", async () => {
  const { service } = storeFixture();
  const may = await createDraft(service, { data: accountData("2026-05", {
    invoiceNumber: "MAY-2026-001",
    rentalAmount: "499",
    previousBalance: "520.52",
    paymentReceived: "-520.52",
    paymentDate: "2026-04-16",
  }) });
  const customerId = may.customer.id;
  await createDraft(service, { customerId, data: accountData("2026-06", {
    invoiceNumber: "JUN-2026-001",
    previousBalance: "588.82",
    paymentReceived: "-588.82",
    paymentDate: "2026-05-16",
  }) });
  await createDraft(service, { customerId, data: accountData("2026-07", {
    invoiceNumber: "JUL-2026-001",
    amountMode: "inclusive",
    rentalAmount: "451.19",
    previousBalance: "470.82",
    paymentReceived: "-470.82",
    paymentDate: "2026-06-16",
  }) });
  const august = await createDraft(service, { customerId, data: accountData("2026-08", {
    invoiceNumber: "HF2708I003089481",
    previousBalance: "451.19",
    paymentReceived: "-451.19",
    paymentDate: "2026-07-15",
  }) });
  const september = await createDraft(service, { customerId, data: accountData("2026-09", {
    invoiceNumber: "HF2708I003894536",
    rentalAmount: "999",
    previousBalance: "470.82",
    paymentReceived: "-470.82",
    paymentDate: "2026-08-16",
  }) });

  const augContext = await service.getBillingContext(customerId, "2026-08");
  assert.equal(augContext.selectedBill.id, august.bill.id);
  assert.equal(augContext.selectedBill.data.invoiceNumber, "HF2708I003089481");
  assert.equal(augContext.selectedBill.data.previousBalance, "451.19");
  assert.equal(augContext.selectedBill.data.paymentReceived, "-451.19");
  assert.equal(augContext.selectedBill.data.paymentDate, "2026-07-15");
  assert.equal(augContext.previousBill.data.billMonth, "2026-07");
  assert.deepEqual(augContext.monthlyRecords.map((record) => [
    record.data.billMonth,
    record.data.previousBalance,
    record.data.paymentReceived,
    record.data.rentalAmount,
  ]), [
    ["2026-08", "451.19", "-451.19", "399"],
    ["2026-07", "470.82", "-470.82", "451.19"],
    ["2026-06", "588.82", "-588.82", "399"],
    ["2026-05", "520.52", "-520.52", "499"],
  ]);

  const sepContext = await service.getBillingContext(customerId, "2026-09");
  assert.equal(sepContext.selectedBill.id, september.bill.id);
  assert.equal(sepContext.selectedBill.data.invoiceNumber, "HF2708I003894536");
  assert.equal(sepContext.selectedBill.data.previousBalance, "470.82");
  assert.equal(sepContext.selectedBill.data.paymentReceived, "-470.82");
  assert.equal(sepContext.selectedBill.data.paymentDate, "2026-08-16");
  assert.equal(sepContext.previousBill.id, august.bill.id);
  assert.equal(sepContext.previousBill.data.invoiceNumber, "HF2708I003089481");
  assert.equal(sepContext.customer.accountNumber, "20025842515");
  assert.equal(sepContext.customer.paymentUpiId, "20025842515.FL@mairtel");

  const newMonthContext = await service.getBillingContext(customerId, "2026-10");
  assert.equal(newMonthContext.selectedBill, null);
  assert.equal(newMonthContext.previousBill.id, september.bill.id);
  assert.equal(newMonthContext.previousBill.data.previousBalance, "470.82");

  const changedPlan = await service.updateBill(september.bill.id, {
    version: september.bill.version,
    data: { ...september.bill.data, rentalAmount: "499", planDisplayName: "499 WiFi_40_Mbps" },
  });
  const afterPlanChange = await service.getBillingContext(customerId, "2026-09");
  assert.equal(afterPlanChange.selectedBill.data.rentalAmount, "499");
  assert.equal(afterPlanChange.selectedBill.data.hsnSacCode, "998412");
  assert.equal(afterPlanChange.monthlyRecords.find((record) => record.data.billMonth === "2026-08").data.rentalAmount, "399");
  assert.equal(afterPlanChange.monthlyRecords.find((record) => record.data.billMonth === "2026-08").data.paymentReceived, "-451.19");
  assert.equal(changedPlan.bill.data.invoiceNumber, "HF2708I003894536");
});

test("invoice assignment is persisted once, immutable, and duplicate months are rejected cleanly", async () => {
  const generatedInvoice = "HMS202610I000000777";
  const { service, state } = storeFixture({ invoiceNumbers: [generatedInvoice] });
  const token = randomUUID();
  const first = await service.createBill({
    clientDraftId: token,
    data: accountData("2026-10", { invoiceNumber: "" }),
  });
  assert.equal(first.bill.data.invoiceNumber, generatedInvoice);
  assert.equal(state.bills.get(first.bill.id).data.invoiceNumber.toString(), generatedInvoice);

  const retry = await service.createBill({
    clientDraftId: token,
    data: accountData("2026-10", { invoiceNumber: "", rentalAmount: "499" }),
  });
  assert.equal(retry.bill.data.invoiceNumber, generatedInvoice);
  assert.equal(retry.bill.data.rentalAmount, "399");

  await assert.rejects(service.updateBill(first.bill.id, {
    version: first.bill.version,
    data: { ...first.bill.data, invoiceNumber: "REPLACEMENT" },
  }), { statusCode: 400 });
  await assert.rejects(createDraft(service, {
    customerId: first.customer.id,
    data: accountData("2026-10", { invoiceNumber: "OTHER-OCT-INVOICE" }),
  }), { statusCode: 409 });
});

test("loading a legacy monthly draft reserves one invoice and keeps it on every later read", async () => {
  const generatedInvoice = "HMS202611I000000888";
  const { service, state } = storeFixture({ invoiceNumbers: [generatedInvoice, "SHOULD-NOT-BE-USED"] });
  const legacy = await createDraft(service, { data: { customerName: "Legacy account" } });
  const stored = state.bills.get(legacy.bill.id);
  stored.data.billMonth = "2026-11";
  stored.data.invoiceNumber = "";

  const firstRead = await service.getBill(legacy.bill.id);
  const secondRead = await service.getBill(legacy.bill.id);
  assert.equal(firstRead.bill.data.invoiceNumber, generatedInvoice);
  assert.equal(secondRead.bill.data.invoiceNumber, generatedInvoice);
  assert.equal(firstRead.bill.version, 1);
  assert.equal(secondRead.bill.version, 1);
  assert.equal(state.bills.get(legacy.bill.id).data.invoiceNumber, generatedInvoice);
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
  await assert.rejects(service.getBillingContext("invalid", "2026-08"), { statusCode: 400 });
  await assert.rejects(service.getBillingContext("000000000000000000000001", "2026-13"), { statusCode: 400 });
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
  await assert.rejects(service.getBillingContext("000000000000000000000001", "2026-08"), { statusCode: 503 });
  await assert.rejects(createDraft(service, { data: { customerName: "Customer" } }), { statusCode: 503 });
  await assert.rejects(service.updateBill("000000000000000000000001", { data: { customerName: "Customer" }, version: 0 }), { statusCode: 503 });
});
