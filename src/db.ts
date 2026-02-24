import { Pool } from "pg";

export const pool = new Pool({
  host: "localhost", // "host.docker.internal"
  port: 5432,
  user: "interview",
  password: "interview_password",
  database: "interview",
});