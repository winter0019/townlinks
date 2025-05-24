// server/server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db'); // SQLite connection

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors({
    origin: 'http://127.0.0.1:5500', // Change this to your actual frontend origin
    credentials: true
}));
app.use(express.json());

// ===== JWT Secret =====
const JWT_SECRET = 'your_super_secret_jwt_key'; // Use env var in production

// ===== AUTH MIDDLEWARE =====
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Error:', err);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// ===== ROUTES =====

// Register
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ message: 'Username and password required.' });

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run("INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPassword],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Username already exists.' });
                }
                console.error(err.message);
                return res.status(500).json({ message: 'Registration error.' });
            }
            res.status(201).json({ message: 'User registered!', userId: this.lastID });
        });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ message: 'Username and password required.' });

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ message: 'Login error.' });
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful', token, userId: user.id, username: user.username });
    });
});

// Get all businesses (public)
app.get('/api/businesses', (req, res) => {
    db.all("SELECT * FROM businesses", [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching businesses.' });
        res.json(rows);
    });
});

// Get business by ID (public)
app.get('/api/businesses/:id', (req, res) => {
    db.get("SELECT * FROM businesses WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ message: 'Error fetching business.' });
        if (!row) return res.status(404).json({ message: 'Business not found.' });
        res.json(row);
    });
});

// Add new business (auth required)
app.post('/api/businesses', authenticateToken, (req, res) => {
    const { name, category, location, description, phone, email, website, hours, image, latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!name || !category || !location || !description) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    db.run(
        `INSERT INTO businesses (userId, name, category, location, description, phone, email, website, hours, image, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, category, location, description, phone, email, website, hours, image, latitude, longitude],
        function (err) {
            if (err) return res.status(500).json({ message: 'Error adding business.' });
            res.status(201).json({ message: 'Business added!', businessId: this.lastID });
        }
    );
});

// Get reviews for a business (public)
app.get('/api/reviews/:businessId', (req, res) => {
    db.all("SELECT * FROM reviews WHERE businessId = ?", [req.params.businessId], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching reviews.' });
        res.json(rows);
    });
});

// Add review (auth required)
app.post('/api/reviews', authenticateToken, (req, res) => {
    const { businessId, reviewerName, text, rating } = req.body;
    const userId = req.user.id;
    const date = new Date().toLocaleDateString('en-US');

    if (!businessId || !reviewerName || !text || !rating)
        return res.status(400).json({ message: 'All review fields are required.' });

    db.run(
        `INSERT INTO reviews (businessId, userId, reviewerName, text, rating, date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [businessId, userId, reviewerName, text, rating, date],
        function (err) {
            if (err) return res.status(500).json({ message: 'Error adding review.' });

            // Recalculate rating
            db.all("SELECT rating FROM reviews WHERE businessId = ?", [businessId], (err, reviews) => {
                if (!err && reviews.length > 0) {
                    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                    db.run("UPDATE businesses SET rating = ? WHERE id = ?", [avgRating, businessId]);
                }
            });

            res.status(201).json({ message: 'Review added!', reviewId: this.lastID });
        }
    );
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📡 API accessible at http://localhost:${PORT}/api/...`);
});
