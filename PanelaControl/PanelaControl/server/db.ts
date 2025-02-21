import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.PGDATABASE) {
  throw new Error(
    "Database credentials not found. Did you forget to provision a database?",
  );
}

console.log("Iniciando configuração do banco de dados...");

const pool = new Pool({ 
  host: process.env.PGHOST!,
  port: parseInt(process.env.PGPORT!),
  database: process.env.PGDATABASE!,
  user: process.env.PGUSER!,
  password: process.env.PGPASSWORD!,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // reduzido para evitar sobrecarga
  idleTimeoutMillis: 60000, // aumentado para 1 minuto
  connectionTimeoutMillis: 10000, // aumentado para 10 segundos
  allowExitOnIdle: true
});

// Teste de conexão com retry e backoff exponencial
const MAX_RETRIES = 10; // Aumentado para 10 tentativas
const INITIAL_BACKOFF = 1000; // 1 segundo
let retries = 0;

async function connectWithRetry() {
  const backoff = INITIAL_BACKOFF * Math.pow(2, retries);

  try {
    const client = await pool.connect();
    console.log("Conexão com o banco de dados estabelecida com sucesso");
    client.release();
    return true;
  } catch (err) {
    console.error(`Tentativa ${retries + 1}/${MAX_RETRIES} falhou:`, err);
    if (retries < MAX_RETRIES) {
      retries++;
      console.log(`Tentando novamente em ${backoff/1000} segundos...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return connectWithRetry();
    }
    console.error("Erro fatal ao conectar com o banco de dados após todas as tentativas");
    throw err;
  }
}

// Eventos do pool para monitoramento
pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexões:', err);
});

pool.on('connect', () => {
  console.log('Nova conexão estabelecida no pool');
});

pool.on('remove', () => {
  console.log('Conexão removida do pool');
});

connectWithRetry().catch(err => {
  console.error("Falha na conexão inicial:", err);
  process.exit(1);
});

export const db = drizzle(pool, { schema });