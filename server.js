require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const multer     = require('multer');
const path       = require('path');
const cron       = require('node-cron');
const XLSX       = require('xlsx');
const admin      = require('firebase-admin');
const { Telegraf } = require('telegraf');
const bcrypt     = require('bcrypt');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');

// ═══════════════════════════════════════════
// БЕЗОПАСНОСТЬ
// ═══════════════════════════════════════════
const SALT_ROUNDS = 10;

// Rate-limit: не более 10 попыток входа за 15 минут
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Кеш токенов в памяти (снижает количество запросов к Firestore)
const _tokenCache = new Map();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 минут

function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}

async function createSession(userId, role) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 дней
  await db.collection('sessions').add({ userId, role, token, expiresAt, createdAt: new Date().toISOString() });
  return token;
}

async function validateToken(token) {
  if (!token) return null;
  const cached = _tokenCache.get(token);
  if (cached && Date.now() - cached.at < TOKEN_CACHE_TTL) return cached.session;
  const snap = await db.collection('sessions').where('token', '==', token).limit(1).get();
  if (snap.empty) return null;
  const session = { _docId: snap.docs[0].id, ...snap.docs[0].data() };
  if (new Date(session.expiresAt) < new Date()) {
    await snap.docs[0].ref.delete();
    _tokenCache.delete(token);
    return null;
  }
  _tokenCache.set(token, { session, at: Date.now() });
  return session;
}

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const session = await validateToken(auth.slice(7));
  if (!session) return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  req.sessionData = session;
  next();
}

async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
  const session = await validateToken(auth.slice(7));
  if (!session) return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  if (session.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
  req.sessionData = session;
  next();
}

// ═══════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════
const app  = express();
const PORT = process.env.PORT || 3000;

// Firebase
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || serviceAccount.project_id + '.appspot.com'
});

const db      = admin.firestore();
const bucket  = admin.storage().bucket();

// Telegram
const COACH_TG = process.env.COACH_TG_ID || '1457231359';

// ── Диагностика Telegram при старте ──────────────────────────────
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  bot.telegram.getMe()
    .then(me => console.log(`✅ Telegram бот подключён: @${me.username}`))
    .catch(e  => console.error(`❌ Telegram бот НЕ подключён: ${e.message}`));
} else {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN не задан — уведомления отключены');
}

async function tgSend(chatId, text) {
  if (!bot)    { console.log(`[TG-SKIP] bot=null | to=${chatId} | ${text.slice(0,60)}`); return; }
  if (!chatId) { console.log('[TG-SKIP] chatId пустой'); return; }
  try {
    await bot.telegram.sendMessage(String(chatId), text, { parse_mode: 'HTML' });
    console.log(`[TG-OK] → ${chatId} | ${text.slice(0,60)}`);
  } catch (e) {
    console.error(`[TG-ERR] → ${chatId} | ${e.message}`);
  }
}
// ─────────────────────────────────────────────────────────────────

// Multer — загрузка в память
const upload      = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadVideo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// ═══════════════════════════════════════════
// ПРОКСИ ДЛЯ ИЗОБРАЖЕНИЙ Firebase Storage
// ═══════════════════════════════════════════
app.get('/api/img/:filePath(*)', async (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).send('Not found');
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';
    const fileSize = parseInt(metadata.size) || 0;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (range && fileSize) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        'Content-Type':   contentType,
      });
      file.createReadStream({ start, end })
        .on('error', e => { console.error('Stream error:', e.message); res.end(); })
        .pipe(res);
    } else {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (fileSize) res.setHeader('Content-Length', fileSize);
      file.createReadStream()
        .on('error', e => { console.error('Stream error:', e.message); res.status(500).end(); })
        .pipe(res);
    }
  } catch (e) {
    console.error('IMG PROXY:', e.message);
    res.status(500).send('Error');
  }
});

// ═══════════════════════════════════════════
// АВТОРИЗАЦИЯ
// ═══════════════════════════════════════════
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
    const snap = await db.collection('users').where('login', '==', login).limit(1).get();
    if (snap.empty) return res.status(401).json({ error: 'Пользователь не найден' });
    const doc  = snap.docs[0];
    const user = { id: doc.id, ...doc.data() };

    // Проверка пароля: bcrypt или plaintext (миграция старых паролей)
    let passwordMatch = false;
    if (user.password && user.password.startsWith('$2b$')) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      passwordMatch = user.password === password;
      if (passwordMatch) {
        // Мигрируем в bcrypt при первом входе
        const hashed = await bcrypt.hash(password, SALT_ROUNDS);
        await doc.ref.update({ password: hashed });
      }
    }
    if (!passwordMatch) return res.status(401).json({ error: 'Неверный пароль' });

    const token = await createSession(user.id, user.role);
    delete user.password;
    res.json({ user, token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      _tokenCache.delete(token);
      const snap = await db.collection('sessions').where('token', '==', token).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();
    }
    res.json({ success: true });
  } catch (e) { res.json({ success: true }); }
});

app.get('/api/me/:id', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const user = { id: doc.id, ...doc.data() };
    delete user.password;
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ПОЛЬЗОВАТЕЛИ
// ═══════════════════════════════════════════
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').where('role', '==', 'student').get();
    const users = snap.docs.map(d => { const u = { id: d.id, ...d.data() }; delete u.password; return u; });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const user = { id: doc.id, ...doc.data() };
    delete user.password;
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { name, login, password, telegramId, sessions, paymentDate } = req.body;
    if (!name || !login || !password) return res.status(400).json({ error: 'Имя, логин и пароль обязательны' });
    const exists = await db.collection('users').where('login', '==', login).limit(1).get();
    if (!exists.empty) return res.status(400).json({ error: 'Логин уже занят' });
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const ref = await db.collection('users').add({
      name, login, password: hashedPassword, role: 'student',
      telegramId: telegramId || null,
      sessions: parseInt(sessions) || 0,
      paymentDate: paymentDate || null,
      createdAt: new Date().toISOString()
    });
    if (telegramId) {
      await tgSend(telegramId, `👋 <b>Добро пожаловать в Coach Space!</b>\nТвой тренер добавил тебя на платформу.\n🔑 Логин: <code>${login}</code>`);
    }
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { name, password, telegramId, sessions, paymentDate } = req.body;
    const upd = {};
    if (name !== undefined) upd.name = name;
    if (password) upd.password = await bcrypt.hash(password, SALT_ROUNDS);
    if (telegramId !== undefined) upd.telegramId = telegramId;
    if (sessions !== undefined) upd.sessions = parseInt(sessions);
    if (paymentDate !== undefined) upd.paymentDate = paymentDate;
    await db.collection('users').doc(req.params.id).update(upd);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    await db.collection('users').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/attendance', requireAdmin, async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const sessions = Math.max(0, (doc.data().sessions || 0) - 1);
    await ref.update({ sessions });
    const user = doc.data();
    if (user.telegramId) {
      await tgSend(user.telegramId, `✅ <b>Тренировка отмечена!</b>\nОсталось занятий: <b>${sessions}</b>${sessions <= 2 ? '\n⚠️ Скоро закончится абонемент!' : ''}`);
    }
    if (sessions <= 2) {
      await tgSend(COACH_TG, `⚠️ У <b>${user.name}</b> осталось <b>${sessions}</b> занятий!`);
    }
    res.json({ sessions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ПЛАН ТРЕНИРОВОК
// ═══════════════════════════════════════════
app.get('/api/users/:id/plan', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const { trainingPlan, planUpdatedAt } = doc.data();
    res.json({ trainingPlan: trainingPlan || null, planUpdatedAt: planUpdatedAt || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/plan', requireAdmin, async (req, res) => {
  try {
    const { trainingPlan } = req.body;
    const now = new Date().toISOString();
    await db.collection('users').doc(req.params.id).update({ trainingPlan, planUpdatedAt: now });
    const doc = await db.collection('users').doc(req.params.id).get();
    const user = doc.data();
    if (user.telegramId) {
      await tgSend(user.telegramId, `📋 <b>Твой план тренировок обновлён!</b>\nЗайди в приложение чтобы посмотреть 💪`);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ТРЕНИРОВКИ
// ═══════════════════════════════════════════
app.get('/api/workouts', requireAuth, async (req, res) => {
  try {
    const { userId } = req.query;
    let snap;
    if (userId) {
      snap = await db.collection('workouts').where('studentIds', 'array-contains', userId).get();
    } else {
      snap = await db.collection('workouts').get();
    }
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/workouts', requireAdmin, async (req, res) => {
  try {
    const { title, type, datetime, duration, studentIds, note } = req.body;
    if (!title || !datetime) return res.status(400).json({ error: 'Название и дата обязательны' });
    const ref = await db.collection('workouts').add({
      title, type: type || 'personal',
      datetime, duration: parseInt(duration) || 60,
      studentIds: studentIds || [],
      note: note || '',
      createdAt: new Date().toISOString()
    });
    for (const uid of (studentIds || [])) {
      const udoc = await db.collection('users').doc(uid).get();
      if (udoc.exists && udoc.data().telegramId) {
        const dt = new Date(datetime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        await tgSend(udoc.data().telegramId, `🏋️ <b>Новая тренировка!</b>\n📌 ${title}\n📅 ${dt}\n⏱ ${duration} мин${note ? '\n📝 ' + note : ''}`);
      }
    }
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/workouts/:id', requireAdmin, async (req, res) => {
  try {
    await db.collection('workouts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ПРОГРЕСС (вес + фото)
// ═══════════════════════════════════════════
app.get('/api/progress/:userId', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('progress').where('userId', '==', req.params.userId).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/progress', requireAuth, async (req, res) => {
  try {
    const { userId, weight, date } = req.body;
    if (!userId || !weight) return res.status(400).json({ error: 'userId и weight обязательны' });
    const ref = await db.collection('progress').add({
      userId, type: 'weight',
      weight: parseFloat(weight),
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    });
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/progress/photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file) return res.status(400).json({ error: 'userId и фото обязательны' });
    const fileName = `progress/${userId}/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(fileName);
    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype, cacheControl: 'public, max-age=31536000' }
    });
    const photoUrl = `/api/img/${encodeURIComponent(fileName)}`;
    const ref = await db.collection('progress').add({
      userId, type: 'photo', photoUrl,
      // Сохраняем оригинальный путь файла для удаления
      storagePath: fileName,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    });
    res.json({ id: ref.id, photoUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ ИСПРАВЛЕНО: удаление фото прогресса — используем поле storagePath
// Для старых записей без storagePath пробуем извлечь путь из URL /api/img/...
app.delete('/api/progress/photo/:photoId', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('progress').doc(req.params.photoId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Фото не найдено' });
    const data = doc.data();

    // Определяем путь к файлу в Storage
    let storagePath = data.storagePath || null;

    if (!storagePath && data.photoUrl) {
      // Новый формат: /api/img/progress%2F...
      const match = data.photoUrl.match(/\/api\/img\/(.+)$/);
      if (match) {
        storagePath = decodeURIComponent(match[1]);
      }
      // Старый формат: Firebase direct URL с /o/...
      if (!storagePath) {
        const oldMatch = data.photoUrl.match(/\/o\/(.+?)\?/);
        if (oldMatch) storagePath = decodeURIComponent(oldMatch[1]);
      }
    }

    if (storagePath) {
      await bucket.file(storagePath).delete().catch(e => {
        console.warn(`[PHOTO-DEL] Файл не найден в Storage: ${storagePath} — ${e.message}`);
      });
    }

    await db.collection('progress').doc(req.params.photoId).delete();
    res.json({ success: true });
  } catch (e) {
    console.error('[PHOTO-DEL-ERR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Сброс всех записей веса ученика (только для тренера)
app.delete('/api/progress/:userId/weight', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('progress')
      .where('userId', '==', req.params.userId)
      .get();
    if (snap.empty) return res.json({ success: true, deleted: 0 });
    const weightDocs = snap.docs.filter(doc => doc.data().type === 'weight');
    if (!weightDocs.length) return res.json({ success: true, deleted: 0 });
    const batch = db.batch();
    weightDocs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`[WEIGHT-RESET] userId=${req.params.userId}, deleted=${weightDocs.length}`);
    res.json({ success: true, deleted: weightDocs.length });
  } catch (e) {
    console.error(`[WEIGHT-RESET-ERR] ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════
// ПОСТЫ
// ═══════════════════════════════════════════
app.get('/api/posts', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('posts').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', requireAdmin, async (req, res) => {
  try {
    const { text, link, hasPoll, pollOptions } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст обязателен' });
    const ref = await db.collection('posts').add({
      text, link: link || null,
      hasPoll: hasPoll || false,
      pollOptions: pollOptions || [],
      votes: {}, reactions: {},
      createdAt: new Date().toISOString()
    });
    const students = await db.collection('users').where('role', '==', 'student').get();
    for (const s of students.docs) {
      if (s.data().telegramId) {
        await tgSend(s.data().telegramId, `📢 <b>Новость от тренера!</b>\n${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`);
      }
    }
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/posts/:id', requireAdmin, async (req, res) => {
  try {
    await db.collection('posts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/react', requireAuth, async (req, res) => {
  try {
    const { userId, userName, emoji, single } = req.body;
    const ref = db.collection('posts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Пост не найден' });
    const reactions = doc.data().reactions || {};
    if (single) {
      for (const em of Object.keys(reactions)) {
        reactions[em] = (reactions[em] || []).filter(r =>
          typeof r === 'string' ? r !== userId : r.userId !== userId
        );
      }
    }
    if (!reactions[emoji]) reactions[emoji] = [];
    const already = reactions[emoji].some(r => typeof r === 'string' ? r === userId : r.userId === userId);
    if (!already) reactions[emoji].push({ userId, userName });
    else reactions[emoji] = reactions[emoji].filter(r => typeof r === 'string' ? r !== userId : r.userId !== userId);
    await ref.update({ reactions });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/vote', requireAuth, async (req, res) => {
  try {
    const { userId, userName, option } = req.body;
    const ref = db.collection('posts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Пост не найден' });
    const votes = doc.data().votes || {};
    for (const opt of Object.keys(votes)) {
      votes[opt] = (votes[opt] || []).filter(v => v.userId !== userId);
    }
    if (!votes[option]) votes[option] = [];
    votes[option].push({ userId, userName });
    await ref.update({ votes });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// МАГАЗИН — поддержка нескольких фото
// ═══════════════════════════════════════════
app.get('/api/shop', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('shop').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ Создание товара — первичная загрузка (одно или несколько фото через upload.array)
app.post('/api/shop', requireAdmin, upload.array('photos', 10), async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Название и цена обязательны' });

    const photos = [];
    for (const file of (req.files || [])) {
      const fileName = `shop/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.originalname}`;
      const f = bucket.file(fileName);
      await f.save(file.buffer, {
        metadata: { contentType: file.mimetype, cacheControl: 'public, max-age=31536000' }
      });
      photos.push({ url: `/api/img/${encodeURIComponent(fileName)}`, storagePath: fileName });
    }

    // Обратная совместимость: photoUrl = первое фото
    const photoUrl = photos.length ? photos[0].url : null;

    const ref = await db.collection('shop').add({
      name, price: parseFloat(price),
      photoUrl,   // legacy
      photos,     // новый массив
      createdAt: new Date().toISOString()
    });
    res.json({ id: ref.id, photoUrl, photos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ Добавить фото к существующему товару
app.post('/api/shop/:id/photos', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Фото обязательно' });
    const docRef = db.collection('shop').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Товар не найден' });

    const fileName = `shop/${Date.now()}_${Math.random().toString(36).slice(2)}_${req.file.originalname}`;
    const f = bucket.file(fileName);
    await f.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype, cacheControl: 'public, max-age=31536000' }
    });
    const newPhoto = { url: `/api/img/${encodeURIComponent(fileName)}`, storagePath: fileName };

    const existing = doc.data().photos || [];
    // Миграция старых записей с photoUrl
    if (!existing.length && doc.data().photoUrl) {
      existing.push({ url: doc.data().photoUrl, storagePath: null });
    }
    const updated = [...existing, newPhoto];
    await docRef.update({ photos: updated, photoUrl: updated[0].url });

    res.json({ success: true, photo: newPhoto, photos: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ Удалить одно фото товара по индексу
app.delete('/api/shop/:id/photos/:idx', requireAdmin, async (req, res) => {
  try {
    const idx = parseInt(req.params.idx);
    const docRef = db.collection('shop').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Товар не найден' });

    const photos = doc.data().photos || [];
    if (idx < 0 || idx >= photos.length) return res.status(400).json({ error: 'Неверный индекс' });

    const removed = photos[idx];
    if (removed.storagePath) {
      await bucket.file(removed.storagePath).delete().catch(e => {
        console.warn(`[SHOP-PHOTO-DEL] ${removed.storagePath}: ${e.message}`);
      });
    }

    photos.splice(idx, 1);
    const photoUrl = photos.length ? photos[0].url : null;
    await docRef.update({ photos, photoUrl });

    res.json({ success: true, photos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/shop/:id', requireAdmin, async (req, res) => {
  try {
    // Удаляем все файлы товара из Storage
    const doc = await db.collection('shop').doc(req.params.id).get();
    if (doc.exists) {
      const photos = doc.data().photos || [];
      for (const p of photos) {
        if (p.storagePath) {
          await bucket.file(p.storagePath).delete().catch(() => {});
        }
      }
    }
    await db.collection('shop').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/shop/:id/order', requireAuth, async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const doc = await db.collection('shop').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Товар не найден' });
    const item = doc.data();
    await tgSend(COACH_TG, `🛒 <b>Новый заказ!</b>\nУченик: <b>${userName}</b>\nТовар: <b>${item.name}</b>\nЦена: ${item.price} ₸`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ДНЕВНИК ТРЕНИРОВОК
// ═══════════════════════════════════════════
app.get('/api/diary/:userId', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('diary')
      .where('userId', '==', req.params.userId)
      .limit(60).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => b.date.localeCompare(a.date));
    res.json(items);
  } catch (e) {
    console.error('GET /api/diary:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/diary/:userId/:date', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('diary')
      .doc(`${req.params.userId}_${req.params.date}`).get();
    res.json(doc.exists ? { id: doc.id, ...doc.data() } : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/diary/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, exercises, note, rating } = req.body;
    if (!date) return res.status(400).json({ error: 'date обязателен' });
    const docId = `${userId}_${date}`;
    await db.collection('diary').doc(docId).set({
      userId, date,
      exercises: exercises || [],
      note: note || '',
      rating: rating || null,
      savedAt: new Date().toISOString()
    }, { merge: true });
    for (const ex of (exercises || [])) {
      for (const s of (ex.sets || [])) {
        if (!s.weight || !s.reps) continue;
        const prRef = db.collection('records').doc(`${userId}_${ex.name}`);
        const prDoc = await prRef.get();
        const cur = prDoc.exists ? prDoc.data() : {};
        if (!cur.weight || parseFloat(s.weight) > parseFloat(cur.weight)) {
          await prRef.set({
            userId, exercise: ex.name,
            weight: parseFloat(s.weight),
            reps: parseInt(s.reps),
            date, updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }
    }
    res.json({ success: true, id: docId });
  } catch (e) {
    console.error('POST /api/diary:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/diary/:userId/:entryId', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('diary').doc(req.params.entryId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Запись не найдена' });
    if (doc.data().userId !== req.params.userId) return res.status(403).json({ error: 'Нет доступа' });
    await db.collection('diary').doc(req.params.entryId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/diary/:userId/:entryId', requireAuth, async (req, res) => {
  try {
    const { date, exercises, note, rating } = req.body;
    const doc = await db.collection('diary').doc(req.params.entryId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Запись не найдена' });
    if (doc.data().userId !== req.params.userId) return res.status(403).json({ error: 'Нет доступа' });
    await db.collection('diary').doc(req.params.entryId).update({
      date, exercises, note: note || '', rating: rating || null,
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ЛИЧНЫЕ РЕКОРДЫ
// ═══════════════════════════════════════════
app.get('/api/records/:userId', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('records')
      .where('userId', '==', req.params.userId).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ОТЗЫВЫ
// ═══════════════════════════════════════════
app.get('/api/reviews', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('reviews').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(items);
  } catch (e) {
    console.error('GET /api/reviews:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/reviews', requireAuth, async (req, res) => {
  try {
    const { userId, userName, rating, text } = req.body;
    if (!userId || !rating) return res.status(400).json({ error: 'userId и rating обязательны' });
    const ref = await db.collection('reviews').add({
      userId, userName: userName || 'Ученик',
      rating: parseInt(rating),
      text: text || '',
      createdAt: new Date().toISOString()
    });
    await tgSend(COACH_TG, `⭐ <b>Новый отзыв от ${userName}!</b>\nОценка: ${'⭐'.repeat(parseInt(rating))}\n${text ? '💬 ' + text : ''}`);
    res.json({ success: true, id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reviews/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('reviews').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Отзыв не найден' });
    await db.collection('reviews').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ЗАМЕТКИ ТРЕНЕРА
// ═══════════════════════════════════════════
app.get('/api/notes/:userId', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('notes')
      .where('userId', '==', req.params.userId).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notes/:userId', requireAdmin, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст обязателен' });
    const ref = await db.collection('notes').add({
      userId: req.params.userId,
      text,
      createdAt: new Date().toISOString()
    });
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/notes/:userId/:noteId', requireAdmin, async (req, res) => {
  try {
    await db.collection('notes').doc(req.params.noteId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ВИДЕОТЕКА — КАТЕГОРИИ
// ═══════════════════════════════════════════

// GET /api/video-categories
app.get('/api/video-categories', requireAuth, async (_req, res) => {
  try {
    const snap = await db.collection('videoCategories').orderBy('createdAt').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/video-categories  { name }
app.post('/api/video-categories', requireAdmin, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const ref = await db.collection('videoCategories').add({
      name, createdAt: new Date().toISOString()
    });
    res.json({ id: ref.id, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/video-categories/:id — удаляет категорию + все её видео
app.delete('/api/video-categories/:id', requireAdmin, async (req, res) => {
  try {
    const catId = req.params.id;
    const videos = await db.collection('exerciseVideos').where('categoryId', '==', catId).get();
    const batch = db.batch();
    for (const v of videos.docs) {
      if (v.data().storagePath) {
        await bucket.file(v.data().storagePath).delete().catch(() => {});
      }
      batch.delete(v.ref);
    }
    batch.delete(db.collection('videoCategories').doc(catId));
    await batch.commit();
    console.log(`[CAT-DEL] id=${catId}, videos=${videos.size}`);
    res.json({ success: true, deletedVideos: videos.size });
  } catch (e) {
    console.error('[CAT-DEL-ERR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════
// ВИДЕОТЕКА — ВИДЕО
// ═══════════════════════════════════════════

// GET /api/exercise-videos[?categoryId=xxx]
app.get('/api/exercise-videos', requireAuth, async (req, res) => {
  try {
    let query = db.collection('exerciseVideos');
    if (req.query.categoryId) {
      query = query.where('categoryId', '==', req.query.categoryId);
    }
    const snap = await query.orderBy('createdAt').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/exercise-videos  multipart: categoryId, title, video
app.post('/api/exercise-videos', requireAdmin, uploadVideo.single('video'), async (req, res) => {
  try {
    const categoryId   = (req.body.categoryId   || '').trim();
    const categoryName = (req.body.categoryName || '').trim();
    const title        = (req.body.title        || '').trim();
    const description  = (req.body.description  || '').trim();
    if (!categoryId) return res.status(400).json({ error: 'categoryId обязателен' });
    if (!title)      return res.status(400).json({ error: 'title обязателен' });
    if (!req.file)   return res.status(400).json({ error: 'Видео файл обязателен' });

    const safeName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `exercise_videos/${Date.now()}_${safeName}`;
    const file = bucket.file(fileName);
    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype, cacheControl: 'public, max-age=31536000' }
    });
    const videoUrl = `/api/img/${encodeURIComponent(fileName)}`;

    const ref = await db.collection('exerciseVideos').add({
      categoryId, categoryName, title, description, videoUrl,
      storagePath: fileName,
      fileSize: req.file.size,
      createdAt: new Date().toISOString()
    });
    console.log(`[VIDEO-UPLOAD] "${title}" cat=${categoryId} → ${fileName}`);
    res.json({ id: ref.id, videoUrl });
  } catch (e) {
    console.error('[VIDEO-UPLOAD-ERR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/exercise-videos/:id
app.delete('/api/exercise-videos/:id', requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('exerciseVideos').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Видео не найдено' });
    if (doc.data().storagePath) {
      await bucket.file(doc.data().storagePath).delete().catch(e => {
        console.warn(`[VIDEO-DEL] Storage: ${e.message}`);
      });
    }
    await doc.ref.delete();
    console.log(`[VIDEO-DEL] "${doc.data().title}" удалено`);
    res.json({ success: true });
  } catch (e) {
    console.error('[VIDEO-DEL-ERR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════
// FATSECRET — поиск продуктов (Node.js 18+ built-in fetch)
// ═══════════════════════════════════════════

const FS_CLIENT_ID     = process.env.FATSECRET_CLIENT_ID;
const FS_CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET;
let _fsToken = null, _fsTokenExpiry = 0;

async function getFatSecretToken() {
  if (_fsToken && Date.now() < _fsTokenExpiry) return _fsToken;
  const creds = Buffer.from(`${FS_CLIENT_ID}:${FS_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=basic'
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.error || 'FatSecret auth failed');
  _fsToken = data.access_token;
  _fsTokenExpiry = Date.now() + ((data.expires_in || 86400) - 60) * 1000;
  console.log(`[FS] Token получен, истекает через ${Math.round((data.expires_in || 86400) / 3600)}ч`);
  return _fsToken;
}

app.get('/api/fatsecret/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ foods: [] });
    const token = await getFatSecretToken();
    const url = `https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=${encodeURIComponent(q)}&region=RU&format=json&max_results=8`;
    const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await r.json();
    let foods = data.foods?.food || [];
    if (!Array.isArray(foods)) foods = foods ? [foods] : [];
    res.json({ foods });
  } catch (e) {
    console.error('[FS-SEARCH]', e.message);
    res.json({ foods: [], error: e.message });
  }
});

app.get('/api/fatsecret/food/:id', async (req, res) => {
  try {
    const token = await getFatSecretToken();
    const url = `https://platform.fatsecret.com/rest/server.api?method=food.get.v2&food_id=${req.params.id}&format=json`;
    const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await r.json();
    res.json(data.food || {});
  } catch (e) {
    console.error('[FS-FOOD]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════
// ИЗБРАННОЕ ПИТАНИЕ
// ═══════════════════════════════════════════

app.get('/api/favorites/:userId', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('favorites').where('userId', '==', req.params.userId).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/favorites/:userId', requireAuth, async (req, res) => {
  try {
    const { name, type, kcal, protein, fat, carbs } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const ref = await db.collection('favorites').add({
      userId: req.params.userId, name,
      type: type || 'snack',
      kcal: parseInt(kcal) || 0,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
      carbs: parseFloat(carbs) || 0,
      createdAt: new Date().toISOString()
    });
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/favorites/:userId/:favId', requireAuth, async (req, res) => {
  try {
    await db.collection('favorites').doc(req.params.favId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// КАСТОМНЫЕ БЛЮДА ПОЛЬЗОВАТЕЛЯ
// ═══════════════════════════════════════════

// Общие продукты (от всех пользователей, isShared=true)
app.get('/api/shared-foods', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('customFoods').where('isShared', '==', true).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/custom-foods/:userId', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('customFoods').where('userId', '==', req.params.userId).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/custom-foods/:userId', requireAuth, async (req, res) => {
  try {
    const { name, ingredients, kcal, protein, fat, carbs, isShared, userName } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const exists = await db.collection('customFoods')
      .where('userId', '==', req.params.userId)
      .where('name', '==', name).limit(1).get();
    let id;
    if (!exists.empty) {
      await exists.docs[0].ref.update({
        ingredients: ingredients || [], kcal: parseInt(kcal)||0, protein: parseFloat(protein)||0,
        fat: parseFloat(fat)||0, carbs: parseFloat(carbs)||0,
        isShared: !!isShared, userName: userName || '',
        updatedAt: new Date().toISOString()
      });
      id = exists.docs[0].id;
    } else {
      const ref = await db.collection('customFoods').add({
        userId: req.params.userId, name,
        ingredients: ingredients || [],
        kcal: parseInt(kcal) || 0,
        protein: parseFloat(protein) || 0,
        fat: parseFloat(fat) || 0,
        carbs: parseFloat(carbs) || 0,
        isShared: !!isShared,
        userName: userName || '',
        createdAt: new Date().toISOString()
      });
      id = ref.id;
    }
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/custom-foods/:userId/:foodId', requireAuth, async (req, res) => {
  try {
    await db.collection('customFoods').doc(req.params.foodId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ПИТАНИЕ
// ═══════════════════════════════════════════
app.get('/api/nutrition/:userId', requireAuth, async (req, res) => {
  try {
    // Используем только один where чтобы избежать требования составного индекса Firestore
    const snap = await db.collection('nutrition').where('userId', '==', req.params.userId).get();
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (req.query.date) items = items.filter(i => i.date === req.query.date);
    items.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/nutrition/:userId', requireAuth, async (req, res) => {
  try {
    const { name, type, kcal, protein, fat, carbs, date } = req.body;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    const ref = await db.collection('nutrition').add({
      userId: req.params.userId,
      name,
      type: type || 'snack',
      kcal: parseInt(kcal) || 0,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
      carbs: parseFloat(carbs) || 0,
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    });
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/nutrition/:userId/:entryId', requireAuth, async (req, res) => {
  try {
    await db.collection('nutrition').doc(req.params.entryId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ЭКСПОРТ EXCEL
// ═══════════════════════════════════════════
app.get('/api/export/students', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('users').where('role', '==', 'student').get();
    const rows = snap.docs.map(d => {
      const u = d.data();
      return {
        'Имя': u.name || '',
        'Логин': u.login || '',
        'Telegram': u.telegramId || '',
        'Занятий': u.sessions || 0,
        'Дата оплаты': u.paymentDate || '',
        'Дата добавления': u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : ''
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Ученики');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="students.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ЭНДПОИНТ ПРОВЕРКИ УВЕДОМЛЕНИЙ
// ═══════════════════════════════════════════
app.post('/api/notifications/test', requireAdmin, async (req, res) => {
  const { chatId } = req.body;
  const target = chatId || COACH_TG;
  if (!bot) return res.json({ success: false, reason: 'TELEGRAM_BOT_TOKEN не задан в .env' });
  try {
    await tgSend(target, `🔔 <b>Тест уведомлений Coach Space</b>\n✅ Бот работает корректно!\n🕐 ${new Date().toLocaleString('ru-RU')}`);
    res.json({ success: true, sentTo: target });
  } catch (e) {
    res.json({ success: false, reason: e.message });
  }
});

// ═══════════════════════════════════════════
// КРОСС — РЕГИСТРАЦИЯ НА ЗАБЕГ (публичная)
// ═══════════════════════════════════════════

// Записаться на забег (без авторизации)
app.post('/api/cross-register', async (req, res) => {
  try {
    const { name, phone, telegram, city } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Имя обязательно' });
    const ref = await db.collection('crossRegistrants').add({
      name: name.trim(),
      phone: (phone || '').trim(),
      telegram: (telegram || '').trim(),
      city: (city || '').trim(),
      registeredAt: new Date().toISOString()
    });
    await tgSend(COACH_TG, `🏃 <b>Новая заявка на кросс!</b>\n👤 ${name.trim()}${phone ? '\n📞 ' + phone : ''}${telegram ? '\n✈️ ' + telegram : ''}${city ? '\n📍 ' + city : ''}`);
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Получить всех записавшихся (только для авторизованных — тренер)
app.get('/api/cross-register', requireAdmin, async (_req, res) => {
  try {
    const snap = await db.collection('crossRegistrants').get();
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.registeredAt || '').localeCompare(a.registeredAt || ''));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Удалить заявку
app.delete('/api/cross-register/:id', requireAdmin, async (req, res) => {
  try {
    await db.collection('crossRegistrants').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// КРОСС — ПРОБЕЖКИ
// ═══════════════════════════════════════════

// Сохранить пробежку
app.post('/api/runs', requireAuth, async (req, res) => {
  try {
    const { userId, userName, distance, duration, avgSpeed, date } = req.body;
    if (!userId || distance == null || duration == null) return res.status(400).json({ error: 'Недостаточно данных' });
    const ref = await db.collection('runs').add({
      userId,
      userName: userName || 'Аноним',
      distance: parseFloat(distance) || 0,      // метры
      duration: parseInt(duration) || 0,         // секунды
      avgSpeed: parseFloat(avgSpeed) || 0,       // км/ч
      date: date || new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    res.json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// История пробежек пользователя
app.get('/api/runs/user/:userId', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('runs')
      .where('userId', '==', req.params.userId)
      .get();
    const runs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 50);
    res.json(runs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Лидерборд — агрегация по дистанции за период
app.get('/api/runs/leaderboard', requireAuth, async (req, res) => {
  try {
    const period = req.query.period || 'week'; // today | week | all
    // Получаем всё и фильтруем в JS — чтобы не требовать составные индексы Firestore
    const snap = await db.collection('runs').get();
    let docs = snap.docs.map(d => d.data());

    if (period !== 'all') {
      const now = new Date();
      let from;
      if (period === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else {
        // week
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        from = d.toISOString();
      }
      docs = docs.filter(r => (r.createdAt || r.date || '') >= from);
    }

    // Агрегируем по userId
    const map = {};
    docs.forEach(r => {
      if (!r.userId) return;
      if (!map[r.userId]) {
        map[r.userId] = { userId: r.userId, userName: r.userName || 'Аноним', totalDistance: 0, totalRuns: 0 };
      }
      map[r.userId].totalDistance += r.distance || 0;
      map[r.userId].totalRuns += 1;
    });
    const list = Object.values(map).sort((a, b) => b.totalDistance - a.totalDistance);
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// КРОСС — АКТИВНЫЕ БЕГУНЫ (live-map)
// ═══════════════════════════════════════════

// POST /api/runs/active — обновить/удалить мою позицию
app.post('/api/runs/active', requireAuth, async (req, res) => {
  try {
    const { userId, lat, lon, isActive } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });
    const docRef = db.collection('activeRunners').doc(userId);
    if (isActive === false) {
      await docRef.set({ userId, isActive: false, updatedAt: new Date().toISOString() }, { merge: true });
    } else {
      await docRef.set({
        userId,
        lat: parseFloat(lat) || 0,
        lon: parseFloat(lon) || 0,
        isActive: true,
        updatedAt: new Date().toISOString()
      });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/runs/active — получить всех активных бегунов (обновившихся за последние 5 минут)
app.get('/api/runs/active', requireAuth, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const snap = await db.collection('activeRunners').where('isActive', '==', true).get();
    const runners = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.updatedAt && r.updatedAt >= cutoff);
    res.json(runners);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// CRON — напоминания об оплате (каждый день в 9:00)
// ═══════════════════════════════════════════
cron.schedule('0 9 * * *', async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`[CRON] Проверка оплат на ${today}`);
    const snap  = await db.collection('users').where('role', '==', 'student').get();
    let count = 0;
    for (const doc of snap.docs) {
      const u = doc.data();
      if (u.paymentDate === today) {
        count++;
        await tgSend(COACH_TG, `💳 <b>Оплата сегодня!</b>\nУченик: <b>${u.name}</b>`);
        if (u.telegramId) {
          await tgSend(u.telegramId, `💳 <b>Напоминание об оплате!</b>\nСегодня дата оплаты абонемента. Свяжись с тренером 💪`);
        }
      }
    }
    console.log(`[CRON] Оплат сегодня: ${count}`);
  } catch (e) { console.error('CRON error:', e.message); }
});

// ═══════════════════════════════════════════
// ЗАПУСК
// ═══════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n🚀 Coach Space → http://localhost:${PORT}`);
  console.log(`📋 Telegram уведомления: ${bot ? '✅ включены' : '❌ отключены (нет TELEGRAM_BOT_TOKEN)'}`);
  console.log(`📣 ID тренера (COACH_TG): ${COACH_TG}\n`);
});

// SPA fallback — СТРОГО ПОСЛЕДНЕЙ!
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
