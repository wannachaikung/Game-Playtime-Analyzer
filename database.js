const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// --- Database Connection ---
// Render and other cloud providers use the DATABASE_URL environment variable.
// For local development, you'll need to set this in your .env file.
// Example: DATABASE_URL="postgres://user:password@localhost:5432/mydatabase"

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Use SSL in production as required by most cloud providers
    ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// --- Promisified Helper Functions (for PostgreSQL) ---

/**
 * Runs a SQL query and returns the result object.
 * @param {string} sql The SQL query string.
 * @param {Array} params An array of parameters for the query.
 * @returns {Promise<QueryResult>} A promise that resolves with the query result.
 */
const query = (sql, params = []) => pool.query(sql, params);

/**
 * Runs a SQL query and returns the first row.
 * @param {string} sql The SQL query string.
 * @param {Array} params An array of parameters for the query.
 * @returns {Promise<any>} A promise that resolves with the first row, or undefined.
 */
const dbGet = async (sql, params = []) => {
    try {
        const result = await query(sql, params);
        return result.rows[0];
    } catch (err) {
        console.error('Error running dbGet with SQL: ' + sql);
        console.error(err);
        throw err;
    }
};

/**
 * Runs a SQL query and returns all rows.
 * @param {string} sql The SQL query string.
 * @param {Array} params An array of parameters for the query.
 * @returns {Promise<Array<any>>} A promise that resolves with an array of rows.
 */
const dbAll = async (sql, params = []) => {
    try {
        const result = await query(sql, params);
        return result.rows;
    } catch (err) {
        console.error('Error running dbAll with SQL: ' + sql);
        console.error(err);
        throw err;
    }
};

/**
 * Runs a SQL query (INSERT, UPDATE, DELETE) and returns an object with the number of changed rows.
 * @param {string} sql The SQL query string.
 * @param {Array} params An array of parameters for the query.
 * @returns {Promise<{changes: number}>} A promise that resolves with an object containing the number of rows affected.
 */
const dbRun = async (sql, params = []) => {
    try {
        const result = await query(sql, params);
        return { changes: result.rowCount };
    } catch (err) {
        console.error('Error running dbRun with SQL: ' + sql);
        console.error(err);
        throw err;
    }
};


// --- Database Initialization ---
async function initializeDatabase() {
    console.log('Initializing PostgreSQL database...');

    // Use TEXT for TEXT, VARCHAR for shorter strings, and TIMESTAMPTZ for time zone support.
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE,
            password TEXT NOT NULL,
            steam_id VARCHAR(255),
            role VARCHAR(50) NOT NULL CHECK(role IN ('parent', 'admin')),
            discord_webhook_url TEXT,
            parent_id INTEGER REFERENCES users(id)
        );
    `);
    console.log('Users table is ready.');

    await query(`
        CREATE TABLE IF NOT EXISTS children (
            id SERIAL PRIMARY KEY,
            parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            child_name VARCHAR(255) NOT NULL,
            steam_id VARCHAR(255) NOT NULL UNIQUE,
            playtime_limit_hours INTEGER DEFAULT 20,
            last_notified_at TIMESTAMPTZ
        );
    `);
    console.log('Children table is ready.');

    await query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            checked_steam_id VARCHAR(255) NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('Activity_logs table is ready.');

    // Note: The original playtime_logs and playtime_records tables seemed for logging/caching.
    // They are omitted here for simplicity in the new DB structure but can be added back if needed.

    // --- First-run Admin Setup ---
    const admin = await dbGet('SELECT id FROM users WHERE role = $1', ['admin']);
    if (!admin) {
        console.log('No admin user found. Creating default admin...');
        const adminUsername = 'admin';
        const adminPassword = 'password'; // Advise user to change this
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await dbRun('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', [adminUsername, hashedPassword, 'admin']);
        console.log(`>>> Default admin user '${adminUsername}' created with password '${adminPassword}'.`);
        console.log('--> IMPORTANT: Please log in and change this password in a future update.');
    } else {
        console.log('Admin user already exists.');
    }
}

// --- Child Management Functions ---

// Delete a child by their ID and parent's ID
async function deleteChild(childId, parentId) {
    // PostgreSQL uses $1, $2, etc. for parameters
    return await dbRun('DELETE FROM children WHERE id = $1 AND parent_id = $2', [childId, parentId]);
}

// Update a child's details
async function updateChild(childId, parentId, { child_name, steam_id, playtime_limit_hours }) {
    return await dbRun(
        'UPDATE children SET child_name = $1, steam_id = $2, playtime_limit_hours = $3 WHERE id = $4 AND parent_id = $5',
        [child_name, steam_id, playtime_limit_hours, childId, parentId]
    );
}

// Export the new functions and the pool itself if direct access is needed.
module.exports = { initializeDatabase, dbGet, dbAll, dbRun, deleteChild, updateChild, pool };
