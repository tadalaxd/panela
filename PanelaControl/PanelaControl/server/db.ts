import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:uvzMYYiIEPwLHyRmZDDtCxMmALStvtCW@centerbeam.proxy.rlwy.net:42414/railway";

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("Tentando conectar ao banco de dados...");

const pool = new Pool({ 
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    requestCert: true
  },
  connectionTimeoutMillis: 5000,
  max: 20,
  idleTimeoutMillis: 30000
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