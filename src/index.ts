import express from "express";
import type { Request, Response } from "express";
import { pool } from "./db";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", async (req: Request, res: Response) => {
  try {
    const response = await fetch("http://localhost:3001/webhooks/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "http://host.docker.internal:3000/webhooks"
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch from localhost:3001" });
  }
});

app.post("/webhooks", async (req: Request, res: Response) => {
    console.log("Webhook received for event type = " + req.body.event);
    console.log(req.body);
    
    if (req.headers['x-webhook-secret'] != 'super_secret_key_123') {
        res.status(401).json({ message: "Unauthorized request" });
    } else {
        res.status(200).json({ received: true });
    }

    console.log("Webhook secret verified");

    const timestamp = req.body.timestamp;
    const webhookId = req.body.webhookId;
    const { reservationId, propertyId, guestId, status, checkIn, checkOut, numGuests, totalAmount, currency } = req.body.data;

    console.log("Sending request to guests api");

    const response = await fetch(`http://localhost:3001/guests/${guestId}`, {
      method: "GET",
    });

    if (!response.ok) {
        return res.status(500).json({ error: "Failed to fetch guest" });
    }

    const guestData = await response.json();
    const { id, firstName, lastName, email, phone } = guestData;
    console.log("Got guest data:", guestData);

    console.log(`Writing reservation ${reservationId} to database..."`);

    await pool.query(
      `
      INSERT INTO reservations (
        reservation_id,
        property_id,
        guest_id,
        status,
        check_in,
        check_out,
        num_guests,
        total_amount,
        currency,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        webhook_id,
        event_timestamp
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `,
      [
        reservationId,
        propertyId,
        guestId,
        status,
        checkIn,
        checkOut,
        numGuests,
        totalAmount,
        currency,
        firstName,
        lastName,
        email,
        phone,
        webhookId,
        timestamp
      ]
    );

    console.log("✅ Reservation stored successfully");
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});

export default app;