import { defineConfig } from "drizzle-kit";

if (!process.env.PGDATABASE) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

console.log("Configurando Drizzle...");

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.PGHOST!,
    port: parseInt(process.env.PGPORT!),
    database: process.env.PGDATABASE!,
    user: process.env.PGUSER!,
    password: process.env.PGPASSWORD!,
    ssl: {
      rejectUnauthorized: false
    }
  },
  verbose: true,
  strict: false
});