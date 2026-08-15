require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const app = express();
const port = process.env.PORT;
const db = process.env.DB;

mongoose
  .connect(db)
  .then(() => console.log("Db connected"))
  .catch((error) => console.log("Error in connecting to db:-", error));

app.listen(port, () => console.log("The server is running on port:- ", port));
