# Interview Project

## Starting Services

```bash
docker compose up
```

To run in background:

```bash
docker compose up -d
```

Your webhook secret is `super_secret_key_123`

## Services

| Service        | Port | URL                              |
| -------------- | ---- | -------------------------------- |
| PostgreSQL     | 5432 | `localhost:5432`                 |
| Guest API      | 3001 | `http://localhost:3001`          |
| Webhook Sender | —    | (no exposed port, internal only) |

## Connecting to the Database

```bash
psql -h localhost -p 5432 -U interview -d interview
```

Password: `interview_password`

The database already has a `reservations` table for you. Don't change this schema, it's needed for tests.

## Restrictions

Only use postgres and your programming language of choice. Time limit is 3 hours. You can use any language you want, TypeScript is a plus.

## Deliverables

At the end of the challenge, you should have a github repo that djsurry@gmail.com has access to. It can be public or private with collaborator access granted. It should include a README.md describing how to spin up your solution. It will need multiple processes, but it's ok for the instructions to be as basic as "Start this node process, then run npm run dev in a different terminal session". A single command to spin up your solution is nice but not required.

## Notes

You're expected to fully understand all the logic in your solution and be prepared to answer questions after the fact. You'll be asked to explain your reasoning behind your design decisions. The problem is meant to be very challenging so it's not an automatic fail if you run out of time. Your solution should be built to scale, or you should at least be able to concretely define how you would scale it.
