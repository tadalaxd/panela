import { defineConfig } from "drizzle-kit";
import { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

console.log("Configurando Drizzle...");

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL
  },
  verbose: true,
  strict: true
} as Config);