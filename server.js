/**
 * server.js — Coach Space
 * Стек: Express + Firebase Firestore + Firebase Storage + Telegraf + node-cron + multer
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const multer     = require('multer');
const path       = require('path');
const admin      = require('firebase-admin');
const { Telegraf } = require('telegraf');
const cron       = require('node-cron');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ FIREBASE
// ─────────────────────────────────────────
let db, bucket;
try {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./serviceAccountKey.json');

  admin.initializeApp({
    credential:  admin.credential.cert(sa),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${sa.project_id}.appspot.com`
  });

  db     = admin.firestore();
  bucket = admin.storage().bucket();
  console.log('✅ Firebase подключён');
} catch (e) {
  console.error('❌ Ошибка Firebase:', e.message);
  process.exit(1);
}

// ─────────────────────────────────────────
// TELEGRAM БОТ
// ─────────────────────────────────────────
let bot = null;
const COACH_TG = process.env.COACH_TG_ID;

if (process.env.BOT_TOKEN) {
  bot = new Telegraf(process.env.BOT_TOKEN);
  bot.launch().then(() => console.log('✅ Telegram-бот запущен'));
  process.once('SIGINT',  () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.warn('⚠️  BOT_TOKEN не задан');
}

async function tgSend(chatId, text) {
  if (!bot || !chatId) return;
  try { await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' }); }
  catch (e) { console.error('TG ошибка:', e.message); }
}

// ─────────────────────────────────────────
// MULTER — загрузка в память
// ─────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 } // 10 MB
});

/**
 * Загружает файл в Firebase Storage и возвращает публичный URL
 * @param {Buffer} buffer
 * @param {string} destPath — путь внутри bucket, напр. 'shop/123.jpg'
 * @param {string} mime
 */
async function uploadToStorage(buffer, destPath, mime) {
  const file = bucket.file(destPath);
  await file.save(buffer, { metadata: { contentType: mime } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${destPath}`;
}

// ─────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────
// API: АВТОРИЗАЦИЯ
// ─────────────────────────────────────────

/**
 * POST /api/login
 * Body: { login, password }
 * Ищет пользователя по полю login + password в Firestore
 */
app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Нужен логин и пароль' });

    const snap = await db.collection('users')
      .where('login', '==', login)
      .where('password', '==', password)
      .limit(1).get();

    if (snap.empty) return res.status(401).json({ error: 'Неверный логин или пароль' });

    const doc  = snap.docs[0];
    const user = { id: doc.id, ...doc.data() };
    delete user.password; // не отдаём пароль клиенту
    res.json({ success: true, user });
  } catch (e) {
    console.error('login:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/me/:id
 * Автовход по сохранённому ID
 */
app.get('/api/me/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const user = { id: doc.id, ...doc.data() };
    delete user.password;
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ─────────────────────────────────────────
// API: ПОЛЬЗОВАТЕЛИ
// ─────────────────────────────────────────

/** GET /api/users — все ученики */
app.get('/api/users', async (req, res) => {
  try {
    const snap = await db.collection('users').where('role', '==', 'student').get();
    const users = snap.docs.map(d => {
      const u = { id: d.id, ...d.data() };
      delete u.password;
      return u;
    });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/users/:id — один пользователь */
app.get('/api/users/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = { id: doc.id, ...doc.data() };
    delete u.password;
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/users — создать ученика
 * Body: { name, login, password, telegramId, sessions, paymentDate, planUrl }
 */
app.post('/api/users', async (req, res) => {
  try {
    const { name, login, password, telegramId, sessions, paymentDate, planUrl } = req.body;
    if (!name || !login || !password) return res.status(400).json({ error: 'Имя, логин и пароль обязательны' });

    // Проверяем уникальность логина
    const exists = await db.collection('users').where('login', '==', login).limit(1).get();
    if (!exists.empty) return res.status(409).json({ error: 'Логин уже занят' });

    const ref = await db.collection('users').add({
      name, login, password,
      role:        'student',
      telegramId:  telegramId || null,
      sessions:    parseInt(sessions) || 0,
      paymentDate: paymentDate || null,
      planUrl:     planUrl || null,
      createdAt:   new Date().toISOString()
    });

    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PUT /api/users/:id — обновить ученика */
app.put('/api/users/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.password) delete data.password; // не затираем пароль пустой строкой
    await db.collection('users').doc(req.params.id).update(data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** DELETE /api/users/:id */
app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.collection('users').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/users/:id/attendance — −1 тренировка */
app.post('/api/users/:id/attendance', async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = doc.data();
    if (u.sessions <= 0) return res.status(400).json({ error: 'Нет занятий' });

    const newSess = u.sessions - 1;
    await ref.update({ sessions: newSess });

    // Уведомление тренеру если 0
    if (newSess === 0 && COACH_TG) {
      await tgSend(COACH_TG, `⚠️ У ученика <b>${u.name}</b> закончились занятия!`);
    }

    res.json({ success: true, sessions: newSess });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────
// API: ПРОГРЕСС (вес + фото)
// ─────────────────────────────────────────

/** GET /api/progress/:userId */
app.get('/api/progress/:userId', async (req, res) => {
  try {
    const snap = await db.collection('progress')
      .where('userId', '==', req.params.userId)
      .orderBy('date', 'asc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/progress — добавить запись веса
 * Body: { userId, weight, date }
 */
app.post('/api/progress', async (req, res) => {
  try {
    const { userId, weight, date } = req.body;
    if (!userId || !weight) return res.status(400).json({ error: 'userId и weight обязательны' });
    const ref = await db.collection('progress').add({
      userId, weight: parseFloat(weight),
      date: date || new Date().toISOString().split('T')[0],
      type: 'weight'
    });
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/progress/photo — загрузить фото прогресса
 * multipart: userId, photo (file)
 */
app.post('/api/progress/photo', upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file) return res.status(400).json({ error: 'userId и фото обязательны' });

    const ext      = req.file.originalname.split('.').pop();
    const destPath = `progress/${userId}/${Date.now()}.${ext}`;
    const url      = await uploadToStorage(req.file.buffer, destPath, req.file.mimetype);

    const ref = await db.collection('progress').add({
      userId, photoUrl: url, type: 'photo',
      date: new Date().toISOString().split('T')[0]
    });
    res.json({ success: true, id: ref.id, url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────
// API: МАГАЗИН
// ─────────────────────────────────────────

/** GET /api/shop — все товары */
app.get('/api/shop', async (req, res) => {
  try {
    const snap = await db.collection('shop').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/shop — добавить товар (тренер)
 * multipart: name, price, photo (file)
 */
app.post('/api/shop', upload.single('photo'), async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Название и цена обязательны' });

    let photoUrl = null;
    if (req.file) {
      const ext  = req.file.originalname.split('.').pop();
      const dest = `shop/${Date.now()}.${ext}`;
      photoUrl   = await uploadToStorage(req.file.buffer, dest, req.file.mimetype);
    }

    const ref = await db.collection('shop').add({
      name, price: parseFloat(price), photoUrl,
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** DELETE /api/shop/:id */
app.delete('/api/shop/:id', async (req, res) => {
  try {
    await db.collection('shop').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/shop/:id/order — заказ товара
 * Body: { userId, userName }
 */
app.post('/api/shop/:id/order', async (req, res) => {
  try {
    const doc = await db.collection('shop').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Товар не найден' });

    const item = doc.data();
    const { userName } = req.body;

    // Уведомление тренеру
    if (COACH_TG) {
      await tgSend(COACH_TG,
        `🛒 <b>Новый заказ!</b>\n👤 От: <b>${userName}</b>\n📦 Товар: <b>${item.name}</b>\n💰 Цена: ${item.price} ₽`
      );
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────
// API: ПОСТЫ (новости тренера)
// ─────────────────────────────────────────

/** GET /api/posts */
app.get('/api/posts', async (req, res) => {
  try {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(20).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/posts
 * Body: { text, link }
 */
app.post('/api/posts', async (req, res) => {
  try {
    const { text, link } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст поста обязателен' });
    const ref = await db.collection('posts').add({
      text, link: link || null,
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** DELETE /api/posts/:id */
app.delete('/api/posts/:id', async (req, res) => {
  try {
    await db.collection('posts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────
// CRON: УВЕДОМЛЕНИЯ
// ─────────────────────────────────────────

// Каждый день в 10:00 — проверяем дату оплаты
cron.schedule('0 10 * * *', async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];

    const snap = await db.collection('users')
      .where('role', '==', 'student')
      .where('paymentDate', '==', tStr).get();

    for (const doc of snap.docs) {
      const u = doc.data();
      // Ученику
      if (u.telegramId) {
        await tgSend(u.telegramId,
          `💳 <b>Напоминание об оплате!</b>\nЗавтра истекает ваш абонемент. Свяжитесь с тренером для продления. 🏋️`
        );
      }
    }
    console.log(`Cron: проверка оплат — ${snap.size} уведомлений`);
  } catch (e) { console.error('Cron оплата:', e.message); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Coach Space запущен: http://localhost:${PORT}\n`);
});
