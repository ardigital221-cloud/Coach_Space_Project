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
    const contentType = (metadata.contentType) || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    file.createReadStream()
      .on('error', (e) => { console.error('Stream error:', e.message); res.status(500).end(); })
      .pipe(res);
  } catch (e) {
    console.error('IMG PROXY:', e.message);
    res.status(500).send('Error');
  }
});

// ═══════════════════════════════════════════
// АВТОРИЗАЦИЯ
// ═══════════════════════════════════════════
app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
    const snap = await db.collection('users').where('login', '==', login).limit(1).get();
    if (snap.empty) return res.status(401).json({ error: 'Пользователь не найден' });
    const doc  = snap.docs[0];
    const user = { id: doc.id, ...doc.data() };
    if (user.password !== password) return res.status(401).json({ error: 'Неверный пароль' });
    delete user.password;
    res.json({ user });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/me/:id', async (req, res) => {
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
app.get('/api/users', async (req, res) => {
  try {
    const snap = await db.collection('users').where('role', '==', 'student').get();
    const users = snap.docs.map(d => { const u = { id: d.id, ...d.data() }; delete u.password; return u; });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const user = { id: doc.id, ...doc.data() };
    delete user.password;
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, login, password, telegramId, sessions, paymentDate } = req.body;
    if (!name || !login || !password) return res.status(400).json({ error: 'Имя, логин и пароль обязательны' });
    const exists = await db.collection('users').where('login', '==', login).limit(1).get();
    if (!exists.empty) return res.status(400).json({ error: 'Логин уже занят' });
    const ref = await db.collection('users').add({
      name, login, password, role: 'student',
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

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, password, telegramId, sessions, paymentDate } = req.body;
    const upd = {};
    if (name !== undefined) upd.name = name;
    if (password) upd.password = password;
    if (telegramId !== undefined) upd.telegramId = telegramId;
    if (sessions !== undefined) upd.sessions = parseInt(sessions);
    if (paymentDate !== undefined) upd.paymentDate = paymentDate;
    await db.collection('users').doc(req.params.id).update(upd);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.collection('users').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/attendance', async (req, res) => {
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
app.get('/api/users/:id/plan', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const { trainingPlan, planUpdatedAt } = doc.data();
    res.json({ trainingPlan: trainingPlan || null, planUpdatedAt: planUpdatedAt || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/plan', async (req, res) => {
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
app.get('/api/workouts', async (req, res) => {
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

app.post('/api/workouts', async (req, res) => {
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

app.delete('/api/workouts/:id', async (req, res) => {
  try {
    await db.collection('workouts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ПРОГРЕСС (вес + фото)
// ═══════════════════════════════════════════
app.get('/api/progress/:userId', async (req, res) => {
  try {
    const snap = await db.collection('progress').where('userId', '==', req.params.userId).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/progress', async (req, res) => {
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

app.post('/api/progress/photo', upload.single('photo'), async (req, res) => {
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
app.delete('/api/progress/photo/:photoId', async (req, res) => {
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
app.delete('/api/progress/:userId/weight', async (req, res) => {
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
app.get('/api/posts', async (req, res) => {
  try {
    const snap = await db.collection('posts').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', async (req, res) => {
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

app.delete('/api/posts/:id', async (req, res) => {
  try {
    await db.collection('posts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/react', async (req, res) => {
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

app.post('/api/posts/:id/vote', async (req, res) => {
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
app.get('/api/shop', async (req, res) => {
  try {
    const snap = await db.collection('shop').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ Создание товара — первичная загрузка (одно или несколько фото через upload.array)
app.post('/api/shop', upload.array('photos', 10), async (req, res) => {
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
app.post('/api/shop/:id/photos', upload.single('photo'), async (req, res) => {
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
app.delete('/api/shop/:id/photos/:idx', async (req, res) => {
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

app.delete('/api/shop/:id', async (req, res) => {
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

app.post('/api/shop/:id/order', async (req, res) => {
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
app.get('/api/diary/:userId', async (req, res) => {
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

app.get('/api/diary/:userId/:date', async (req, res) => {
  try {
    const doc = await db.collection('diary')
      .doc(`${req.params.userId}_${req.params.date}`).get();
    res.json(doc.exists ? { id: doc.id, ...doc.data() } : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/diary/:userId', async (req, res) => {
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

app.delete('/api/diary/:userId/:entryId', async (req, res) => {
  try {
    const doc = await db.collection('diary').doc(req.params.entryId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Запись не найдена' });
    if (doc.data().userId !== req.params.userId) return res.status(403).json({ error: 'Нет доступа' });
    await db.collection('diary').doc(req.params.entryId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/diary/:userId/:entryId', async (req, res) => {
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
app.get('/api/records/:userId', async (req, res) => {
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
app.get('/api/reviews', async (req, res) => {
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

app.post('/api/reviews', async (req, res) => {
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

app.delete('/api/reviews/:id', async (req, res) => {
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
app.get('/api/notes/:userId', async (req, res) => {
  try {
    const snap = await db.collection('notes')
      .where('userId', '==', req.params.userId).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notes/:userId', async (req, res) => {
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

app.delete('/api/notes/:userId/:noteId', async (req, res) => {
  try {
    await db.collection('notes').doc(req.params.noteId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════
// ВИДЕОТЕКА УПРАЖНЕНИЙ
// ═══════════════════════════════════════════

// GET /api/exercise-videos — возвращает объект { exerciseName: { id, url } }
app.get('/api/exercise-videos', async (req, res) => {
  try {
    const snap = await db.collection('exerciseVideos').get();
    const result = {};
    snap.docs.forEach(d => {
      result[d.data().exerciseName] = { id: d.id, url: d.data().videoUrl };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/exercise-videos — загрузить видео для упражнения
app.post('/api/exercise-videos', uploadVideo.single('video'), async (req, res) => {
  try {
    const exerciseName = (req.body.exerciseName || '').trim();
    if (!exerciseName) return res.status(400).json({ error: 'exerciseName обязателен' });
    if (!req.file)     return res.status(400).json({ error: 'Видео файл обязателен' });

    const safeName = require('path').basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `exercise-videos/${Date.now()}_${safeName}`;
    const file = bucket.file(fileName);
    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype, cacheControl: 'public, max-age=31536000' }
    });
    const videoUrl = `/api/img/${encodeURIComponent(fileName)}`;

    // Если для этого упражнения уже есть видео — удаляем старое
    const existing = await db.collection('exerciseVideos')
      .where('exerciseName', '==', exerciseName).limit(1).get();
    if (!existing.empty) {
      const old = existing.docs[0];
      if (old.data().storagePath) {
        await bucket.file(old.data().storagePath).delete().catch(() => {});
      }
      await old.ref.delete();
    }

    const ref = await db.collection('exerciseVideos').add({
      exerciseName,
      videoUrl,
      storagePath: fileName,
      createdAt: new Date().toISOString()
    });
    console.log(`[VIDEO-UPLOAD] "${exerciseName}" → ${fileName}`);
    res.json({ id: ref.id, videoUrl });
  } catch (e) {
    console.error('[VIDEO-UPLOAD-ERR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/exercise-videos/:id — удалить видео по ID документа
app.delete('/api/exercise-videos/:id', async (req, res) => {
  try {
    const doc = await db.collection('exerciseVideos').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Видео не найдено' });
    if (doc.data().storagePath) {
      await bucket.file(doc.data().storagePath).delete().catch(e => {
        console.warn(`[VIDEO-DEL] Storage: ${e.message}`);
      });
    }
    await doc.ref.delete();
    console.log(`[VIDEO-DEL] "${doc.data().exerciseName}" удалено`);
    res.json({ success: true });
  } catch (e) {
    console.error('[VIDEO-DEL-ERR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════
// ЭКСПОРТ EXCEL
// ═══════════════════════════════════════════
app.get('/api/export/students', async (req, res) => {
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
app.post('/api/notifications/test', async (req, res) => {
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
