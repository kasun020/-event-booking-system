const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("./authMiddleware");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3002;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ service: "event-service", status: "ok" });
});

app.post("/api/events", authMiddleware, async (req, res) => {
  try {
    const {
      name,
      description,
      date,
      venue,
      organizerName,
      capacity,
      isPublished = false,
    } = req.body;

    const organizerId = req.user.userId;
    const resolvedOrganizerName =
      organizerName || req.user.email || "Organizer";

    if (!name || !date || !venue || !capacity) {
      return res.status(400).json({
        message: "name, date, venue, and capacity are required",
      });
    }

    const event = await prisma.event.create({
      data: {
        name,
        description,
        date: new Date(date),
        venue,
        organizerId,
        organizerName: resolvedOrganizerName,
        capacity: Number(capacity),
        isPublished: Boolean(isPublished),
      },
    });

    return res.status(201).json(event);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to create event", error: error.message });
  }
});

app.get("/events", async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(events);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch events", error: error.message });
  }
});

app.get("/events/:id", async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json(event);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch event", error: error.message });
  }
});

app.patch("/events/:id", async (req, res) => {
  try {
    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        ...(req.body.date ? { date: new Date(req.body.date) } : {}),
        ...(req.body.capacity ? { capacity: Number(req.body.capacity) } : {}),
      },
    });

    return res.json(event);
  } catch (error) {
    return res
      .status(404)
      .json({ message: "Failed to update event", error: error.message });
  }
});

app.listen(port, () => {
  console.log(`event-service listening on port ${port}`);
});
