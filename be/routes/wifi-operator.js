const express = require("express");
const { createWifiOperatorService } = require("../services/wifi-operator");

const createWifiOperatorRouter = (service = createWifiOperatorService()) => {
  const router = express.Router();
  const handle = (action) => async (_req, res) => {
    try {
      res.json(await action());
    } catch (error) {
      res.status(error.statusCode || 500).json({
        message: error.statusCode
          ? error.message
          : "Unable to load the operator logo. Please try again.",
      });
    }
  };

  router.get("/", handle(service.getOperator));
  router.post("/logo", handle(service.ensureLogo));
  return router;
};

module.exports = { createWifiOperatorRouter };
