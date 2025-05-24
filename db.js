// server/db.js (For PostgreSQL)
const { Pool } = require('pg');

// Create a new Pool instance
// Render will automatically provide the DATABASE_URL environment variable.
// For local development, you'll need to set DATABASE_URL in a .env file
// or directly here (though env vars are preferred).
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // Required for Render production DB
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

async function connectAndInitDb() {
    try {
        const client = await pool.connect();
        console.log('Connected to PostgreSQL database.');

        // Create tables if they don't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS businesses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                location TEXT NOT NULL,
                description TEXT,
                phone TEXT,
                email TEXT,
                website TEXT,
                hours TEXT,
                image TEXT,
                latitude REAL,
                longitude REAL,
                rating REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                reviewer_name TEXT NOT NULL,
                text TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                review_date TEXT NOT NULL, -- Storing as text for simplicity with toLocaleDateString
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Tables created or already exist.');
        client.release(); // Release the client back to the pool
    } catch (err) {
        console.error('Error connecting to or initializing PostgreSQL:', err.message);
        // In a real application, you might want to retry or handle this gracefully
        process.exit(1); // Exit if unable to connect or initialize DB
    }
}

connectAndInitDb();

module.exports = pool; // Export the pool for use in server.js
