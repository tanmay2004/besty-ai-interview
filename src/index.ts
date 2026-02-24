import express from "express";
import type { Request, Response } from "express";
import { pool } from "./db";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const PORT = process.env.PORT || 3000;

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Routes
async function registerWebhook() {
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
    console.log("Webhook registered: ", data);
  } catch (error) {
    console.log("Failed to register webhook");
  }
}

app.post("/reservations", async (req: Request, res: Response) => {
    try {
        var query = "SELECT * FROM reservations ORDER BY created_at DESC"
        if (req.body.status != "") {
            query = `SELECT * FROM reservations WHERE status = '${req.body.status}' ORDER BY created_at DESC`
        }
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch reservations" });
    }
});

type RetryJob = {
    guestId: string;
    message: string;
    attempts: number;
    nextRetry: number; // timestamp
  };
  
const retryQueue: RetryJob[] = [];

const MAX_ATTEMPTS = 5;

async function processRetryQueue() {
    while (true) {
      if (retryQueue.length === 0) {
        // No jobs, wait a bit before checking again
        await new Promise(res => setTimeout(res, 500));
        continue;
      }
  
      const job = retryQueue.shift()!; // remove first job from queue
      const now = Date.now();
  
      if (job.nextRetry > now) {
        // Not ready yet, push it back at the end
        retryQueue.push(job);
        // Wait a bit before next iteration to avoid busy loop
        await new Promise(res => setTimeout(res, 500));
        continue;
      }
  
      try {
        console.log(`Retrying guest ${job.guestId} (attempt ${job.attempts + 1})`);
  
        const response = await fetch(
          `http://localhost:3001/guests/${job.guestId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: job.message }),
          }
        );
  
        if (!response.ok) {
          throw new Error(`Retry failed: ${response.status}`);
        }
  
        console.log(`✅ Retry succeeded for ${job.guestId}`);
        // Success → do not push back
  
      } catch (err) {
        job.attempts++;
  
        if (job.attempts >= MAX_ATTEMPTS) {
          console.log(`❌ Giving up on ${job.guestId}`);
        } else {
          const delay = Math.pow(2, job.attempts) * 1000; // exponential backoff
          job.nextRetry = Date.now() + delay;
          console.log(`⏳ Will retry ${job.guestId} in ${delay}ms`);
          retryQueue.push(job); // push back at the end
        }
      }
    }
}

app.post("/send_message", async (req: Request, res: Response) => {
    for (const guestId of req.body.guests) {
        try {
            const response = await fetch(`http://localhost:3001/guests/${guestId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: req.body.msg
                })
            });

            const resp = await response.json();
            console.log(resp);
        } catch (error) {
            retryQueue.push(
                
            );
            console.error(error);
            console.log(`Failed to send message to guest ${guestId}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds
    }

    console.log("Successfully sent messages to all guests!");
    res.status(200).json( {status: "Messages sent!"} );
});

async function fetchGuestFromAPI(guestId: string, retries = 5) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
  
    try {
        const response = await fetch(
            `http://localhost:3001/guests/${guestId}`,
            {
                method: "GET",
                signal: controller.signal
            }
        );
  
        clearTimeout(timeout);
    
        if (response.status === 404) {
            throw new Error("Guest not found (404)");
        }
    
        if (!response.ok) {
            throw new Error(`Guest API error: ${response.status}`);
        }
    
        return await response.json();
    } catch (error) {
        clearTimeout(timeout);
    
        if (retries > 0) {
            console.log("Retrying guest fetch...");
            return fetchGuestFromAPI(guestId, retries - 1);
        }
    
        throw error;
    }
}

async function getGuestData(guestId: string) {
    // 1️⃣ Check if guest exists in DB
    const result = await pool.query(
        `SELECT * FROM guests WHERE guest_id = $1`,
        [guestId]
    );
  
    if (result.rowCount === 0) {
        const guestData = await fetchGuestFromAPI(guestId);
    
        const { id, firstName, lastName, email, phone } = guestData;
    
        // 2️⃣ Insert into DB
        await pool.query(
            `
            INSERT INTO guests (
                guest_id,
                first_name,
                last_name,
                email,
                phone
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [id, firstName, lastName, email, phone]
        );
    
        console.log("Inserted new guest into DB");
    
        return {
            id: id,
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone
        };
    } else {
        console.log("Guest found in DB");

        // 3️⃣ Return existing guest
        return result.rows[0];
    }
}

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

    const guestData = await getGuestData(guestId);
    const { id, first_name, last_name, email, phone } = guestData;

    if (req.body.event == "reservation.created") {
        console.log(`Writing reservation ${reservationId} to database...`);
        
        try {
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
                ON CONFLICT (reservation_id) DO NOTHING;
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
                    first_name,
                    last_name,
                    email,
                    phone,
                    webhookId,
                    timestamp
                ]
            );

            console.log("✅ Reservation created successfully");
        } catch (error) {
            console.error("Unexpected DB error:", error);
        }
    } else if (req.body.event == "reservation.updated") {
        console.log(`Updating reservation ${reservationId} in database...`);

        await pool.query(
            `
            UPDATE reservations
            SET
              property_id = $1,
              guest_id = $2,
              status = $3,
              check_in = $4,
              check_out = $5,
              num_guests = $6,
              total_amount = $7,
              currency = $8,
              guest_first_name = $9,
              guest_last_name = $10,
              guest_email = $11,
              guest_phone = $12,
              webhook_id = $13,
              event_timestamp = $14
            WHERE reservation_id = $15
            `,
            [
              propertyId,
              guestId,
              status,
              checkIn,
              checkOut,
              numGuests,
              totalAmount,
              currency,
              first_name,
              last_name,
              email,
              phone,
              webhookId,
              timestamp,
              reservationId
            ]
        );
        
        console.log("✅ Reservation updated successfully");
    } else if (req.body.event == "reservation.cancelled") {
        console.log(`Deleting reservation ${reservationId} from database...`);

        const result = await pool.query(
            `
            DELETE FROM reservations
            WHERE reservation_id = $1
            `,
            [reservationId]
        );

        if (result.rowCount === 0) {
            console.log("❌ No reservation found to delete");
        } else {
            console.log("✅ Reservation deleted successfully");
        }
    }

    io.emit("update");
});

// start
server.listen(PORT, async () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
    await registerWebhook();
    processRetryQueue();
});

export default app;