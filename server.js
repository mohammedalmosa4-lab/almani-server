const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket broadcast
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ============== Auth ==============
const ADMIN_PASSWORD = 'admin2121';
const tokens = {};

function generateToken() { return uuidv4().replace(/-/g, '').substring(0, 16); }

// ============== API Routes ==============

// --- Products ---
app.get('/api/products', (req, res) => {
  res.json(db.getProducts());
});

app.post('/api/products', (req, res) => {
  const p = req.body;
  if (!p.name || !p.price) return res.status(400).json({ error: 'name and price required' });
  const product = db.addProduct({
    id: p.id || 'prod_' + Date.now(),
    name: p.name,
    sub: p.sub || '',
    price: parseFloat(p.price),
    image: p.image || '',
    cat: p.cat || '',
    active: p.active !== undefined ? p.active : 1
  });
  broadcast({ type: 'products_changed' });
  res.json(product);
});

app.put('/api/products/:id', (req, res) => {
  const p = req.body;
  const product = db.updateProduct(req.params.id, {
    name: p.name,
    sub: p.sub,
    price: p.price,
    image: p.image,
    cat: p.cat,
    active: p.active
  });
  if (!product) return res.status(404).json({ error: 'not found' });
  broadcast({ type: 'products_changed' });
  res.json(product);
});

app.delete('/api/products/:id', (req, res) => {
  db.deleteProduct(req.params.id);
  broadcast({ type: 'products_changed' });
  res.json({ ok: true });
});

app.post('/api/products/bulk', (req, res) => {
  const products = req.body;
  if (!Array.isArray(products)) return res.status(400).json({ error: 'array expected' });
  db.replaceAllProducts(products);
  broadcast({ type: 'products_changed' });
  res.json({ ok: true });
});

// --- Categories ---
app.get('/api/categories', (req, res) => {
  res.json(db.getCategories());
});

app.post('/api/categories', (req, res) => {
  const c = req.body;
  if (!c.name) return res.status(400).json({ error: 'name required' });
  db.addCategory({ id: c.id || 'cat_' + Date.now(), name: c.name, icon: c.icon || 'fa-tag' });
  res.json({ ok: true });
});

app.delete('/api/categories/:id', (req, res) => {
  db.deleteCategory(req.params.id);
  res.json({ ok: true });
});

// --- Orders ---
app.get('/api/orders', (req, res) => {
  const { phone } = req.query;
  res.json(db.getOrders(phone || null));
});

app.post('/api/orders', (req, res) => {
  const o = req.body;
  if (!o.phone || !o.items) return res.status(400).json({ error: 'phone and items required' });
  const order = db.addOrder({
    id: o.id || 'ord_' + Date.now(),
    phone: o.phone,
    customerName: o.customerName || 'مستخدم',
    address: o.address || '',
    items: o.items,
    total: o.total || 0,
    deliveryFee: o.deliveryFee || 0,
    paymentMethod: o.paymentMethod || o.payment || 'cash',
    txnId: o.txnId || '',
    note: o.note || ''
  });
  // Check if user is banned
  const user = db.getUser(o.phone);
  if (user && user.banned) return res.status(403).json({ error: 'banned' });
  broadcast({ type: 'new_order', order });
  res.json(order);
});

app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  const order = db.updateOrderStatus(req.params.id, status);
  if (!order) return res.status(404).json({ error: 'not found' });
  broadcast({ type: 'order_updated', order });
  res.json(order);
});

// --- Users ---
app.post('/api/users/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  db.upsertUser(phone, null);
  const code = String(Math.floor(1000 + Math.random() * 9000));
  db.saveOTP(phone, code);
  console.log('OTP for ' + phone + ': ' + code);
  res.json({ code });
});

app.post('/api/users/login', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  db.upsertUser(phone, null);
  const code = String(Math.floor(1000 + Math.random() * 9000));
  db.saveOTP(phone, code);
  console.log('OTP for ' + phone + ': ' + code);
  // Try sending via CallMeBot
  const key = db.getSetting('callmebot_key');
  if (key) {
    const msg = encodeURIComponent('رمز التحقق الخاص بك في سوبر ماركت ألماني: ' + code);
    const url = 'https://api.callmebot.com/whatsapp.php?phone=963' + phone + '&text=' + msg + '&apikey=' + key;
    fetch(url).catch(() => {});
  }
  res.json({ ok: true, code_demo: code });
});

app.post('/api/users/verify', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
  if (db.verifyOTP(phone, code)) {
    const token = generateToken();
    tokens[token] = { phone, role: 'user' };
    const user = db.upsertUser(phone, null);
    res.json({ token, user: { phone: user.phone, name: user.name, banned: !!user.banned } });
  } else {
    res.status(401).json({ error: 'invalid code' });
  }
});

app.post('/api/users/update-name', (req, res) => {
  const { token, name } = req.body;
  if (!token || !tokens[token]) return res.status(401).json({ error: 'unauthorized' });
  const { phone } = tokens[token];
  const user = db.upsertUser(phone, name);
  res.json({ user: { phone: user.phone, name: user.name } });
});

// --- Admin ---
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === db.getSetting('admin_password')) {
    const token = generateToken();
    tokens[token] = { role: 'admin' };
    return res.json({ token });
  }
  res.status(401).json({ error: 'wrong password' });
});

app.get('/api/admin/customers', (req, res) => {
  res.json(db.getCustomers());
});

app.post('/api/admin/toggle-ban', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  const user = db.toggleBan(phone);
  res.json({ user: { phone: user.phone, name: user.name, banned: !!user.banned } });
});

// --- Settings ---
app.get('/api/settings', (req, res) => {
  const keys = ['delivery_fee', 'promo_title', 'promo_text', 'promo_btn_text', 'promo_active', 'callmebot_key'];
  const settings = {};
  for (const k of keys) settings[k] = db.getSetting(k) || '';
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    db.setSetting(k, String(v));
  }
  broadcast({ type: 'settings_changed' });
  res.json({ ok: true });
});

// --- Banned check ---
app.get('/api/banned-phones', (req, res) => {
  res.json(db.getBannedPhones());
});

// ============== Start Server ==============
const PORT = process.env.PORT || 9090;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Almani Server running on http://0.0.0.0:' + PORT);
  console.log('WebSocket server ready');
});
