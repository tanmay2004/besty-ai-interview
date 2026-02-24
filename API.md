# API Documentation

Base URL: `http://localhost:3001`

---

## Authentication

Webhooks are signed with a secret passed via the `X-Webhook-Secret` header. Your server should validate this header on every incoming webhook request.

---

## Endpoints

### `GET /guests/:guestId`

Fetch details for a guest.

**Response `200 OK`**

---

### `POST /guests/:guestId/messages`

Send a message to a guest.

**Request Body**

```json
{
  "message": "Hello, welcome to your stay!"
}
```

**Response `200 OK`**

Returns `400` if `message` is missing. Returns `404` if the guest does not exist.

---

### `POST /webhooks/register`

Register a URL to receive reservation webhook events.

**Request Body**

```json
{
  "url": "http://host.docker.internal:3000/webhooks"
}
```

> Use `host.docker.internal` so the Docker container can reach your local server.

**Response `201 Created`**

---

### `GET /webhooks/registered`

List all currently registered webhook URLs.

**Response `200 OK`**

---

### `DELETE /webhooks/unregister`

Unregister a webhook URL.

**Request Body**

```json
{
  "url": "http://host.docker.internal:3000/webhooks"
}
```

**Response `200 OK`**

Returns `404` if the URL was not registered.

---

## Rate Limiting

The Guest API is rate limited. When you exceed the limit, the API returns `429 Too Many Requests` with a `Retry-After` header indicating how long to wait before retrying.

---

## Webhooks

Once you register a webhook URL, the system will begin sending reservation events to it via `POST` requests.

### Event Types

| Event                   | Status      | Description                          |
| ----------------------- | ----------- | ------------------------------------ |
| `reservation.created`   | `confirmed` | A new reservation was created        |
| `reservation.updated`   | `modified`  | An existing reservation was modified |
| `reservation.cancelled` | `cancelled` | A reservation was cancelled          |

### Health Monitoring

The webhook sender monitors your endpoint's health. If your endpoint returns too many errors or responds too slowly, your URL will be automatically unregistered. You'll need to re-register to resume receiving events.
