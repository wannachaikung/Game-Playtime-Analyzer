
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const supabase = require('./supabaseClient.js'); // Connect to the database
const bcrypt = require('bcryptjs');
const cron = require('node-cron'); // Import node-cron

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: 'https://game-playtime-analyzer.onrender.com',
    credentials: true
}));
app.use(express.json());

// --- Session Configuration ---
if (!process.env.SESSION_SECRET) {
    throw new Error('FATAL ERROR: SESSION_SECRET is not defined in .env file.');
}
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true, // Prevent client-side script access
        maxAge: 1000 * 60 * 60 * 24 // Cookie expires in 24 hours
    }
}));

app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// --- Authentication Middleware ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: You must be logged in.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admins only.' });
    }
};

// --- Notification Services ---

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendNotificationEmail(recipientEmail, totalPlaytime, limitHours) {
    const playtimeHours = (totalPlaytime / 60).toFixed(2);
    try {
        await transporter.sendMail({
            from: `"Steam Playtime Monitor" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: 'แจ้งเตือนเวลาเล่นเกมเกินกำหนด',
            html: `
                <p>เรียน ผู้ปกครอง,</p>
                <p>บุตรหลานของท่านมีเวลาเล่นเกมสะสมในช่วง 2 สัปดาห์ที่ผ่านมาเกินกำหนดที่ตั้งไว้ (${limitHours * 2} ชั่วโมง)</p>
                <p><b>เวลาเล่นทั้งหมด:</b> ${playtimeHours} ชั่วโมง (${totalPlaytime} นาที)</p>
                <p>จึงเรียนมาเพื่อโปรดทราบ</p>
            `,
        });
        console.log('Notification email sent successfully.');
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

async function sendDiscordNotification(webhookUrl, totalPlaytime, limitHours) {
    if (!webhookUrl) return;

    const playtimeHours = (totalPlaytime / 60).toFixed(2);
    const message = `
        :bell: **แจ้งเตือนเวลาเล่นเกม!** :bell:
        บุตรหลานของท่านเล่นเกมเกินกำหนด (${limitHours} ชม./สัปดาห์)
        **เวลาเล่นทั้งหมด:** ${playtimeHours} ชั่วโมง
    `;

    try {
        await axios.post(webhookUrl, { content: message });
        console.log('Discord notification sent successfully.');
    } catch (error) {
        console.error('Error sending Discord notification:', error.message);
    }
}

// Check playtime for a specific child
app.post('/api/check-playtime/:childId', isAuthenticated, async (req, res) => {
    const { childId } = req.params;
    const parentId = req.session.user.id;

    try {
        // 1. Get child and parent data from Supabase
        const { data: child, error: childError } = await supabase
            .from('children')
            .select('*')
            .match({ id: childId, parent_id: parentId })
            .single();

        if (childError || !child) {
            return res.status(404).json({ error: 'Child not found or you do not have permission.' });
        }

        const { data: parent, error: parentError } = await supabase
            .from('users')
            .select('email, discord_webhook_url')
            .eq('id', parentId)
            .single();

        if (parentError || !parent) {
            return res.status(404).json({ error: 'Parent user not found.' });
        }

        // 2. Fetch from Steam API
        const apiKey = process.env.STEAM_API_KEY;
        const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${child.steam_id}&format=json`;
        
        const response = await axios.get(url);
        const data = response.data.response;

        if (!data.games) {
            return res.json({ message: 'No recent game data found for this child.' });
        }

        const totalPlaytimeMinutes = data.games.reduce((acc, game) => acc + game.playtime_2weeks, 0);
        const twoWeekLimitMinutes = child.playtime_limit_hours * 60 * 2;

        // 3. Check against limit and send notifications
        if (totalPlaytimeMinutes > twoWeekLimitMinutes) {
            if (parent.email) {
                await sendNotificationEmail(parent.email, totalPlaytimeMinutes, child.playtime_limit_hours);
            }
            if (parent.discord_webhook_url) {
                await sendDiscordNotification(parent.discord_webhook_url, totalPlaytimeMinutes, child.playtime_limit_hours);
            }
        }

        // 4. Log activity to Supabase
        await supabase.from('activity_logs').insert([{ user_id: parentId, checked_steam_id: child.steam_id }]);

        res.json({
            total_playtime_minutes: totalPlaytimeMinutes,
            total_playtime_hours: (totalPlaytimeMinutes / 60).toFixed(2),
            limit_hours: child.playtime_limit_hours,
            is_over_limit: totalPlaytimeMinutes > twoWeekLimitMinutes,
            games: data.games.map(g => ({
                name: g.name || 'Unknown Game',
                playtime_2weeks: g.playtime_2weeks || 0,
                playtime_forever: g.playtime_forever || 0,
                appid: g.appid,
                img_icon_url: g.img_icon_url || ''
            }))
        });

    } catch (error) {
        console.error('Error in check-playtime:', error);
        res.status(500).json({ error: 'An error occurred while checking playtime.' });
    }
});


// --- Main API Endpoint ---

app.post('/api/check-playtime', async (req, res) => {
    const { steamId, parentEmail, discordWebhookUrl } = req.body; // Updated to accept discordWebhookUrl
    const apiKey = process.env.STEAM_API_KEY;
    const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${steamId}&format=json`;

    if (!steamId) {
        return res.status(400).json({ error: 'กรุณากรอก Steam ID' });
    }

    try {
        // --- Get Playtime Data from Steam ---
        const response = await axios.get(url);
        const data = response.data.response;

        if (!data.games) {
            return res.json({
                total_playtime_minutes: 0,
                game_count: 0,
                games: [],
                message: 'ไม่พบข้อมูลเกมที่เล่นล่าสุด หรือโปรไฟล์อาจเป็นส่วนตัว'
            });
        }

        const totalPlaytimeMinutes = data.games.reduce((acc, game) => acc + game.playtime_2weeks, 0);

        // --- Use a fixed threshold for now ---
        const weeklyLimitHours = 40; // Default value
        const playtimeThreshold = weeklyLimitHours * 2 * 60; // Threshold for 2 weeks in minutes

        // --- Send Notifications if Threshold Exceeded ---
        if (totalPlaytimeMinutes > playtimeThreshold) {
            if (parentEmail) {
                await sendNotificationEmail(parentEmail, totalPlaytimeMinutes, weeklyLimitHours);
            }
            if (discordWebhookUrl) { // Changed from lineToken
                await sendDiscordNotification(discordWebhookUrl, totalPlaytimeMinutes, weeklyLimitHours);
            }
        }

        // --- Save Record and Log Activity ---
        const timestamp = new Date().toISOString();
        db.run(`INSERT INTO playtime_records (steam_id, total_playtime_minutes, timestamp) VALUES (?, ?, ?)`, 
            [steamId, totalPlaytimeMinutes, timestamp]);

        // Log the activity if a logged-in user made the request
        if (req.session.user) {
            db.run(`INSERT INTO activity_logs (user_id, checked_steam_id) VALUES (?, ?)`, 
                [req.session.user.id, steamId]);
        }

        res.json({
            total_playtime_minutes: totalPlaytimeMinutes,
            total_playtime_hours: (totalPlaytimeMinutes / 60).toFixed(2),
            game_count: data.total_count,
            games: data.games.map(g => ({ 
                name: g.name, 
                playtime_2weeks: g.playtime_2weeks, 
                playtime_forever: g.playtime_forever, 
                appid: g.appid,
                img_icon_url: g.img_icon_url // <-- Added this line
            }))
        });

    } catch (error) {
        console.error('Error fetching Steam API:', error);
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            return res.status(401).json({ error: 'Steam API Key ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง กรุณาตรวจสอบไฟล์ .env ของคุณ' });
        }
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสื่อสารกับ Steam API. อาจเป็นเพราะ Steam ID ไม่ถูกต้อง หรือโปรไฟล์ยังคงเป็นส่วนตัว' });
    }
});

app.get('/api/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Authentication API Endpoints ---

// Register a new user
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Please provide username, password, and role.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const { error } = await supabase
            .from('users')
            .insert([{ username, password: hashedPassword, role }]);

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({ error: 'Username already exists.' });
            }
            throw error;
        }

        res.status(201).json({ message: 'User registered successfully!' });

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// Login a user
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Please provide username and password.' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // --- Create Session ---
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            steam_id: user.steam_id
        };

        // Omit password from the response
        const { password: _, ...userWithoutPassword } = user;
        res.json({ message: 'Login successful!', user: userWithoutPassword });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// Logout a user
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to log out.' });
        }
        res.clearCookie('connect.sid'); // Clears the session cookie
        res.json({ message: 'Logout successful!' });
    });
});

// --- User Settings API Endpoints ---

// Get current user's settings
app.get('/api/user/settings', isAuthenticated, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('email, discord_webhook_url')
            .eq('id', req.session.user.id)
            .single();

        if (error) throw error;

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user settings:', error);
        res.status(500).json({ error: 'Failed to retrieve user settings.' });
    }
});

// Update user's settings
app.put('/api/user/settings', isAuthenticated, async (req, res) => {
    const { discord_webhook_url } = req.body;
    const userId = req.session.user.id;

    // Basic validation for the webhook URL
    if (discord_webhook_url && !discord_webhook_url.startsWith('https://discord.com/api/webhooks/')) {
        return res.status(400).json({ error: 'Invalid Discord webhook URL format.' });
    }

    try {
        const { error } = await supabase
            .from('users')
            .update({ discord_webhook_url: discord_webhook_url || null })
            .eq('id', userId);

        if (error) throw error;

        res.json({ message: 'Settings updated successfully!' });
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
});


// --- Admin API Endpoints ---
// Admin: Get all users
app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, role, steam_id, email, discord_webhook_url');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching users:', error.message);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// Admin: Create a new user
app.post('/api/admin/users/create', isAuthenticated, isAdmin, async (req, res) => {
    const { username, password, role, email, discord_webhook_url } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Please provide username, password, and role.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const { data, error } = await supabase
            .from('users')
            .insert([{ 
                username, 
                password: hashedPassword, 
                role, 
                email: email || null, 
                discord_webhook_url: discord_webhook_url || null 
            }])
            .select();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({ error: 'Username or Email already exists.' });
            }
            throw error;
        }
        res.status(201).json({ message: 'User created successfully!', userId: data[0].id });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Server error during user creation.' });
    }
});

// Admin: Update an existing user
app.put('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { username, role, email, discord_webhook_url } = req.body;

    if (!username || !role) {
        return res.status(400).json({ error: 'Please provide username and role.' });
    }

    try {
        const { count, error } = await supabase
            .from('users')
            .update({ 
                username, 
                role, 
                email: email || null, 
                discord_webhook_url: discord_webhook_url || null 
            })
            .eq('id', id);

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Username or Email already exists.' });
            }
            throw error;
        }

        if (count === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ message: 'User updated successfully!' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Server error during user update.' });
    }
});

// Admin: Delete a user
app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const { count, error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;

        if (count === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ message: 'User deleted successfully!' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Server error during user deletion.' });
    }
});

app.get('/api/admin/activity', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('activity_logs')
            .select(`
                id,
                checked_steam_id,
                timestamp,
                users ( username )
            `)
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Remap the data to match the old structure for the frontend
        const formattedData = data.map(log => ({
            id: log.id,
            parent_username: log.users ? log.users.username : 'Unknown',
            checked_steam_id: log.checked_steam_id,
            timestamp: log.timestamp
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching activity log:', error.message);
        res.status(500).json({ error: 'Failed to retrieve activity log.' });
    }
});

// --- Children API Endpoints ---

// Get all children for the logged-in parent
app.get('/api/children', isAuthenticated, async (req, res) => {
    try {
        const { data: children, error } = await supabase
            .from('children')
            .select('*')
            .eq('parent_id', req.session.user.id);

        if (error) throw error;
        res.json(children);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve children.' });
    }
});

// Add a new child
app.post('/api/children', isAuthenticated, async (req, res) => {
    const { child_name, steam_id, playtime_limit_hours } = req.body;
    const parent_id = req.session.user.id;

    if (!child_name || !steam_id || !playtime_limit_hours) {
        return res.status(400).json({ error: 'Please provide name, Steam ID, and playtime limit.' });
    }

    try {
        const { data, error } = await supabase
            .from('children')
            .insert([{ parent_id, child_name, steam_id, playtime_limit_hours }])
            .select();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({ error: 'This Steam ID is already registered.' });
            }
            throw error;
        }
        res.status(201).json({ message: 'Child added successfully!', child: data[0] });
    } catch (error) {
        console.error('!!! Error adding child to database:', error);
        res.status(500).json({ error: `Failed to add child. Database error: ${error.message}` });
    }
});

// Delete a child
app.delete('/api/children/:id', isAuthenticated, async (req, res) => {
    const childId = req.params.id;
    const parentId = req.session.user.id;

    try {
        const { error, count } = await supabase
            .from('children')
            .delete()
            .match({ id: childId, parent_id: parentId });

        if (error) throw error;

        if (count === 0) {
            return res.status(404).json({ error: 'Child not found or you do not have permission.' });
        }
        res.json({ message: 'Child deleted successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete child.' });
    }
});

// Update a child
app.put('/api/children/:id', isAuthenticated, async (req, res) => {
    const childId = req.params.id;
    const parentId = req.session.user.id;
    const { child_name, steam_id, playtime_limit_hours } = req.body;

    if (!child_name || !steam_id || !playtime_limit_hours) {
        return res.status(400).json({ error: 'Please provide name, Steam ID, and playtime limit.' });
    }

    try {
        const { error, count } = await supabase
            .from('children')
            .update({ child_name, steam_id, playtime_limit_hours })
            .match({ id: childId, parent_id: parentId });

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'This Steam ID is already registered to another child.' });
            }
            throw error;
        }

        if (count === 0) {
            return res.status(404).json({ error: 'Child not found or you do not have permission.' });
        }
        res.json({ message: 'Child updated successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update child.' });
    }
});

// --- Automated Playtime Check ---
async function checkAllChildrenPlaytime() {
    console.log('Running scheduled job: Checking playtime for all children...');
    try {
        const children = await dbAll('SELECT * FROM children');

        for (const child of children) {
            const parent = await dbGet('SELECT email, discord_webhook_url FROM users WHERE id = ?', [child.parent_id]);
            if (!parent) {
                console.log(`Parent not found for child ID ${child.id}, skipping.`);
                continue;
            }

            // Prevent notification spam: check if notified in the last 24 hours
            if (child.last_notified_at) {
                const lastNotifiedDate = new Date(child.last_notified_at);
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                if (lastNotifiedDate > twentyFourHoursAgo) {
                    console.log(`Notification for child ID ${child.id} (${child.child_name}) was sent recently. Skipping.`);
                    continue;
                }
            }

            const apiKey = process.env.STEAM_API_KEY;
            const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${child.steam_id}&format=json`;

            try {
                const response = await axios.get(url);
                const data = response.data.response;

                if (!data.games || data.games.length === 0) {
                    console.log(`No recent game data for child ${child.child_name} (Steam ID: ${child.steam_id}).`);
                    continue;
                }

                const totalPlaytimeMinutes = data.games.reduce((acc, game) => acc + game.playtime_2weeks, 0);
                const twoWeekLimitMinutes = child.playtime_limit_hours * 60 * 2;

                if (totalPlaytimeMinutes > twoWeekLimitMinutes) {
                    console.log(`Playtime limit exceeded for ${child.child_name}. Sending notifications.`);
                    if (parent.email) {
                        await sendNotificationEmail(parent.email, totalPlaytimeMinutes, child.playtime_limit_hours);
                    }
                    if (parent.discord_webhook_url) {
                        await sendDiscordNotification(parent.discord_webhook_url, totalPlaytimeMinutes, child.playtime_limit_hours);
                    }
                    
                    // Update timestamp after sending notification
                    await dbRun('UPDATE children SET last_notified_at = ? WHERE id = ?', [new Date().toISOString(), child.id]);
                }
            } catch (apiError) {
                console.error(`Error fetching Steam API for child ${child.child_name} (Steam ID: ${child.steam_id}):`, apiError.message);
            }
        }
    } catch (dbError) {
        console.error('Error during scheduled playtime check:', dbError);
    }
    console.log('Scheduled job finished.');
}



    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
