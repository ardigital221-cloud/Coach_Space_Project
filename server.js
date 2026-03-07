/**
 * server.js — Coach Space v3
 * Express + Firebase Firestore + Firebase Storage + Telegraf + node-cron + multer
 */

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const bodyParser   = require('body-parser');
const multer       = require('multer');
const path         = require('path');
const admin        = require('firebase-admin');
const { Telegraf } = require('telegraf');
const cron         = require('node-cron');

const app  = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────
// FIREBASE
// ──────────────────────────────────────────────
let db, bucket;
try {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./serviceAccountKey.json');

  // Имя bucket: явно из env или формат по умолчанию
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
    || `${sa.project_id}.appspot.com`;

  admin.initializeApp({
    credential:    admin.credential.cert(sa),
    storageBucket: storageBucket
  });

  db     = admin.firestore();
  bucket = admin.storage().bucket();
  console.log(`✅ Firebase OK  |  bucket: ${storageBucket}`);
} catch (e) {
  console.error('❌ Firebase init:', e.message);
  process.exit(1);
}

// ──────────────────────────────────────────────
// TELEGRAM
// ──────────────────────────────────────────────
let bot = null;
const COACH_TG = process.env.COACH_TG_ID || null;

if (process.env.BOT_TOKEN) {
  bot = new Telegraf(process.env.BOT_TOKEN);
  bot.launch()
    .then(() => console.log('✅ Telegram бот запущен'))
    .catch(e  => console.warn('⚠️  Telegram:', e.message));
  process.once('SIGINT',  () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.warn('⚠️  BOT_TOKEN не задан — уведомления отключены');
}

async function tgSend(chatId, text) {
  if (!bot || !chatId) return;
  try { await bot.telegram.sendMessage(String(chatId), text, { parse_mode: 'HTML' }); }
  catch (e) { console.error('TG send error:', e.message); }
}

// ──────────────────────────────────────────────
// MULTER (загрузка в оперативную память)
// ──────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 }  // 15 MB
});

/**
 * Загрузить буфер в Firebase Storage → вернуть публичный URL.
 * FIX: используем token вместо makePublic() — он надёжнее при настройках bucket
 */
async function uploadToStorage(buffer, destPath, mime) {
  const file  = bucket.file(destPath);
  const token = require('crypto').randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: mime,
      metadata:    { firebaseStorageDownloadTokens: token }
    },
    public: true          // делаем публичным сразу при сохранении
  });

  // Публичный URL формата Storage
  const encoded = encodeURIComponent(destPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;
}

// ──────────────────────────────────────────────
// MIDDLEWARE
// ──────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ══════════════════════════════════════════════
// API: АВТОРИЗАЦИЯ
// ══════════════════════════════════════════════

// POST /api/login  { login, password }
app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password)
      return res.status(400).json({ error: 'Нужен логин и пароль' });

    const snap = await db.collection('users')
      .where('login', '==', login)
      .where('password', '==', password)
      .limit(1).get();

    if (snap.empty) return res.status(401).json({ error: 'Неверный логин или пароль' });

    const doc  = snap.docs[0];
    const user = { id: doc.id, ...doc.data() };
    delete user.password;
    res.json({ success: true, user });
  } catch (e) {
    console.error('/api/login', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/me/:id  — авто-вход по сохранённому ID
app.get('/api/me/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const user = { id: doc.id, ...doc.data() };
    delete user.password;
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// API: ПОЛЬЗОВАТЕЛИ
// ══════════════════════════════════════════════

// GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const snap = await db.collection('users').where('role', '==', 'student').get();
    const users = snap.docs.map(d => {
      const u = { id: d.id, ...d.data() };
      delete u.password; return u;
    });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/:id
app.get('/api/users/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = { id: doc.id, ...doc.data() }; delete u.password;
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users  { name, login, password, telegramId, sessions, paymentDate, planUrl }
app.post('/api/users', async (req, res) => {
  try {
    const { name, login, password, telegramId, sessions, paymentDate, planUrl } = req.body;
    if (!name || !login || !password)
      return res.status(400).json({ error: 'Имя, логин и пароль обязательны' });

    const ex = await db.collection('users').where('login', '==', login).limit(1).get();
    if (!ex.empty) return res.status(409).json({ error: 'Логин уже занят' });

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

// PUT /api/users/:id
app.put('/api/users/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.password) delete data.password;
    await db.collection('users').doc(req.params.id).update(data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.collection('users').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:id/attendance  — −1 тренировка
app.post('/api/users/:id/attendance', async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = doc.data();
    if (u.sessions <= 0) return res.status(400).json({ error: 'Занятий нет' });
    const newSess = u.sessions - 1;
    await ref.update({ sessions: newSess });
    if (newSess === 0 && COACH_TG)
      await tgSend(COACH_TG, `⚠️ У ученика <b>${u.name}</b> закончились занятия!`);
    res.json({ success: true, sessions: newSess });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// API: ТРЕНИРОВКИ (расписание)
// ══════════════════════════════════════════════

/**
 * Структура тренировки в Firestore (коллекция workouts):
 * {
 *   title:      string,        // "Группа А — Ноги"
 *   type:       'personal'|'group',
 *   datetime:   ISO string,
 *   duration:   number (мин),
 *   studentIds: string[],      // ID учеников
 *   note:       string,        // заметка тренера
 *   createdAt:  ISO string
 * }
 */

// GET /api/workouts?userId=xxx  — все тренировки (или фильтр по ученику)
app.get('/api/workouts', async (req, res) => {
  try {
    let query = db.collection('workouts').orderBy('datetime', 'asc');
    const snap = await query.get();
    let list   = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Фильтр: если передан userId — только его тренировки
    if (req.query.userId) {
      list = list.filter(w =>
        Array.isArray(w.studentIds) && w.studentIds.includes(req.query.userId)
      );
    }
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/workouts  { title, type, datetime, duration, studentIds[], note }
app.post('/api/workouts', async (req, res) => {
  try {
    const { title, type, datetime, duration, studentIds, note } = req.body;
    if (!title || !datetime)
      return res.status(400).json({ error: 'Название и дата обязательны' });

    const ids = Array.isArray(studentIds) ? studentIds : [];

    const ref = await db.collection('workouts').add({
      title,
      type:       type || 'personal',
      datetime,
      duration:   parseInt(duration) || 60,
      studentIds: ids,
      note:       note || '',
      createdAt:  new Date().toISOString()
    });

    // Уведомить учеников в Telegram
    for (const uid of ids) {
      try {
        const uDoc = await db.collection('users').doc(uid).get();
        if (!uDoc.exists) continue;
        const u = uDoc.data();
        if (u.telegramId) {
          const dt = new Date(datetime).toLocaleString('ru-RU', {
            day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
          });
          await tgSend(u.telegramId,
            `🏋️ <b>Новая тренировка!</b>\n📌 ${title}\n📅 ${dt}\n⏱ ${duration||60} мин${note?'\n📝 '+note:''}`
          );
        }
      } catch {}
    }

    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/workouts/:id
app.put('/api/workouts/:id', async (req, res) => {
  try {
    await db.collection('workouts').doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/workouts/:id
app.delete('/api/workouts/:id', async (req, res) => {
  try {
    await db.collection('workouts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// API: ПРОГРЕСС
// ══════════════════════════════════════════════

// GET /api/progress/:userId
app.get('/api/progress/:userId', async (req, res) => {
  try {
    const snap = await db.collection('progress')
      .where('userId', '==', req.params.userId)
      .orderBy('date', 'asc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) {
    console.error('/api/progress GET:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/progress  { userId, weight, date }
app.post('/api/progress', async (req, res) => {
  try {
    const { userId, weight, date } = req.body;
    if (!userId || !weight)
      return res.status(400).json({ error: 'userId и weight обязательны' });
    const ref = await db.collection('progress').add({
      userId, weight: parseFloat(weight),
      date: date || new Date().toISOString().split('T')[0],
      type: 'weight'
    });
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/progress/photo  multipart: userId, photo
app.post('/api/progress/photo', upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file)
      return res.status(400).json({ error: 'userId и фото обязательны' });

    const ext  = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const dest = `progress/${userId}/${Date.now()}.${ext}`;
    const url  = await uploadToStorage(req.file.buffer, dest, req.file.mimetype);

    const ref = await db.collection('progress').add({
      userId, photoUrl: url, type: 'photo',
      date: new Date().toISOString().split('T')[0]
    });
    res.json({ success: true, id: ref.id, url });
  } catch (e) {
    console.error('/api/progress/photo:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════
// API: МАГАЗИН
// ══════════════════════════════════════════════

// GET /api/shop
app.get('/api/shop', async (req, res) => {
  try {
    const snap = await db.collection('shop').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) {
    console.error('/api/shop GET:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shop  multipart: name, price, photo?
app.post('/api/shop', upload.single('photo'), async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !price)
      return res.status(400).json({ error: 'Название и цена обязательны' });

    let photoUrl = null;
    if (req.file) {
      const ext  = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
      const dest = `shop/${Date.now()}.${ext}`;
      photoUrl   = await uploadToStorage(req.file.buffer, dest, req.file.mimetype);
    }

    const ref = await db.collection('shop').add({
      name, price: parseFloat(price), photoUrl,
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, id: ref.id, photoUrl });
  } catch (e) {
    console.error('/api/shop POST:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/shop/:id
app.delete('/api/shop/:id', async (req, res) => {
  try {
    await db.collection('shop').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/shop/:id/order  { userId, userName }
app.post('/api/shop/:id/order', async (req, res) => {
  try {
    const doc = await db.collection('shop').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Товар не найден' });
    const item = doc.data();
    const { userName } = req.body;
    if (COACH_TG) {
      await tgSend(COACH_TG,
        `🛒 <b>Новый заказ!</b>\n👤 От: <b>${userName}</b>\n📦 Товар: <b>${item.name}</b>\n💰 Цена: ${item.price} ₽`
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// API: ПОСТЫ
// ══════════════════════════════════════════════

// GET /api/posts
app.get('/api/posts', async (req, res) => {
  try {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(20).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/posts  { text, link }
app.post('/api/posts', async (req, res) => {
  try {
    const { text, link } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст обязателен' });
    const ref = await db.collection('posts').add({
      text, link: link || null,
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/posts/:id
app.delete('/api/posts/:id', async (req, res) => {
  try {
    await db.collection('posts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// CRON: УВЕДОМЛЕНИЯ
// ══════════════════════════════════════════════

// Каждый день в 10:00 — напоминание о дате оплаты (за 1 день)
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
      if (u.telegramId)
        await tgSend(u.telegramId,
          `💳 <b>Напоминание!</b>\nЗавтра истекает ваш абонемент у тренера. Свяжитесь для продления 🏋️`
        );
      if (COACH_TG)
        await tgSend(COACH_TG,
          `💳 Завтра дата оплаты у <b>${u.name}</b>. Осталось занятий: ${u.sessions}`
        );
    }
    console.log(`Cron оплаты: ${snap.size} уведомлений`);
  } catch (e) { console.error('Cron:', e.message); }
});

// Каждые 30 минут — напоминание о тренировке за 2 часа
cron.schedule('*/30 * * * *', async () => {
  try {
    const now     = Date.now();
    const in2h    = now + 2 * 60 * 60 * 1000;
    const window  = 30 * 60 * 1000;

    const snap = await db.collection('workouts').get();
    for (const doc of snap.docs) {
      const w = doc.data();
      const wt = new Date(w.datetime).getTime();
      if (wt > in2h - window && wt <= in2h) {
        const dt = new Date(w.datetime).toLocaleString('ru-RU', { hour:'2-digit', minute:'2-digit' });
        for (const uid of (w.studentIds || [])) {
          const uDoc = await db.collection('users').doc(uid).get();
          if (!uDoc.exists) continue;
          const u = uDoc.data();
          if (u.telegramId)
            await tgSend(u.telegramId,
              `⏰ <b>Через 2 часа тренировка!</b>\n📌 ${w.title}\n🕐 ${dt}`
            );
        }
      }
    }
  } catch (e) { console.error('Cron workouts:', e.message); }
});

// ──────────────────────────────────────────────
// SPA FALLBACK
// ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Coach Space → http://localhost:${PORT}\n`);
});
