// server/server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db'); // Our PostgreSQL database connection pool

const app = express();
const PORT = process.env.PORT || 3000; // Use port 3000 or Render's assigned port

// Middleware
app.use(cors({
    // IMPORTANT: For Render, this will likely be your own deployed frontend URL.
    // Render often sets RENDER_EXTERNAL_HOSTNAME, which is the URL of your service.
    // If frontend is separate, use its exact URL (e.g., 'https://your-frontend-app.onrender.com')
    origin: process.env.NODE_ENV === 'production' ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : 'http://127.0.0.1:5500' // Adjust for your local Live Server port
    // During local development, replace 'http://127.0.0.1:5500' with your actual Live Server URL (e.g., 'http://localhost:8080')
}));
app.use(express.json()); // For parsing application/json bodies

// Secret key for JWTs (MUST be set as an environment variable in production!)
const JWT_SECRET = process.env.JWT_SECRET || 'a_very_insecure_default_secret_for_dev_ONLY'; // CHANGE THIS DEFAULT IN PRODUCTION!

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) {
        return res.sendStatus(401); // No token, Unauthorized
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err);
            return res.sendStatus(403); // Token invalid/expired, Forbidden
        }
        req.user = user; // Attach user payload to request
        next();
    });
};

// --- API Routes ---

// 1. User Registration
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
        const result = await pool.query(
            "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
            [username, hashedPassword]
        );
        res.status(201).json({ message: 'User registered successfully!', userId: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ message: 'Username already exists.' });
        }
        console.error('Error registering user:', err.message);
        return res.status(500).json({ message: 'Error registering user.' });
    }
});

// 2. User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        const user = result.rows[0]; // PostgreSQL returns an array of rows

        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        // Generate JWT
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
        res.json({ message: 'Login successful!', token, userId: user.id, username: user.username });
    } catch (err) {
        console.error('Error during login query:', err.message);
        return res.status(500).json({ message: 'Server error during login.' });
    }
});

// 3. Get All Businesses (Publicly accessible)
app.get('/api/businesses', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM businesses");
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching businesses:', err.message);
        return res.status(500).json({ message: 'Error fetching businesses.' });
    }
});

// 4. Get Single Business by ID (Publicly accessible)
app.get('/api/businesses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM businesses WHERE id = $1", [id]);
        const row = result.rows[0];

        if (!row) {
            return res.status(404).json({ message: 'Business not found.' });
        }
        res.json(row);
    } catch (err) {
        console.error('Error fetching business:', err.message);
        return res.status(500).json({ message: 'Error fetching business.' });
    }
});

// 5. Add a New Business (Requires authentication)
app.post('/api/businesses', authenticateToken, async (req, res) => {
    const { name, category, location, description, phone, email, website, hours, image, latitude, longitude } = req.body;
    const userId = req.user.id; // Get userId from the authenticated token

    if (!name || !category || !location || !description) {
        return res.status(400).json({ message: 'Required business fields are missing.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO businesses (user_id, name, category, location, description, phone, email, website, hours, image, latitude, longitude)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [userId, name, category, location, description, phone, email, website, hours, image, latitude, longitude]
        );
        res.status(201).json({ message: 'Business added successfully!', businessId: result.rows[0].id });
    } catch (err) {
        console.error('Error adding business:', err.message);
        return res.status(500).json({ message: 'Error adding business.' });
    }
});

// 6. Get Reviews for a Business (Publicly accessible)
app.get('/api/reviews/:businessId', async (req, res) => {
    const { businessId } = req.params;
    try {
        const result = await pool.query("SELECT * FROM reviews WHERE business_id = $1", [businessId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching reviews:', err.message);
        return res.status(500).json({ message: 'Error fetching reviews.' });
    }
});

// 7. Add a New Review (Requires authentication)
app.post('/api/reviews', authenticateToken, async (req, res) => {
    const { businessId, reviewerName, text, rating } = req.body;
    const userId = req.user.id; // Get userId from the authenticated token
    const date = new Date().toLocaleDateString('en-US'); // Specify locale for consistent date string

    if (!businessId || !reviewerName || !text || !rating) {
        return res.status(400).json({ message: 'All review fields are required.' });
    }

    try {
        const reviewResult = await pool.query(
            `INSERT INTO reviews (business_id, user_id, reviewer_name, text, rating, review_date)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [businessId, userId, reviewerName, text, rating, date]
        );

        // After adding review, update the business's average rating
        const allReviewsResult = await pool.query("SELECT rating FROM reviews WHERE business_id = $1", [businessId]);
        const reviewRows = allReviewsResult.rows;

        if (reviewRows.length > 0) {
            const totalRating = reviewRows.reduce((sum, r) => sum + r.rating, 0);
            const averageRating = totalRating / reviewRows.length;
            await pool.query("UPDATE businesses SET rating = $1 WHERE id = $2", [averageRating, businessId]);
            console.log(`Business ${businessId} rating updated to ${averageRating}`);
        }

        res.status(201).json({ message: 'Review added successfully!', reviewId: reviewResult.rows[0].id });
    } catch (err) {
        console.error('Error adding review or updating business rating:', err.message);
        return res.status(500).json({ message: 'Error adding review or updating business rating.' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Frontend should access API at http://localhost:${PORT}/api/...`);
    console.log(`JWT_SECRET in use: ${JWT_SECRET}`); // For debugging
    console.log(`DATABASE_URL in use: ${process.env.DATABASE_URL ? 'Set' : 'NOT SET!'}`); // For debugging
});
