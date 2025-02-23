import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

console.log("Tentando conectar ao banco de dados...");

if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
  throw new Error(
    "Nenhuma credencial de banco de dados encontrada. Configure DATABASE_URL ou as variáveis PGHOST, PGPORT, etc.",
  );
}

const poolConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || "5432"),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

const pool = new Pool(poolConfig);

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

// Teste inicial de conexão
async function initializeDatabase() {
  let client;
  try {
    console.log("Testando conexão com o banco de dados...");
    client = await pool.connect();

    // Definir o schema explicitamente
    await client.query('SET search_path TO public');

    // Teste básico de conexão
    const result = await client.query('SELECT NOW()');
    console.log("Conexão estabelecida, timestamp:", result.rows[0].now);

    // Verificar se a tabela existe
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'guild_configs'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      throw new Error("Tabela guild_configs não encontrada! Execute 'npm run migrate' primeiro.");
    }

    // Teste explícito de acesso à tabela
    await client.query('SELECT COUNT(*) FROM public.guild_configs');
    console.log("Tabela guild_configs encontrada e acessível.");

    return true;
  } catch (error) {
    console.error("Erro ao inicializar banco de dados:", error);
    throw error;
  } finally {
    if (client) client.release();
  }
}

// Inicializar o banco de dados antes de exportar
await initializeDatabase();

// Exportar a instância do Drizzle com configurações explícitas
export const db = drizzle(pool, { 
  schema,
  // Configurações adicionais do Drizzle
  defaultSchema: 'public'
});