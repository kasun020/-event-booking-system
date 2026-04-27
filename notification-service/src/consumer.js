const amqp = require("amqplib");

const rabbitmqUrl =
  process.env.RABBITMQ_URL || "amqp://appuser:apppassword@localhost:5672";
const bookingEventsExchange = "booking_events";
const bookingCreatedRoutingKey = "booking.created";
const bookingCreatedQueue = "booking.created.notifications";
const rabbitRetryDelayMs = 5000;
let rabbitConnection;
let rabbitChannel;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectAndConsumeWithRetry() {
  while (!rabbitConnection || !rabbitChannel) {
    try {
      rabbitConnection = await amqp.connect(rabbitmqUrl);
      rabbitConnection.on("error", (error) => {
        console.error(
          "notification-service RabbitMQ connection error:",
          error.message,
        );
      });
      rabbitConnection.on("close", () => {
        console.error(
          "notification-service RabbitMQ connection closed. Retrying...",
        );
        rabbitConnection = null;
        rabbitChannel = null;
        setTimeout(() => {
          connectAndConsumeWithRetry().catch(() => {});
        }, rabbitRetryDelayMs);
      });

      rabbitChannel = await rabbitConnection.createChannel();
      await rabbitChannel.assertExchange(bookingEventsExchange, "topic", {
        durable: true,
      });
      await rabbitChannel.assertQueue(bookingCreatedQueue, { durable: true });
      await rabbitChannel.bindQueue(
        bookingCreatedQueue,
        bookingEventsExchange,
        bookingCreatedRoutingKey,
      );

      await rabbitChannel.consume(bookingCreatedQueue, (message) => {
        if (!message) {
          return;
        }

        try {
          const payload = JSON.parse(message.content.toString());
          console.log(
            `Sending confirmation email to ${payload.userEmail} for Booking ID: ${payload.bookingId}`,
          );
          rabbitChannel.ack(message);
        } catch (error) {
          console.error(
            "notification-service failed to process message:",
            error.message,
          );
          rabbitChannel.nack(message, false, false);
        }
      });

      console.log(
        `notification-service consuming ${bookingCreatedRoutingKey} from ${bookingEventsExchange}`,
      );
    } catch (error) {
      console.error(
        "notification-service RabbitMQ connection failed, retrying:",
        error.message,
      );
      rabbitConnection = null;
      rabbitChannel = null;
      await wait(rabbitRetryDelayMs);
    }
  }
}

module.exports = {
  connectAndConsumeWithRetry,
};
