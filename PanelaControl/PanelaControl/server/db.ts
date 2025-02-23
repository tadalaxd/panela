import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

console.log("Iniciando configuração do banco de dados...");

// Verificar DATABASE_URL primeiro
if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
  throw new Error(
    "Nenhuma credencial de banco de dados encontrada. Configure DATABASE_URL ou as variáveis PGHOST, PGPORT, etc.",
  );
}

let pool: pkg.Pool;

if (process.env.DATABASE_URL) {
  console.log("Usando DATABASE_URL para conexão");
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true
  });
} else {
  console.log("Usando variáveis PG individuais para conexão");
  pool = new Pool({ 
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || "5432"),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true
  });
}

// Teste de conexão com retry e backoff exponencial
const MAX_RETRIES = 10;
const INITIAL_BACKOFF = 1000; // 1 segundo
let retries = 0;

async function connectWithRetry() {
  const backoff = INITIAL_BACKOFF * Math.pow(2, retries);

  try {
    const client = await pool.connect();
    console.log("Conexão com o banco de dados estabelecida com sucesso");
    // Teste simples para verificar se podemos executar queries
    const result = await client.query('SELECT NOW()');
    console.log("Teste de query executado com sucesso:", result.rows[0]);
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

// Verificar credenciais e tentar conexão inicial
console.log("Credenciais do banco de dados:", {
  usingDatabaseUrl: !!process.env.DATABASE_URL,
  host: process.env.PGHOST || 'from DATABASE_URL',
  database: process.env.PGDATABASE || 'from DATABASE_URL',
  port: process.env.PGPORT || 'from DATABASE_URL',
  // Não logar user e password por segurança
});

connectWithRetry().catch(err => {
  console.error("Falha na conexão inicial:", err);
  process.exit(1);
});

export const db = drizzle(pool, { schema });