const mongoose = require("mongoose");
const WifiCustomer = require("../models/WifiCustomer");
const WifiBill = require("../models/WifiBill");
const {
  validateDraftData,
  dataToStorage,
  dataFromStorage,
  customerFromData,
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

const customerResponse = (document) => {
  const customer = plain(document);
  return {
    id: String(customer._id),
    name: customer.name,
    address: customer.address,
    email: customer.email,
    phone: customer.phone,
    gstin: customer.gstin,
    state: customer.state,
    stateCode: customer.stateCode,
    accountNumber: customer.accountNumber,
    wifiId: customer.wifiId,
    fixedlineNumber: customer.fixedlineNumber,
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

const createWifiBillService = ({
  Customer = WifiCustomer,
  Bill = WifiBill,
  connection = mongoose.connection,
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
    const bill = await Bill.findById(id).lean();
    if (!bill) throw requestError("Bill draft not found.", 404);
    return { bill: billResponse(bill) };
  };

  const createBill = async (body) => {
    requireBody(body, ["clientDraftId", "customerId", "data"]);
    if (typeof body.clientDraftId !== "string" || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.clientDraftId)) {
      throw requestError("A client draft ID is required for safe save retries.", 400, { clientDraftId: "Use one UUID for this new draft and reuse it when retrying." });
    }
    const clientDraftId = body.clientDraftId.toLowerCase();
    const data = validateDraftData(body.data);
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
      if (!existing) throw error;
      const customer = await Customer.findById(existing.customer).lean();
      if (!customer) throw requestError("The customer linked to this bill no longer exists.", 409);
      return { bill: billResponse(existing), customer: customerResponse(customer) };
    }
  };

  const updateBill = async (id, body) => {
    requireId(id);
    requireBody(body, ["data", "version"]);
    const data = validateDraftData(body.data);
    if (!Number.isSafeInteger(body.version) || body.version < 0) {
      throw requestError("The saved bill version is required.", 400, { version: "Use the version returned when loading or saving this bill." });
    }
    requireDatabase();

    return connection.transaction(async (session) => {
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

  return { listCustomers, getCustomer, getBill, createBill, updateBill };
};

module.exports = { createWifiBillService };
