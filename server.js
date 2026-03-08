/**
 * server.js — Coach Space v5.0
 * Умный парсинг Excel-плана по шаблону тренера:
 *   A,B,C  = Неделя 1 (Упражнение, Подходы, Повторения)
 *   E,F,G  = Неделя 2
 *   I,J,K  = Неделя 3
 *   M,N,O  = Неделя 4
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
// xlsx — парсинг Excel файлов (добавьте: npm install xlsx)
let XLSX; try { XLSX = require('xlsx'); } catch(e) { console.warn('⚠️  xlsx не установлен: npm install xlsx'); }

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Telegram ID тренера ───
const COACH_TG = process.env.COACH_TG_ID || '1457231359';

// ─── FIREBASE ───
let db, bucket;
try {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./serviceAccountKey.json');

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
    || `${sa.project_id}.appspot.com`;

  admin.initializeApp({
    credential:    admin.credential.cert(sa),
    storageBucket: storageBucket
  });

  db     = admin.firestore();
  bucket = admin.storage().bucket();
  console.log(`✅ Firebase | bucket: ${storageBucket}`);
} catch (e) {
  console.error('❌ Firebase:', e.message);
  process.exit(1);
}

// ─── TELEGRAM ───
let bot = null;
if (process.env.BOT_TOKEN) {
  bot = new Telegraf(process.env.BOT_TOKEN);
  bot.launch()
    .then(() => console.log('✅ Telegram бот запущен'))
    .catch(e  => console.warn('⚠️  Telegram:', e.message));
  process.once('SIGINT',  () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.warn('⚠️  BOT_TOKEN не задан');
}

async function tgSend(chatId, text) {
  if (!bot || !chatId) return;
  try { await bot.telegram.sendMessage(String(chatId), text, { parse_mode: 'HTML' }); }
  catch (e) { console.error('TG:', e.message); }
}

// ─── MULTER ───
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 } // 25MB для документов
});

async function uploadToStorage(buffer, destPath, mime) {
  const file  = bucket.file(destPath);
  const token = require('crypto').randomUUID();
  await file.save(buffer, {
    metadata: { contentType: mime, metadata: { firebaseStorageDownloadTokens: token } },
    public: true
  });
  const enc = encodeURIComponent(destPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${enc}?alt=media&token=${token}`;
}

// ─── MIDDLEWARE ───
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ══════════════════════════════════════════════
// АВТОРИЗАЦИЯ
// ══════════════════════════════════════════════
app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Нужен логин и пароль' });
    const snap = await db.collection('users').where('login', '==', login).get();
    if (snap.empty) return res.status(401).json({ error: 'Неверный логин или пароль' });
    const doc  = snap.docs.find(d => d.data().password === password);
    if (!doc)  return res.status(401).json({ error: 'Неверный логин или пароль' });
    const user = { id: doc.id, ...doc.data() };
    delete user.password;
    res.json({ success: true, user });
  } catch (e) { console.error('/api/login', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/me/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const user = { id: doc.id, ...doc.data() }; delete user.password;
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// ПОЛЬЗОВАТЕЛИ
// ══════════════════════════════════════════════
app.get('/api/users', async (req, res) => {
  try {
    const snap = await db.collection('users').where('role', '==', 'student').get();
    res.json(snap.docs.map(d => { const u = { id: d.id, ...d.data() }; delete u.password; return u; }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = { id: doc.id, ...doc.data() }; delete u.password; res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, login, password, telegramId, sessions, paymentDate, planUrl } = req.body;
    if (!name || !login || !password) return res.status(400).json({ error: 'Имя, логин и пароль обязательны' });
    const ex = await db.collection('users').where('login', '==', login).limit(1).get();
    if (!ex.empty) return res.status(409).json({ error: 'Логин уже занят' });
    const ref = await db.collection('users').add({
      name, login, password, role: 'student',
      telegramId: telegramId || null, sessions: parseInt(sessions) || 0,
      paymentDate: paymentDate || null,
      planUrl: planUrl || null,
      planFileName: null,   // имя загруженного файла
      planFileType: null,   // тип: 'url' | 'file'
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const data = { ...req.body }; if (!data.password) delete data.password;
    await db.collection('users').doc(req.params.id).update(data);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try { await db.collection('users').doc(req.params.id).delete(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/attendance', async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = doc.data();
    if (u.sessions <= 0) return res.status(400).json({ error: 'Занятий нет' });
    const newSess = u.sessions - 1;
    await ref.update({ sessions: newSess });
    if (newSess === 0) await tgSend(COACH_TG, `⚠️ У ученика <b>${u.name}</b> закончились занятия!`);
    res.json({ success: true, sessions: newSess });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// ПЛАН ТРЕНИРОВОК — умный парсинг Excel по шаблону тренера
// Колонки: A,B,C=Неделя1 | E,F,G=Неделя2 | I,J,K=Неделя3 | M,N,O=Неделя4
// ══════════════════════════════════════════════

function parseTrainingPlan(buffer) {
  if (!XLSX) throw new Error('xlsx не установлен: npm install xlsx');
  const wb  = XLSX.read(buffer, { type: 'buffer' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Индексы колонок (0-based): A=0,B=1,C=2 | E=4,F=5,G=6 | I=8,J=9,K=10 | M=12,N=13,O=14
  const WEEK_COLS = [
    { week: 1, ex: 0,  sets: 1,  reps: 2  },
    { week: 2, ex: 4,  sets: 5,  reps: 6  },
    { week: 3, ex: 8,  sets: 9,  reps: 10 },
    { week: 4, ex: 12, sets: 13, reps: 14 },
  ];

  const plan = { 1: [], 2: [], 3: [], 4: [] };
  let currentBlock = '';

  for (const row of raw) {
    if (row.every(c => String(c).trim() === '')) continue;

    const cellA = String(row[0] || '').trim();
    const cellB = String(row[1] || '').trim();
    const cellE = String(row[4] || '').trim();

    // Строка-заголовок блока: есть текст в A, нет данных в B и E
    const isBlockHeader = cellA !== '' && cellB === '' && cellE === '';
    if (isBlockHeader) {
      currentBlock = cellA;
      continue;
    }

    for (const { week, ex, sets, reps } of WEEK_COLS) {
      const exName  = String(row[ex]  || '').trim();
      const setsVal = String(row[sets] || '').trim();
      const repsVal = String(row[reps] || '').trim();
      const skip    = ['упражнение','exercise','название','name',''];
      if (exName && !skip.includes(exName.toLowerCase())) {
        plan[week].push({ block: currentBlock, exercise: exName, sets: setsVal, reps: repsVal });
      }
    }
  }
  return plan;
}

app.post('/api/users/:id/plan', upload.single('planFile'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Файл обязателен' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.xlsx', '.xls'].includes(ext))
      return res.status(400).json({ error: 'Нужен .xlsx или .xls файл' });

    let trainingPlan;
    try {
      trainingPlan = parseTrainingPlan(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ error: 'Ошибка парсинга: ' + e.message });
    }

    const totalEx = Object.values(trainingPlan).reduce((s, w) => s + w.length, 0);
    await db.collection('users').doc(id).update({
      trainingPlan,
      planFileName:  req.file.originalname,
      planUpdatedAt: new Date().toISOString(),
    });

    res.json({ success: true, totalExercises: totalEx, trainingPlan });
  } catch (e) {
    console.error('/api/users/:id/plan POST:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET план
app.get('/api/users/:id/plan', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = doc.data();
    res.json({
      trainingPlan:  u.trainingPlan  || null,
      planFileName:  u.planFileName  || null,
      planUpdatedAt: u.planUpdatedAt || null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ══════════════════════════════════════════════
// ТРЕНИРОВКИ
// ══════════════════════════════════════════════
app.get('/api/workouts', async (req, res) => {
  try {
    const snap = await db.collection('workouts').orderBy('datetime', 'asc').get();
    let list   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (req.query.userId) {
      list = list.filter(w => Array.isArray(w.studentIds) && w.studentIds.includes(req.query.userId));
    }
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/workouts', async (req, res) => {
  try {
    const { title, type, datetime, duration, studentIds, note } = req.body;
    if (!title || !datetime) return res.status(400).json({ error: 'Название и дата обязательны' });
    const ids = Array.isArray(studentIds) ? studentIds : [];
    const ref = await db.collection('workouts').add({
      title, type: type || 'personal', datetime,
      duration: parseInt(duration) || 60, studentIds: ids,
      note: note || '', createdAt: new Date().toISOString()
    });
    for (const uid of ids) {
      try {
        const uDoc = await db.collection('users').doc(uid).get();
        if (!uDoc.exists) continue;
        const u = uDoc.data();
        if (u.telegramId) {
          const dt = new Date(datetime).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
          await tgSend(u.telegramId, `🏋️ <b>Новая тренировка!</b>\n📌 ${title}\n📅 ${dt}\n⏱ ${duration||60} мин${note?'\n📝 '+note:''}`);
        }
      } catch {}
    }
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/workouts/:id', async (req, res) => {
  try { await db.collection('workouts').doc(req.params.id).delete(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// ПРОГРЕСС
// ══════════════════════════════════════════════
app.get('/api/progress/:userId', async (req, res) => {
  try {
    const snap = await db.collection('progress')
      .where('userId', '==', req.params.userId).get();
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    res.json(list);
  } catch (e) {
    console.error('/api/progress GET:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/progress', async (req, res) => {
  try {
    const { userId, weight, date } = req.body;
    if (!userId || !weight) return res.status(400).json({ error: 'userId и weight обязательны' });
    const ref = await db.collection('progress').add({
      userId, weight: parseFloat(weight),
      date: date || new Date().toISOString().split('T')[0], type: 'weight'
    });
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/progress/photo', upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file) return res.status(400).json({ error: 'userId и фото обязательны' });
    const ext  = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const dest = `progress/${userId}/${Date.now()}.${ext}`;
    const url  = await uploadToStorage(req.file.buffer, dest, req.file.mimetype);
    const ref  = await db.collection('progress').add({
      userId, photoUrl: url, type: 'photo',
      date: new Date().toISOString().split('T')[0]
    });
    res.json({ success: true, id: ref.id, url });
  } catch (e) { console.error('/api/progress/photo:', e.message); res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// ПОСТЫ (с опросами и реакциями)
// ══════════════════════════════════════════════
app.get('/api/posts', async (req, res) => {
  try {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(30).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { text, link, hasPoll, pollOptions } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст обязателен' });
    const opts = hasPoll && Array.isArray(pollOptions) ? pollOptions.filter(Boolean) : [];
    const votes = {};
    opts.forEach(o => { votes[o] = []; });
    const ref = await db.collection('posts').add({
      text, link: link || null,
      hasPoll: hasPoll && opts.length > 0,
      pollOptions: opts,
      votes,
      reactions: {},  // { '👍': [{userId, userName}], ... }  — теперь объекты а не строки
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/posts/:id', async (req, res) => {
  try { await db.collection('posts').doc(req.params.id).delete(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/posts/:id/react
 * Body: { userId, userName, emoji, single? }
 * single=true → один юзер = одна реакция (старая снимается автоматически)
 */
app.post('/api/posts/:id/react', async (req, res) => {
  try {
    const { userId, userName, emoji, single } = req.body;
    if (!userId || !emoji) return res.status(400).json({ error: 'userId и emoji обязательны' });
    const ref = db.collection('posts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Пост не найден' });

    const reactions = doc.data().reactions || {};

    // Если режим single — снимаем все предыдущие реакции этого юзера
    if (single) {
      Object.keys(reactions).forEach(e => {
        reactions[e] = reactions[e].filter(r =>
          typeof r === 'string' ? r !== userId : r.userId !== userId
        );
      });
    }

    if (!reactions[emoji]) reactions[emoji] = [];

    // Проверяем, стоит ли уже эта реакция (toggle)
    const idx = reactions[emoji].findIndex(r =>
      typeof r === 'string' ? r === userId : r.userId === userId
    );

    if (idx === -1) {
      // Добавляем
      reactions[emoji].push({ userId, userName: userName || 'Пользователь' });
    } else {
      // Та же реакция повторно — снимаем (toggle off)
      reactions[emoji].splice(idx, 1);
    }

    // Чистим пустые массивы
    Object.keys(reactions).forEach(e => { if (!reactions[e].length) delete reactions[e]; });

    await ref.update({ reactions });
    res.json({ success: true, reactions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/posts/:id/vote
 * Body: { userId, userName, option }
 */
app.post('/api/posts/:id/vote', async (req, res) => {
  try {
    const { userId, userName, option } = req.body;
    if (!userId || !option) return res.status(400).json({ error: 'userId и option обязательны' });
    const ref = db.collection('posts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Пост не найден' });
    const votes = doc.data().votes || {};
    Object.keys(votes).forEach(opt => {
      votes[opt] = votes[opt].filter(v => v.userId !== userId);
    });
    if (!votes[option]) votes[option] = [];
    votes[option].push({ userId, userName });
    await ref.update({ votes });
    res.json({ success: true, votes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// МАГАЗИН
// ══════════════════════════════════════════════
app.get('/api/shop', async (req, res) => {
  try {
    const snap = await db.collection('shop').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shop', upload.single('photo'), async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Название и цена обязательны' });
    let photoUrl = null;
    if (req.file) {
      const ext  = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
      photoUrl   = await uploadToStorage(req.file.buffer, `shop/${Date.now()}.${ext}`, req.file.mimetype);
    }
    const ref = await db.collection('shop').add({ name, price: parseFloat(price), photoUrl, createdAt: new Date().toISOString() });
    res.json({ success: true, id: ref.id, photoUrl });
  } catch (e) { console.error('/api/shop POST:', e.message); res.status(500).json({ error: e.message }); }
});

app.delete('/api/shop/:id', async (req, res) => {
  try { await db.collection('shop').doc(req.params.id).delete(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shop/:id/order', async (req, res) => {
  try {
    const doc = await db.collection('shop').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Товар не найден' });
    const item = doc.data();
    const { userName } = req.body;
    await tgSend(COACH_TG, `🛒 <b>Новый заказ!</b>\n👤 От: <b>${userName}</b>\n📦 Товар: <b>${item.name}</b>\n💰 Цена: ${item.price} ₽`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
// CRON
// ══════════════════════════════════════════════
cron.schedule('0 10 * * *', async () => {
  try {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];
    const snap = await db.collection('users').where('role', '==', 'student').get();
    for (const doc of snap.docs) {
      const u = doc.data();
      if (u.paymentDate !== tStr) continue;
      if (u.telegramId) await tgSend(u.telegramId, `💳 <b>Напоминание!</b>\nЗавтра истекает ваш абонемент. Свяжитесь с тренером 🏋️`);
      await tgSend(COACH_TG, `💳 Завтра дата оплаты у <b>${u.name}</b>. Осталось занятий: ${u.sessions}`);
    }
  } catch (e) { console.error('Cron оплата:', e.message); }
});

cron.schedule('*/30 * * * *', async () => {
  try {
    const now = Date.now(), in2h = now + 2*60*60*1000, win = 30*60*1000;
    const snap = await db.collection('workouts').get();
    for (const doc of snap.docs) {
      const w = doc.data(); const wt = new Date(w.datetime).getTime();
      if (wt <= in2h - win || wt > in2h) continue;
      const dt = new Date(w.datetime).toLocaleString('ru-RU', { hour:'2-digit', minute:'2-digit' });
      for (const uid of (w.studentIds||[])) {
        const uDoc = await db.collection('users').doc(uid).get();
        if (!uDoc.exists) continue;
        const u = uDoc.data();
        if (u.telegramId) await tgSend(u.telegramId, `⏰ <b>Через 2 часа тренировка!</b>\n📌 ${w.title}\n🕐 ${dt}`);
      }
    }
  } catch (e) { console.error('Cron тренировки:', e.message); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`\n🚀 Coach Space → http://localhost:${PORT}\n`));
