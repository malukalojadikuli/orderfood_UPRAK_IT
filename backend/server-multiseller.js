const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ===== SETUP =====
const app = express();
const PORT = process.env.PORT || 3000;

// Database path
const DB_DIR = path.join(__dirname, 'database');
const DB_PATH = path.join(DB_DIR, 'database.db');

// Create database directory if it doesn't exist
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log(`📁 Created database directory at: ${DB_DIR}`);
}

// Middleware
app.use(cors());
app.use(express.json());

// ===== DATABASE CONNECTION =====
let db = null;
const MAX_RETRIES = 3;
let retryCount = 0;

function connectDatabase() {
    try {
        db = new Database(DB_PATH, { 
            fileMustExist: false,
            timeout: 5000,
        });
        
        db.pragma('journal_mode = WAL');
        
        console.log(`✅ Database connected at: ${DB_PATH}`);
        retryCount = 0;
        return true;
    } catch (error) {
        console.error(`❌ Database connection failed: ${error.message}`);
        
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`🔄 Retrying in 2 seconds... (Attempt ${retryCount}/${MAX_RETRIES})`);
            setTimeout(connectDatabase, 2000);
        } else {
            console.error('🚨 Max retries reached. Cannot start server without database.');
            process.exit(1);
        }
        return false;
    }
}

connectDatabase();

// ===== SELLER CREDENTIALS & LOCATIONS =====
const SELLERS = {
    seller1: {
        password: 'seller1password',
        location: 'Harmoni',
        displayName: 'Kopi & Snack - Harmoni'
    },
    seller2: {
        password: 'seller2password',
        location: 'Bulevar',
        displayName: 'Kopi & Snack - Bulevar'
    }
};

// ===== DATABASE INITIALIZATION =====
function initDb() {
    if (!db) {
        console.error('Database not ready');
        return;
    }

    try {
        // Create menu table (each seller has their own menu)
        db.exec(`
            CREATE TABLE IF NOT EXISTS menu (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id TEXT NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                category TEXT NOT NULL DEFAULT 'coffee',
                emoji TEXT DEFAULT '☕',
                stock INTEGER NOT NULL DEFAULT 10,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(seller_id, name),
                FOREIGN KEY (seller_id) REFERENCES sellers(id)
            )
        `);

        // Create sellers table
        db.exec(`
            CREATE TABLE IF NOT EXISTS sellers (
                id TEXT PRIMARY KEY,
                location TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create orders table (orders belong to a location/seller)
        db.exec(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                seller_id TEXT NOT NULL,
                customer_name TEXT NOT NULL,
                pickup_location TEXT NOT NULL,
                total REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES sellers(id)
            )
        `);

        // Create order_items table
        db.exec(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                menu_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (menu_id) REFERENCES menu(id)
            )
        `);

        // Create order_history table for audit trail
        db.exec(`
            CREATE TABLE IF NOT EXISTS order_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                old_status TEXT,
                new_status TEXT,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            )
        `);

        // Insert sellers if they don't exist
        const sellersCount = db.prepare('SELECT COUNT(*) as count FROM sellers').get().count;
        if (sellersCount === 0) {
            console.log('📝 Inserting sellers...');
            Object.entries(SELLERS).forEach(([seller_id, seller_info]) => {
                try {
                    db.prepare(`
                        INSERT INTO sellers (id, location, display_name)
                        VALUES (?, ?, ?)
                    `).run(seller_id, seller_info.location, seller_info.displayName);
                    console.log(`✅ Seller ${seller_id} created at ${seller_info.location}`);
                } catch (err) {
                    if (!err.message.includes('UNIQUE constraint failed')) {
                        console.error(`Error inserting seller ${seller_id}:`, err.message);
                    }
                }
            });
        }

        // Insert default menu for each seller if empty
        const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu').get().count;
        if (menuCount === 0) {
            console.log('📝 Inserting default menu items for each seller...');
            const insertMenu = db.prepare(`
                INSERT INTO menu (seller_id, name, price, category, emoji, stock)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            const defaultItems = [
                ['Latte', 35000, 'coffee', '☕', 15],
                ['Americano', 28000, 'coffee', '☕', 15],
                ['Cappuccino', 32000, 'coffee', '☕', 15],
                ['Croissant', 22000, 'snack', '🥐', 20],
                ['Chocolate Bread', 18000, 'snack', '🍞', 20],
                ['Choco Chip Cookies', 15000, 'snack', '🍪', 25],
                ['Waffles', 32000, 'snack', '🧇', 15],
                ['Beef Wellington', 95000, 'menu', '🥩', 8],
                ['Spaghetti Carbonara', 45000, 'menu', '🍝', 12],
                ['Ice Tea', 12000, 'nonCoffee', '🥤', 20],
            ];

            // Insert for each seller
            Object.keys(SELLERS).forEach(seller_id => {
                defaultItems.forEach(item => {
                    try {
                        insertMenu.run(seller_id, ...item);
                    } catch (err) {
                        // Ignore duplicate entries
                    }
                });
            });
            console.log(`✅ Default menu items inserted for all sellers`);
        }

    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
    }
}

if (db) {
    initDb();
}

// Serve frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ===== AUTHENTICATION MIDDLEWARE =====
function authenticateSeller(req, res, next) {
    const { seller_id, password } = req.body;

    if (!seller_id || !password) {
        return res.status(401).json({ error: 'Missing seller_id or password' });
    }

    const seller = SELLERS[seller_id];
    if (!seller || seller.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.seller_id = seller_id;
    req.seller_location = seller.location;
    next();
}

// Middleware to extract seller from headers
function getSellerId(req, res, next) {
    const seller_id = req.headers['x-seller-id'];
    if (!seller_id || !SELLERS[seller_id]) {
        return res.status(401).json({ error: 'Missing or invalid seller_id header' });
    }
    req.seller_id = seller_id;
    req.seller_location = SELLERS[seller_id].location;
    next();
}

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    try {
        const result = db.prepare('SELECT 1').get();
        res.json({ 
            status: 'ok', 
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'error', 
            database: 'disconnected',
            message: error.message 
        });
    }
});

// ===== CONFIG ENDPOINT =====
app.get('/api/config', (req, res) => {
    const ngrokUrl = process.env.NGROK_URL || `http://localhost:${PORT}`;
    res.json({
        apiUrl: ngrokUrl + '/api',
        ngrokUrl: ngrokUrl,
        locations: Object.values(SELLERS).map(s => ({
            id: Object.keys(SELLERS).find(k => SELLERS[k] === s),
            name: s.location,
            displayName: s.displayName
        }))
    });
});

// ===== SELLER AUTH ENDPOINT =====
app.post('/api/seller/login', (req, res) => {
    const { seller_id, password } = req.body;

    if (!seller_id || !password) {
        return res.status(400).json({ error: 'Missing seller_id or password' });
    }

    const seller = SELLERS[seller_id];
    if (!seller || seller.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
        success: true,
        seller_id: seller_id,
        location: seller.location,
        displayName: seller.displayName
    });
});

// ===== MENU ROUTES =====

// GET /api/menu - Get menu for all locations OR specific seller
app.get('/api/menu', (req, res) => {
    try {
        const location = req.query.location;
        
        let menu;
        if (location) {
            // Get menu for specific location (buyer view)
            const seller_id = Object.keys(SELLERS).find(k => SELLERS[k].location === location);
            if (!seller_id) {
                return res.status(404).json({ error: 'Location not found' });
            }
            menu = db.prepare('SELECT * FROM menu WHERE seller_id = ? ORDER BY id').all(seller_id);
        } else {
            // Get all menu (should require auth)
            menu = db.prepare('SELECT * FROM menu ORDER BY seller_id, id').all();
        }
        
        res.json(menu);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/seller/menu - Get menu for authenticated seller
app.get('/api/seller/menu', getSellerId, (req, res) => {
    try {
        const menu = db.prepare('SELECT * FROM menu WHERE seller_id = ? ORDER BY id').all(req.seller_id);
        res.json(menu);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/seller/menu - Add menu item (seller only)
app.post('/api/seller/menu', getSellerId, (req, res) => {
    try {
        const { name, price, category, emoji, stock } = req.body;
        
        if (!name || price === undefined || !category) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = db.prepare(`
            INSERT INTO menu (seller_id, name, price, category, emoji, stock)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(req.seller_id, name, price, category, emoji || '☕', stock ?? 10);

        const newItem = db.prepare('SELECT * FROM menu WHERE id = ?').get(result.lastInsertRowid);
        res.json({ success: true, item: newItem });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/seller/menu/:id - Update menu item
app.put('/api/seller/menu/:id', getSellerId, (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, category, emoji, stock } = req.body;

        const item = db.prepare('SELECT * FROM menu WHERE id = ? AND seller_id = ?').get(id, req.seller_id);
        if (!item) return res.status(404).json({ error: 'Menu not found' });

        db.prepare(`
            UPDATE menu SET name = ?, price = ?, category = ?, emoji = ?, stock = ?
            WHERE id = ? AND seller_id = ?
        `).run(
            name ?? item.name,
            price ?? item.price,
            category ?? item.category,
            emoji ?? item.emoji,
            stock ?? item.stock,
            id,
            req.seller_id
        );

        const updated = db.prepare('SELECT * FROM menu WHERE id = ?').get(id);
        res.json({ success: true, item: updated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/seller/menu/:id/stock - Update stock
app.patch('/api/seller/menu/:id/stock', getSellerId, (req, res) => {
    try {
        const { id } = req.params;
        const { change } = req.body;

        const item = db.prepare('SELECT * FROM menu WHERE id = ? AND seller_id = ?').get(id, req.seller_id);
        if (!item) return res.status(404).json({ error: 'Menu not found' });

        const newStock = Math.max(0, item.stock + change);
        db.prepare('UPDATE menu SET stock = ? WHERE id = ? AND seller_id = ?').run(newStock, id, req.seller_id);

        res.json({ success: true, stock: newStock });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/seller/menu/:id - Delete menu item
app.delete('/api/seller/menu/:id', getSellerId, (req, res) => {
    try {
        const { id } = req.params;
        const item = db.prepare('SELECT * FROM menu WHERE id = ? AND seller_id = ?').get(id, req.seller_id);
        if (!item) return res.status(404).json({ error: 'Menu not found' });

        db.prepare('DELETE FROM menu WHERE id = ? AND seller_id = ?').run(id, req.seller_id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== ORDER ROUTES =====

// GET /api/orders - Get orders for specific location (buyer view)
app.get('/api/orders', (req, res) => {
    try {
        const location = req.query.location;
        
        let orders;
        if (location) {
            // Get orders for specific location
            const seller_id = Object.keys(SELLERS).find(k => SELLERS[k].location === location);
            if (!seller_id) {
                return res.status(404).json({ error: 'Location not found' });
            }
            orders = db.prepare('SELECT * FROM orders WHERE seller_id = ? AND pickup_location = ? ORDER BY created_at DESC')
                .all(seller_id, location);
        } else {
            // Get all orders
            orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
        }

        const ordersWithItems = orders.map(order => {
            const items = db.prepare(`
                SELECT order_items.quantity, order_items.price, menu.name, menu.emoji
                FROM order_items
                JOIN menu ON order_items.menu_id = menu.id
                WHERE order_items.order_id = ?
            `).all(order.id);

            return { ...order, items };
        });

        res.json(ordersWithItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/seller/orders - Get orders for authenticated seller only
app.get('/api/seller/orders', getSellerId, (req, res) => {
    try {
        const orders = db.prepare('SELECT * FROM orders WHERE seller_id = ? ORDER BY created_at DESC')
            .all(req.seller_id);

        const ordersWithItems = orders.map(order => {
            const items = db.prepare(`
                SELECT order_items.quantity, order_items.price, menu.name, menu.emoji
                FROM order_items
                JOIN menu ON order_items.menu_id = menu.id
                WHERE order_items.order_id = ?
            `).all(order.id);

            return { ...order, items };
        });

        res.json(ordersWithItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/orders - Create order
app.post('/api/orders', (req, res) => {
    try {
        const { id, customer_name, pickup_location, total, items } = req.body;

        if (!id || !customer_name || !pickup_location || !total || !items) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Find seller by location
        const seller_id = Object.keys(SELLERS).find(k => SELLERS[k].location === pickup_location);
        if (!seller_id) {
            return res.status(400).json({ error: 'Invalid pickup location' });
        }

        const insertOrder = db.transaction(() => {
            // Check stock for all items
            for (const item of items) {
                const menuItem = db.prepare('SELECT * FROM menu WHERE id = ? AND seller_id = ?')
                    .get(item.menu_id, seller_id);
                if (!menuItem) {
                    throw new Error(`Menu item ${item.menu_id} not found`);
                }
                if (menuItem.stock < item.quantity) {
                    throw new Error(`Stok ${menuItem.name} tidak cukup. Tersisa: ${menuItem.stock}`);
                }
            }

            // Insert order
            db.prepare(`
                INSERT INTO orders (id, seller_id, customer_name, pickup_location, total, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            `).run(id, seller_id, customer_name, pickup_location, total);

            // Insert items and deduct stock
            const insertItem = db.prepare(`
                INSERT INTO order_items (order_id, menu_id, quantity, price)
                VALUES (?, ?, ?, ?)
            `);

            items.forEach(item => {
                insertItem.run(id, item.menu_id, item.quantity, item.price);
                db.prepare('UPDATE menu SET stock = stock - ? WHERE id = ?')
                    .run(item.quantity, item.menu_id);
            });
        });

        insertOrder();
        res.json({ success: true, orderId: id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PATCH /api/seller/orders/:id/status - Update order status (seller only)
app.patch('/api/seller/orders/:id/status', getSellerId, (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'accepted', 'ready', 'done', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = db.prepare('SELECT * FROM orders WHERE id = ? AND seller_id = ?').get(id, req.seller_id);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const updateStatus = db.transaction(() => {
            db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(status, id);
            
            db.prepare(`
                INSERT INTO order_history (order_id, old_status, new_status)
                VALUES (?, ?, ?)
            `).run(id, order.status, status);
        });

        updateStatus();
        res.json({ success: true, status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        message: err.message 
    });
});

// ===== START SERVER =====
const server = app.listen(PORT, () => {
    console.log(`   Buyer  → http://localhost:${PORT}/index-multiseller.html`);
    console.log(`   Seller → http://localhost:${PORT}/seller-multiseller.html`);
    console.log(`\n📡 Sellers:`);
    Object.entries(SELLERS).forEach(([id, info]) => {
        console.log(`   ${id} (${info.location}): ${info.password}`);
    });
    console.log(`${'='.repeat(50)}\n`);
});