import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
  throw new Error(
    "Nenhuma credencial de banco de dados encontrada. Configure DATABASE_URL ou as variáveis PGHOST, PGPORT, etc.",
  );
}

console.log("Configurando Drizzle...");

let config;

if (process.env.DATABASE_URL) {
  config = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  };
} else {
  config = {
    host: process.env.PGHOST!,
    port: parseInt(process.env.PGPORT!),
    database: process.env.PGDATABASE!,
    user: process.env.PGUSER!,
    password: process.env.PGPASSWORD!,
    ssl: {
      rejectUnauthorized: false
    }
  };
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: config,
  verbose: true,
  strict: false
});