const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3003;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ service: "ticket-service", status: "ok" });
});

app.post("/inventory", async (req, res) => {
  try {
    const {
      eventId,
      tier,
      price,
      totalStock,
      reservedStock = 0,
      soldStock = 0,
    } = req.body;

    if (!eventId || !tier || price == null || totalStock == null) {
      return res
        .status(400)
        .json({ message: "eventId, tier, price, and totalStock are required" });
    }

    const inventory = await prisma.ticketInventory.create({
      data: {
        eventId,
        tier,
        price,
        totalStock: Number(totalStock),
        reservedStock: Number(reservedStock),
        soldStock: Number(soldStock),
      },
    });

    return res.status(201).json(inventory);
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Failed to create ticket inventory",
        error: error.message,
      });
  }
});

app.get("/inventory", async (req, res) => {
  try {
    const inventory = await prisma.ticketInventory.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(inventory);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch inventory", error: error.message });
  }
});

app.get("/inventory/event/:eventId", async (req, res) => {
  try {
    const inventory = await prisma.ticketInventory.findMany({
      where: { eventId: req.params.eventId },
    });
    return res.json(inventory);
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Failed to fetch event inventory",
        error: error.message,
      });
  }
});

app.post("/inventory/:id/reserve", async (req, res) => {
  try {
    const quantity = Number(req.body.quantity || 0);
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "quantity must be at least 1" });
    }

    const inventory = await prisma.ticketInventory.findUnique({
      where: { id: req.params.id },
    });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const available =
      inventory.totalStock - inventory.reservedStock - inventory.soldStock;
    if (available < quantity) {
      return res.status(409).json({ message: "Not enough available stock" });
    }

    const updated = await prisma.ticketInventory.update({
      where: { id: req.params.id },
      data: { reservedStock: inventory.reservedStock + quantity },
    });

    return res.json(updated);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to reserve inventory", error: error.message });
  }
});

app.post("/inventory/:id/confirm", async (req, res) => {
  try {
    const quantity = Number(req.body.quantity || 0);
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "quantity must be at least 1" });
    }

    const inventory = await prisma.ticketInventory.findUnique({
      where: { id: req.params.id },
    });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (inventory.reservedStock < quantity) {
      return res
        .status(409)
        .json({ message: "Not enough reserved stock to confirm" });
    }

    const updated = await prisma.ticketInventory.update({
      where: { id: req.params.id },
      data: {
        reservedStock: inventory.reservedStock - quantity,
        soldStock: inventory.soldStock + quantity,
      },
    });

    return res.json(updated);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to confirm inventory", error: error.message });
  }
});

app.post("/inventory/:id/release", async (req, res) => {
  try {
    const quantity = Number(req.body.quantity || 0);
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "quantity must be at least 1" });
    }

    const inventory = await prisma.ticketInventory.findUnique({
      where: { id: req.params.id },
    });
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    if (inventory.reservedStock < quantity) {
      return res
        .status(409)
        .json({ message: "Not enough reserved stock to release" });
    }

    const updated = await prisma.ticketInventory.update({
      where: { id: req.params.id },
      data: { reservedStock: inventory.reservedStock - quantity },
    });

    return res.json(updated);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to release inventory", error: error.message });
  }
});

app.listen(port, () => {
  console.log(`ticket-service listening on port ${port}`);
});
