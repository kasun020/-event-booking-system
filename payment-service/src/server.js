const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ service: "payment-service", status: "ok" });
});

app.post("/payments/charge", (req, res) => {
  const { amount, currency = "USD", provider = "stripe" } = req.body;

  if (amount == null) {
    return res.status(400).json({ message: "amount is required" });
  }

  return res.status(200).json({
    status: "approved",
    provider,
    currency,
    amount,
    paymentRef: `pay_${Date.now()}`,
  });
});

app.listen(port, () => {
  console.log(`payment-service listening on port ${port}`);
});
