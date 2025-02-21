import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

console.log("Configurando Drizzle...");

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: true
  },
  verbose: true,
  strict: false, // Desabilitar modo estrito para permitir alterações nas tabelas
  push: {
    force: true, // Força a criação das tabelas sem pedir confirmação
    forceDrop: true // Força a recriação das tabelas se necessário
  }
});