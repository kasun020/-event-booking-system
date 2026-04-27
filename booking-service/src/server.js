const express = require("express");
const cors = require("cors");
const amqp = require("amqplib");
const { PrismaClient, BookingStatus } = require("@prisma/client");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3004;
const prisma = new PrismaClient();
const rabbitmqUrl =
  process.env.RABBITMQ_URL || "amqp://appuser:apppassword@localhost:5672";
const bookingEventsExchange = "booking_events";
const bookingCreatedRoutingKey = "booking.created";
const rabbitRetryDelayMs = 5000;
let rabbitConnection;
let rabbitChannel;
const serviceBaseUrls = {
  event: process.env.EVENT_SERVICE_URL || "http://localhost:3002",
  ticket: process.env.TICKET_SERVICE_URL || "http://localhost:3003",
  payment: process.env.PAYMENT_SERVICE_URL || "http://localhost:3005",
};

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ service: "booking-service", status: "ok" });
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectRabbitMqWithRetry() {
  while (!rabbitConnection || !rabbitChannel) {
    try {
      rabbitConnection = await amqp.connect(rabbitmqUrl);
      rabbitConnection.on("error", (error) => {
        console.error(
          "booking-service RabbitMQ connection error:",
          error.message,
        );
      });
      rabbitConnection.on("close", () => {
        console.error(
          "booking-service RabbitMQ connection closed. Retrying...",
        );
        rabbitConnection = null;
        rabbitChannel = null;
      });

      rabbitChannel = await rabbitConnection.createChannel();
      await rabbitChannel.assertExchange(bookingEventsExchange, "topic", {
        durable: true,
      });

      console.log("booking-service connected to RabbitMQ");
    } catch (error) {
      console.error(
        "booking-service RabbitMQ connection failed, retrying:",
        error.message,
      );
      rabbitConnection = null;
      rabbitChannel = null;
      await wait(rabbitRetryDelayMs);
    }
  }
}

async function publishBookingCreated(payload) {
  if (!rabbitChannel) {
    await connectRabbitMqWithRetry();
  }

  try {
    rabbitChannel.publish(
      bookingEventsExchange,
      bookingCreatedRoutingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: "application/json",
      },
    );
  } catch (error) {
    console.error("booking-service failed to publish message:", error.message);
    rabbitConnection = null;
    rabbitChannel = null;
    await connectRabbitMqWithRetry();
    rabbitChannel.publish(
      bookingEventsExchange,
      bookingCreatedRoutingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: "application/json",
      },
    );
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      typeof body === "string" ? body : body.message || "Request failed",
    );
    error.statusCode = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

app.get("/bookings", async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(bookings);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch bookings", error: error.message });
  }
});

app.get("/bookings/:id", async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    return res.json(booking);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch booking", error: error.message });
  }
});

app.post("/bookings", async (req, res) => {
  let booking = null;
  let reservedInventoryId = null;
  let reservedQuantity = 0;

  try {
    const {
      userId,
      userEmail,
      eventId,
      ticketTier,
      quantity,
      paymentMethod = "stripe",
    } = req.body;

    if (!userId || !userEmail || !eventId || !ticketTier || !quantity) {
      return res.status(400).json({
        message:
          "userId, userEmail, eventId, ticketTier, and quantity are required",
      });
    }

    const event = await fetchJson(`${serviceBaseUrls.event}/events/${eventId}`);
    const inventories = await fetchJson(
      `${serviceBaseUrls.ticket}/inventory/event/${eventId}`,
    );
    const inventory = inventories.find((item) => item.tier === ticketTier);

    if (!inventory) {
      return res
        .status(404)
        .json({ message: "Ticket tier not found for the event" });
    }

    reservedInventoryId = inventory.id;
    reservedQuantity = Number(quantity);

    await fetchJson(
      `${serviceBaseUrls.ticket}/inventory/${inventory.id}/reserve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: reservedQuantity }),
      },
    );

    booking = await prisma.booking.create({
      data: {
        userId,
        eventId,
        ticketInventoryId: inventory.id,
        tier: ticketTier,
        quantity: reservedQuantity,
        totalAmount: Number(inventory.price) * reservedQuantity,
        status: BookingStatus.PENDING,
      },
    });

    const payment = await fetchJson(
      `${serviceBaseUrls.payment}/payments/charge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: booking.totalAmount,
          currency: "USD",
          provider: paymentMethod,
          bookingId: booking.id,
          eventName: event.name,
        }),
      },
    );

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.PAID,
        paymentRef: payment.paymentRef,
      },
    });

    await fetchJson(
      `${serviceBaseUrls.ticket}/inventory/${inventory.id}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: reservedQuantity }),
      },
    );

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CONFIRMED },
    });

    await publishBookingCreated({
      bookingId: booking.id,
      userId: booking.userId,
      userEmail,
      eventId: booking.eventId,
    });

    return res.status(201).json(booking);
  } catch (error) {
    if (booking?.id && reservedInventoryId) {
      try {
        await fetchJson(
          `${serviceBaseUrls.ticket}/inventory/${reservedInventoryId}/release`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: reservedQuantity }),
          },
        );
      } catch (releaseError) {
        console.error(
          "Failed to release reserved stock after booking error:",
          releaseError.message,
        );
      }

      await prisma.booking
        .update({
          where: { id: booking.id },
          data: { status: BookingStatus.FAILED },
        })
        .catch(() => {});
    }

    return res.status(error.statusCode || 500).json({
      message: "Failed to create booking",
      error: error.message,
      details: error.body,
    });
  }
});

app.listen(port, () => {
  console.log(`booking-service listening on port ${port}`);
  connectRabbitMqWithRetry();
});
