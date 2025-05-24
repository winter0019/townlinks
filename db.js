// server/db.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = './townlink.db'; // SQLite database file

let db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Enable foreign key support (important for relationships)
        db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
            if (pragmaErr) {
                console.error('Error enabling foreign keys:', pragmaErr.message);
            } else {
                console.log('Foreign keys enabled.');
            }
        });

        // Create Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
        `, (err) => {
            if (err) {
                console.error("Error creating users table:", err.message);
            } else {
                console.log("Users table created or already exists.");
                // Add a default admin user if not exists
                db.get("SELECT COUNT(*) AS count FROM users WHERE username = 'admin'", (err, row) => {
                    if (err) {
                        console.error("Error checking for admin user:", err.message);
                    } else if (row.count === 0) {
                        const hashedPassword = bcrypt.hashSync('admin123', 10); // Hash default password
                        db.run("INSERT INTO users (username, password) VALUES (?, ?)", ['admin', hashedPassword], (err) => {
                            if (err) {
                                console.error("Error inserting default admin user:", err.message);
                            } else {
                                console.log("Default admin user 'admin' created with password 'admin123'.");
                            }
                        });
                    }
                });
            }
        });

        // Create Businesses table
        db.run(`
            CREATE TABLE IF NOT EXISTS businesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER, -- NEW: Link to user who added it
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                rating REAL DEFAULT 0.0,
                location TEXT NOT NULL,
                description TEXT,
                phone TEXT,
                email TEXT,
                website TEXT,
                hours TEXT,
                image TEXT,
                latitude REAL,
                longitude REAL,
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
            );
        `, (err) => {
            if (err) {
                console.error("Error creating businesses table:", err.message);
            } else {
                console.log("Businesses table created or already exists.");
            }
        });

        // Create Reviews table
        db.run(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                businessId INTEGER NOT NULL,
                userId INTEGER, -- NEW: Link to user who wrote it (optional for now, can be null)
                reviewerName TEXT NOT NULL,
                text TEXT NOT NULL,
                rating INTEGER NOT NULL,
                date TEXT NOT NULL,
                FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
            );
        `, (err) => {
            if (err) {
                console.error("Error creating reviews table:", err.message);
            } else {
                console.log("Reviews table created or already exists.");
            }
        });
    }
});

module.exports = db; // Export the database connection