const express = require("express");
const { createWifiBillService } = require("../services/wifi-bills");

const createWifiBillRouter = (service = createWifiBillService()) => {
  const router = express.Router();
  const handle = (action, successStatus = 200) => async (req, res) => {
    try {
      res.status(successStatus).json(await action(req));
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message, ...(error.errors ? { errors: error.errors } : {}) });
      }
      if (error.code === 20 || error.codeName === "IllegalOperation") {
        return res.status(503).json({ message: "Saving drafts requires a MongoDB replica set or Atlas deployment with transaction support." });
      }
      if (["MongoNetworkError", "MongoServerSelectionError", "MongooseServerSelectionError", "MongoTopologyClosedError", "MongoNotConnectedError"].includes(error.name)) {
        return res.status(503).json({ message: "The database connection was interrupted. Your edits remain in the form; check the saved history before retrying." });
      }
      res.status(500).json({ message: "Unable to save or load this bill. Your edits remain in the form. Please try again." });
    }
  };

  router.get("/customers", handle(() => service.listCustomers()));
  router.get("/customers/:id/billing-context/:billMonth", handle((req) =>
    service.getBillingContext(req.params.id, req.params.billMonth)));
  router.get("/customers/:id", handle((req) => service.getCustomer(req.params.id)));
  router.get("/bills/:id", handle((req) => service.getBill(req.params.id)));
  router.post("/bills", handle((req) => service.createBill(req.body), 201));
  router.put("/bills/:id", handle((req) => service.updateBill(req.params.id, req.body)));
  return router;
};

module.exports = { createWifiBillRouter };
