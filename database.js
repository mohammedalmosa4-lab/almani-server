const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'almani.json');

function read() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch(e) { return null; }
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function init() {
  if (fs.existsSync(DB_PATH)) return;
  write({
    products: [],
    categories: [
      { id:'cat_1', name:'خضروات', icon:'fa-carrot' },
      { id:'cat_2', name:'فواكه', icon:'fa-apple-whole' },
      { id:'cat_3', name:'ألبان', icon:'fa-cheese' },
      { id:'cat_4', name:'لحوم', icon:'fa-drumstick-bite' },
      { id:'cat_5', name:'مشروبات', icon:'fa-mug-hot' },
      { id:'cat_6', name:'منظفات', icon:'fa-spray-can-sparkles' },
      { id:'cat_7', name:'معلبات', icon:'fa-fish' },
      { id:'cat_8', name:'حلويات', icon:'fa-cookie-bite' },
      { id:'cat_9', name:'مخبوزات', icon:'fa-bread-slice' },
      { id:'cat_10', name:'أخرى', icon:'fa-tag' }
    ],
    orders: [],
    settings: {
      delivery_fee: '2000',
      admin_password: 'admin2121',
      promo_title: 'عروض اليوم',
      promo_text: 'خصومات تصل إلى 30% على الخضار والفواكه الطازجة',
      promo_btn_text: 'تسوّق الآن',
      promo_active: '1',
      callmebot_key: ''
    },
    users: [],
    otp_codes: []
  });
}

// ========== Products ==========
function getProducts() {
  const d = read();
  return d ? d.products : [];
}
function getProduct(id) {
  const d = read();
  return d ? d.products.find(p => p.id === id) : null;
}
function addProduct({ id, name, sub, price, image, cat, unit, badge, discount, active }) {
  const d = read();
  const p = { id, name, sub: sub || '', price: parseFloat(price) || 0, image: image || '', cat: cat || '', unit: unit || '', badge: badge || '', discount: parseInt(discount) || 0, active: active !== undefined ? (active ? 1 : 0) : 1 };
  d.products.unshift(p);
  write(d);
  return p;
}
function updateProduct(id, { name, sub, price, image, cat, unit, badge, discount, active }) {
  const d = read();
  const idx = d.products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const p = d.products[idx];
  if (name !== undefined) p.name = name;
  if (sub !== undefined) p.sub = sub;
  if (price !== undefined) p.price = parseFloat(price);
  if (image !== undefined) p.image = image;
  if (cat !== undefined) p.cat = cat;
  if (unit !== undefined) p.unit = unit;
  if (badge !== undefined) p.badge = badge;
  if (discount !== undefined) p.discount = parseInt(discount);
  if (active !== undefined) p.active = active ? 1 : 0;
  write(d);
  return p;
}
function deleteProduct(id) {
  const d = read();
  d.products = d.products.filter(p => p.id !== id);
  write(d);
}
function replaceAllProducts(products) {
  const d = read();
  d.products = products.map(p => ({
    id: String(p.id), name: p.name, sub: p.sub || '', price: parseFloat(p.price) || 0,
    image: p.image || '', cat: p.cat || '', unit: p.unit || '', badge: p.badge || '',
    discount: parseInt(p.discount) || 0, active: p.active !== undefined ? (p.active ? 1 : 0) : 1
  }));
  write(d);
}

// ========== Categories ==========
function getCategories() {
  const d = read();
  return d ? d.categories : [];
}
function addCategory({ id, name, icon }) {
  const d = read();
  d.categories.push({ id, name, icon: icon || 'fa-tag' });
  write(d);
}
function deleteCategory(id) {
  const d = read();
  if (d.categories.length > 1) d.categories = d.categories.filter(c => c.id !== id);
  write(d);
}

// ========== Orders ==========
function mapOrder(o) {
  return { id: o.id, phone: o.phone, customerName: o.customer_name, address: o.address, items: o.items, total: o.total, deliveryFee: o.delivery_fee, paymentMethod: o.payment_method, txnId: o.txn_id, note: o.note, status: o.status, date: o.created_at };
}
function getOrders(phone) {
  const d = read();
  if (!d) return [];
  let orders = d.orders.map(mapOrder);
  if (phone) orders = orders.filter(o => o.phone === phone);
  return orders.sort((a, b) => new Date(b.date) - new Date(a.date));
}
function getOrder(id) {
  const d = read();
  const o = d ? d.orders.find(or => or.id === id) : null;
  return o ? mapOrder(o) : null;
}
function addOrder({ id, phone, customerName, address, items, total, deliveryFee, paymentMethod, txnId, note }) {
  const d = read();
  const o = { id, phone, customer_name: customerName || 'مستخدم', address: address || '', items: typeof items === 'string' ? items : JSON.stringify(items), total: parseFloat(total) || 0, delivery_fee: parseFloat(deliveryFee) || 0, payment_method: paymentMethod || 'cash', txn_id: txnId || '', note: note || '', status: 'pending', created_at: new Date().toISOString() };
  d.orders.unshift(o);
  write(d);
  return mapOrder(o);
}
function updateOrderStatus(id, status) {
  const d = read();
  const o = d.orders.find(or => or.id === id);
  if (!o) return null;
  o.status = status;
  write(d);
  return mapOrder(o);
}

// ========== Users ==========
function getUser(phone) {
  const d = read();
  return d ? d.users.find(u => u.phone === phone) : null;
}
function upsertUser(phone, name) {
  const d = read();
  let u = d.users.find(us => us.phone === phone);
  if (u) {
    if (name) u.name = name;
  } else {
    u = { phone, name: name || 'مستخدم', banned: 0, created_at: new Date().toISOString() };
    d.users.push(u);
  }
  write(d);
  return u;
}
function getBannedPhones() {
  const d = read();
  return d ? d.users.filter(u => u.banned).map(u => u.phone) : [];
}
function toggleBan(phone) {
  const d = read();
  const u = d.users.find(us => us.phone === phone);
  if (u) u.banned = u.banned ? 0 : 1;
  write(d);
  return u;
}
function getCustomers() {
  const d = read();
  if (!d) return [];
  return d.users.map(u => {
    const userOrders = d.orders.filter(o => o.phone === u.phone);
    return {
      phone: u.phone, name: u.name, banned: u.banned, created_at: u.created_at,
      order_count: userOrders.length,
      total_spent: userOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0),
      last_order: userOrders.length ? userOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at : null
    };
  });
}

// ========== Settings ==========
function getSetting(key) {
  const d = read();
  return d && d.settings ? d.settings[key] || null : null;
}
function setSetting(key, value) {
  const d = read();
  d.settings[key] = String(value);
  write(d);
}

// ========== OTP ==========
function saveOTP(phone, code) {
  const d = read();
  d.otp_codes.push({ phone, code, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), used: 0 });
  // Clean expired
  d.otp_codes = d.otp_codes.filter(o => new Date(o.expires_at) > new Date());
  write(d);
}
function verifyOTP(phone, code) {
  const d = read();
  const idx = d.otp_codes.findIndex(o => o.phone === phone && o.code === code && !o.used && new Date(o.expires_at) > new Date());
  if (idx !== -1) {
    d.otp_codes[idx].used = 1;
    write(d);
    return true;
  }
  return false;
}

init();
module.exports = {
  getProducts, getProduct, addProduct, updateProduct, deleteProduct, replaceAllProducts,
  getCategories, addCategory, deleteCategory,
  getOrders, getOrder, addOrder, updateOrderStatus,
  getUser, upsertUser, getBannedPhones, toggleBan, getCustomers,
  getSetting, setSetting, saveOTP, verifyOTP
};
