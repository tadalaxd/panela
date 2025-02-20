import { Pool } from 'pg';
import { config } from '../config';

let pool: Pool;

export async function connectDatabase() {
    try {
        pool = new Pool({
            connectionString: config.database.url,
            ssl: {
                rejectUnauthorized: false
            }
        });

        // Test connection
        const client = await pool.connect();
        client.release();
        
        console.log('Database connection established');
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

export function getPool() {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    return pool;
}
