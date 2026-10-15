const mongoose = require("mongoose");
const { randomBytes } = require("node:crypto");
const WifiCustomer = require("../models/WifiCustomer");
const WifiBill = require("../models/WifiBill");
const {
  validateDraftData,
  dataToStorage,
  dataFromStorage,
  customerFromData,
  customerFromStorage,
} = require("./wifi-bill-data");

const requestError = (message, statusCode, errors) =>
  Object.assign(new Error(message), { statusCode, ...(errors ? { errors } : {}) });

const requireId = (value, field = "id") => {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throw requestError("A valid record ID is required.", 400, { [field]: "Invalid record ID." });
  }
  return value;
};

const requireBody = (body, allowedKeys) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw requestError("A request object is required.", 400);
  }
  const unexpectedKeys = Object.keys(body).filter((key) => !allowedKeys.includes(key));
  if (unexpectedKeys.length) {
    throw requestError("The request contains unsupported fields.", 400,
      Object.fromEntries(unexpectedKeys.map((key) => [key, "Unsupported field."])));
  }
};

const plain = (document) => document?.toObject ? document.toObject() : document;
const isoDate = (value) => value instanceof Date ? value.toISOString() : value;
const validBillMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const defaultInvoiceNumberFactory = (billMonth) =>
  `HMS${billMonth.replace("-", "")}I${randomBytes(5).toString("hex").toUpperCase()}`;

const customerResponse = (document) => {
  const customer = plain(document);
  const canonical = customerFromStorage(customer);
  return {
    id: String(customer._id),
    ...canonical,
    createdAt: isoDate(customer.createdAt),
    updatedAt: isoDate(customer.updatedAt),
  };
};

const billResponse = (document) => {
  const bill = plain(document);
  return {
    id: String(bill._id),
    customerId: String(bill.customer),
    data: dataFromStorage(bill.data),
    version: bill.version,
    createdAt: isoDate(bill.createdAt),
    updatedAt: isoDate(bill.updatedAt),
  };
};

const monthConflict = (billMonth) => requestError(
  `A stored bill already exists for ${billMonth}. Open that monthly record instead of creating another one.`,
  409,
  { billMonth: "Each billing account can have only one stored bill for a month." },
);

const sortMonthlyDocuments = (documents) => [...documents].sort((left, right) => {
  const leftMonth = String(plain(left)?.data?.billMonth || "");
  const rightMonth = String(plain(right)?.data?.billMonth || "");
  const byMonth = rightMonth.localeCompare(leftMonth);
  if (byMonth) return byMonth;
  return String(isoDate(plain(right)?.updatedAt) || "").localeCompare(String(isoDate(plain(left)?.updatedAt) || ""));
});

const createWifiBillService = ({
  Customer = WifiCustomer,
  Bill = WifiBill,
  connection = mongoose.connection,
  invoiceNumberFactory = defaultInvoiceNumberFactory,
} = {}) => {
  const requireDatabase = () => {
    // Do not let Mongoose queue a save that appears to hang when disconnected.
    if (connection.readyState !== 1) {
      throw requestError("The database is unavailable. Your edits are still in the form; retry saving when it reconnects.", 503);
    }
  };

  const listCustomers = async () => {
    requireDatabase();
    const customers = await Customer.find({})
      .select("name accountNumber updatedAt")
      .sort({ updatedAt: -1, _id: -1 })
      .lean();
    return {
      customers: customers.map((customer) => ({
        id: String(customer._id),
        name: customer.name,
        accountNumber: customer.accountNumber,
        updatedAt: isoDate(customer.updatedAt),
      })),
    };
  };

  const assignInvoiceNumber = (data) => {
    if (!data.billMonth.trim() || data.invoiceNumber.trim()) return data;
    const invoiceNumber = invoiceNumberFactory(data.billMonth);
    return validateDraftData({ ...data, invoiceNumber });
  };

  // Legacy drafts may already have a month but no invoice identifier. Fill that
  // value with an atomic blank-only update so concurrent reads keep one number.
  const ensureStoredInvoiceNumber = async (document) => {
    const stored = plain(document);
    const data = dataFromStorage(stored.data);
    if (!data.billMonth || data.invoiceNumber) return stored;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const invoiceNumber = invoiceNumberFactory(data.billMonth);
      validateDraftData({ ...data, invoiceNumber });
      try {
        const updated = await Bill.findOneAndUpdate(
          {
            _id: stored._id,
            $or: [
              { "data.invoiceNumber": "" },
              { "data.invoiceNumber": null },
              { "data.invoiceNumber": { $exists: false } },
            ],
          },
          { $set: { "data.invoiceNumber": invoiceNumber }, $inc: { version: 1 } },
          { new: true, runValidators: true },
        );
        if (updated) return plain(updated);
        const winner = await Bill.findById(stored._id).lean();
        if (winner?.data?.invoiceNumber) return winner;
      } catch (error) {
        // A generated number collision is safe to retry. Other persistence
        // failures retain their original status and error details.
        if (error.code !== 11000) throw error;
      }
    }
    throw requestError("Unable to reserve a unique invoice number. Please retry saving this bill.", 409);
  };

  const getCustomer = async (id) => {
    requireId(id);
    requireDatabase();
    const [customer, bills] = await Promise.all([
      Customer.findById(id).lean(),
      Bill.find({ customer: id })
        .select("customer data.invoiceNumber data.billMonth updatedAt version")
        .sort({ updatedAt: -1, _id: -1 })
        .lean(),
    ]);
    if (!customer) throw requestError("Customer not found.", 404);
    return {
      customer: customerResponse(customer),
      bills: bills.map((bill) => ({
        id: String(bill._id),
        customerId: String(bill.customer),
        invoiceNumber: bill.data.invoiceNumber,
        billMonth: bill.data.billMonth,
        version: bill.version,
        updatedAt: isoDate(bill.updatedAt),
      })),
    };
  };

  const getBill = async (id) => {
    requireId(id);
    requireDatabase();
    let bill = await Bill.findById(id).lean();
    if (!bill) throw requestError("Bill draft not found.", 404);
    bill = await ensureStoredInvoiceNumber(bill);
    return { bill: billResponse(bill) };
  };

  const getBillingContext = async (customerId, billMonth) => {
    requireId(customerId, "customerId");
    if (typeof billMonth !== "string" || !validBillMonth(billMonth)) {
      throw requestError("A valid billing month is required.", 400, { billMonth: "Use YYYY-MM." });
    }
    requireDatabase();
    const [customer, storedBills] = await Promise.all([
      Customer.findById(customerId).lean(),
      Bill.find({ customer: customerId, "data.billMonth": { $ne: "", $lte: billMonth } }).lean(),
    ]);
    if (!customer) throw requestError("Customer not found.", 404);

    // Keep one authoritative record for each month if legacy data predates the
    // unique month index. The most recently updated snapshot wins.
    const monthlyDocuments = [];
    const seenMonths = new Set();
    for (const storedBill of sortMonthlyDocuments(storedBills)) {
      const month = String(storedBill.data?.billMonth || "");
      if (!validBillMonth(month) || month > billMonth || seenMonths.has(month)) continue;
      seenMonths.add(month);
      monthlyDocuments.push(await ensureStoredInvoiceNumber(storedBill));
    }
    const monthlyRecords = monthlyDocuments.map(billResponse);
    const selectedBill = monthlyRecords.find((bill) => bill.data.billMonth === billMonth) || null;
    const previousBill = monthlyRecords.find((bill) => bill.data.billMonth < billMonth) || null;
    return {
      customer: customerResponse(customer),
      selectedBill,
      previousBill,
      monthlyRecords,
    };
  };

  const createBill = async (body) => {
    requireBody(body, ["clientDraftId", "customerId", "data"]);
    if (typeof body.clientDraftId !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.clientDraftId)) {
      throw requestError("A client draft ID is required for safe save retries.", 400, { clientDraftId: "Use one UUID for this new draft and reuse it when retrying." });
    }
    const clientDraftId = body.clientDraftId.toLowerCase();
    const data = assignInvoiceNumber(validateDraftData(body.data));
    const customerId = body.customerId === undefined ? null : requireId(body.customerId, "customerId");
    requireDatabase();
    // Wait for the idempotency index before accepting the first save. Mongoose
    // caches init(), so subsequent saves do not rebuild indexes.
    await Promise.all([Customer.init(), Bill.init()]);

    // Customer and snapshot either both save or neither does. Names are labels,
    // never keys: two customers with the same name keep independent histories.
    try {
      return await connection.transaction(async (session) => {
        const existing = await Bill.findOne({ clientDraftId }).session(session);
        if (existing) {
          const customer = await Customer.findById(existing.customer).session(session);
          if (!customer) throw requestError("The customer linked to this bill no longer exists.", 409);
          return { bill: billResponse(existing), customer: customerResponse(customer) };
        }
        if (customerId && data.billMonth) {
          const existingMonth = await Bill.findOne({
            customer: customerId,
            "data.billMonth": data.billMonth,
          }).session(session);
          if (existingMonth) throw monthConflict(data.billMonth);
        }
        let customer;
        if (customerId) {
          customer = await Customer.findByIdAndUpdate(customerId,
            { $set: customerFromData(data) }, { new: true, runValidators: true, session });
          if (!customer) throw requestError("Customer not found.", 404);
        } else {
          [customer] = await Customer.create([customerFromData(data)], { session });
        }
        const [bill] = await Bill.create([{
          clientDraftId,
          customer: customer._id,
          data: dataToStorage(data),
        }], { session });
        return { bill: billResponse(bill), customer: customerResponse(customer) };
      });
    } catch (error) {
      // Another request with this token may have committed after our initial
      // lookup. Its winning snapshot is authoritative; do not apply retry edits.
      if (error.code !== 11000) throw error;
      const existing = await Bill.findOne({ clientDraftId }).lean();
      if (!existing) {
        if (customerId && data.billMonth) {
          const existingMonth = await Bill.findOne({
            customer: customerId,
            "data.billMonth": data.billMonth,
          }).lean();
          if (existingMonth) throw monthConflict(data.billMonth);
        }
        throw requestError("That invoice number is already assigned to another stored bill.", 409, {
          invoiceNumber: "Use the invoice number stored for this month, or leave it blank to generate one.",
        });
      }
      const customer = await Customer.findById(existing.customer).lean();
      if (!customer) throw requestError("The customer linked to this bill no longer exists.", 409);
      return { bill: billResponse(existing), customer: customerResponse(customer) };
    }
  };

  const updateBill = async (id, body) => {
    requireId(id);
    requireBody(body, ["data", "version"]);
    let data = validateDraftData(body.data);
    if (!Number.isSafeInteger(body.version) || body.version < 0) {
      throw requestError("The saved bill version is required.", 400, { version: "Use the version returned when loading or saving this bill." });
    }
    requireDatabase();

    return connection.transaction(async (session) => {
      const existing = await Bill.findById(id).session(session);
      if (!existing) throw requestError("Bill draft not found.", 404);
      if (existing.version !== body.version) {
        throw requestError("This draft was changed in another session. Reload the saved bill before saving again; your current edits have not been overwritten.", 409);
      }
      const existingData = dataFromStorage(existing.data);
      if (existingData.billMonth && data.billMonth !== existingData.billMonth) {
        throw requestError("The billing month cannot change after this monthly record is saved.", 400, {
          billMonth: "Create or open the record for the other month.",
        });
      }
      if (existingData.invoiceNumber && data.invoiceNumber && data.invoiceNumber !== existingData.invoiceNumber) {
        throw requestError("The invoice number cannot change after it is stored.", 400, {
          invoiceNumber: "Use the invoice number already assigned to this month.",
        });
      }
      data = validateDraftData({
        ...data,
        invoiceNumber: existingData.invoiceNumber || data.invoiceNumber,
      });
      data = assignInvoiceNumber(data);
      if (!existingData.billMonth && data.billMonth) {
        const existingMonth = await Bill.findOne({
          customer: existing.customer,
          "data.billMonth": data.billMonth,
        }).session(session);
        if (existingMonth && String(existingMonth._id) !== String(existing._id)) {
          throw monthConflict(data.billMonth);
        }
      }
      // The version comparison and increment are one atomic database operation.
      // An older browser tab cannot overwrite another tab's saved changes.
      const previous = await Bill.findOneAndUpdate(
        { _id: id, version: body.version },
        { $set: { data: dataToStorage(data) }, $inc: { version: 1 } },
        { new: false, runValidators: true, session },
      );
      if (!previous) {
        const exists = await Bill.exists({ _id: id }).session(session);
        if (!exists) throw requestError("Bill draft not found.", 404);
        throw requestError("This draft was changed in another session. Reload the saved bill before saving again; your current edits have not been overwritten.", 409);
      }
      // Saving an older bill's charges must not restore its old customer address
      // over a newer master profile. Sync only customer fields actually edited
      // relative to this bill's previous snapshot.
      const previousProfile = customerFromData(dataFromStorage(previous.data));
      const nextProfile = customerFromData(data);
      const changedProfile = Object.fromEntries(Object.entries(nextProfile)
        .filter(([field, value]) => value !== previousProfile[field]));
      const customer = Object.keys(changedProfile).length
        ? await Customer.findByIdAndUpdate(previous.customer,
          { $set: changedProfile }, { new: true, runValidators: true, session })
        : await Customer.findById(previous.customer).session(session);
      if (!customer) throw requestError("The customer linked to this bill no longer exists.", 409);
      const bill = await Bill.findById(id).session(session);
      return { bill: billResponse(bill), customer: customerResponse(customer) };
    });
  };

  return { listCustomers, getCustomer, getBill, getBillingContext, createBill, updateBill };
};

module.exports = { createWifiBillService, defaultInvoiceNumberFactory };
