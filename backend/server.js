const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

// ===== SETUP =====
const app = express();
const PORT = 3000;

// Middleware - allows server to read JSON and accept requests from frontend
app.use(cors());
app.use(express.json());

// Connect to database
const dbPath = path.join(__dirname, 'database/database.db');
const db = new Database(dbPath);

// Initialize database schema if needed
const initDb = () => {
    // Create menu table
    db.exec(`
        CREATE TABLE IF NOT EXISTS menu (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT NOT NULL DEFAULT 'coffee',
            emoji TEXT DEFAULT '☕',
            stock INTEGER NOT NULL DEFAULT 10,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create orders table
    db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            pickup_location TEXT NOT NULL,
            total REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (menu_id) REFERENCES menu(id)
        )
    `);

    // Insert sample menu items if table is empty
    const count = db.prepare('SELECT COUNT(*) as count FROM menu').get().count;
    if (count === 0) {
        const insertMenu = db.prepare(`
            INSERT INTO menu (name, price, category, emoji, stock)
            VALUES (?, ?, ?, ?, ?)
        `);

        // Coffee
        insertMenu.run('Espresso', 25000, 'coffee', '☕', 10);
        insertMenu.run('Cappuccino', 32000, 'coffee', '☕', 10);
        insertMenu.run('Latte', 35000, 'coffee', '☕', 10);

        // Non-Coffee
        insertMenu.run('Teh Manis', 5000, 'nonCoffee', '🥤', 50);
        insertMenu.run('Jus Jeruk', 15000, 'nonCoffee', '🥤', 20);
        insertMenu.run('Smoothie', 28000, 'nonCoffee', '🥤', 15);

        // Snack
        insertMenu.run('Kue Coklat', 20000, 'snack', '🍰', 15);
        insertMenu.run('Croissant', 18000, 'snack', '🍰', 12);
        insertMenu.run('Donut', 12000, 'snack', '🍰', 25);
    }
};

initDb();

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));


// ===== MENU ROUTES =====

// GET /api/menu - fetch all menu items
app.get('/api/menu', (req, res) => {
    const menu = db.prepare('SELECT * FROM menu').all();
    res.json(menu);
});

// PATCH /api/menu/:id/stock - update stock of a menu item
app.patch('/api/menu/:id/stock', (req, res) => {
    const { id } = req.params;
    const { change } = req.body;

    const item = db.prepare('SELECT * FROM menu WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'Menu not found' });

    const newStock = Math.max(0, item.stock + change);
    db.prepare('UPDATE menu SET stock = ? WHERE id = ?').run(newStock, id);

    res.json({ success: true, stock: newStock });
});

// PATCH /api/menu/:id/soldout - toggle sold out
app.patch('/api/menu/:id/soldout', (req, res) => {
    const { id } = req.params;

    const item = db.prepare('SELECT * FROM menu WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'Menu not found' });

    const newStock = item.stock === 0 ? 10 : 0;
    db.prepare('UPDATE menu SET stock = ? WHERE id = ?').run(newStock, id);

    res.json({ success: true, stock: newStock });
});


// ===== ORDER ROUTES =====

// GET /api/orders - fetch all orders with their items
app.get('/api/orders', (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();

    // Attach items to each order
    const ordersWithItems = orders.map(order => {
        const items = db.prepare(`
            SELECT order_items.quantity, order_items.price, menu.name
            FROM order_items
            JOIN menu ON order_items.menu_id = menu.id
            WHERE order_items.order_id = ?
        `).all(order.id);

        return { ...order, items };
    });

    res.json(ordersWithItems);
});

// POST /api/orders - buyer creates a new order
app.post('/api/orders', (req, res) => {
    const { id, customer_name, pickup_location, total, items } = req.body;

    if (!id || !customer_name || !pickup_location || !total || !items) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Save order
    db.prepare(`
        INSERT INTO orders (id, customer_name, pickup_location, total, status)
        VALUES (?, ?, ?, ?, 'pending')
    `).run(id, customer_name, pickup_location, total);

    // Save each item
    const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, menu_id, quantity, price)
        VALUES (?, ?, ?, ?)
    `);

    items.forEach(item => {
        insertItem.run(id, item.menu_id, item.quantity, item.price);
    });

    res.json({ success: true, orderId: id });
});

// PATCH /api/orders/:id/status - seller updates order status
app.patch('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'accepted', 'ready', 'done', 'rejected'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);

    res.json({ success: true, status });
});


// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`   Buyer  → http://localhost:${PORT}/index.html`);
    console.log(`   Seller → http://localhost:${PORT}/seller.html`);
});