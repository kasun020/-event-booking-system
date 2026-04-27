const express = require("express");
const cors = require("cors");
const { connectAndConsumeWithRetry } = require("./consumer");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3006;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ service: "notification-service", status: "ok" });
});

app.listen(port, () => {
  console.log(`notification-service listening on port ${port}`);
  connectAndConsumeWithRetry().catch((error) => {
    console.error(
      "notification-service failed to start consumer:",
      error.message,
    );
  });
});
