// @ts-ignore
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("Tentando conectar ao banco de dados...");

const pool = new Pool({ 
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Teste de conexão com retry
const MAX_RETRIES = 5;
let retries = 0;

async function connectWithRetry() {
  try {
    const client = await pool.connect();
    console.log("Conexão com o banco de dados estabelecida com sucesso");
    client.release();
    return true;
  } catch (err) {
    console.error(`Tentativa ${retries + 1}/${MAX_RETRIES} falhou:`, err);
    if (retries < MAX_RETRIES) {
      retries++;
      console.log(`Tentando novamente em 1 segundo...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return connectWithRetry();
    }
    console.error("Erro fatal ao conectar com o banco de dados após todas as tentativas");
    throw err;
  }
}

connectWithRetry().catch(err => {
  console.error("Falha na conexão inicial:", err);
  process.exit(1);
});

export const db = drizzle(pool, { schema });