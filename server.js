/**
 * server.js — Основной серверный файл фитнес-приложения
 * Стек: Express.js + Firebase Firestore + Telegraf (Telegram-бот) + node-cron
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ────────────────────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ FIREBASE
// ────────────────────────────────────────────────────────────
// Для работы необходим файл serviceAccountKey.json в корне проекта
// или переменная окружения FIREBASE_SERVICE_ACCOUNT с JSON-строкой
let db;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });

  db = admin.firestore();
  console.log('✅ Firebase Firestore подключён');
} catch (err) {
  console.warn('⚠️  Firebase не инициализирован — работаем в режиме DEMO (данные в памяти)');
  console.warn('   Создайте файл serviceAccountKey.json или задайте FIREBASE_SERVICE_ACCOUNT');
  db = null;
}

// ────────────────────────────────────────────────────────────
// DEMO-ХРАНИЛИЩЕ (если Firebase не подключён)
// ────────────────────────────────────────────────────────────
const demoData = {
  users: [
    {
      id: 'admin',
      name: 'Тренер Александр',
      phone: 'admin',
      role: 'admin',
      telegramId: null,
      sessions: 0,
      paymentDate: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'user1',
      name: 'Иван Петров',
      phone: '79001234567',
      role: 'student',
      telegramId: null,
      sessions: 8,
      paymentDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    },
    {
      id: 'user2',
      name: 'Мария Сидорова',
      phone: '79007654321',
      role: 'student',
      telegramId: null,
      sessions: 3,
      paymentDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    }
  ],
  schedule: []
};

// ────────────────────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ TELEGRAM-БОТА
// ────────────────────────────────────────────────────────────
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  bot.launch().then(() => console.log('✅ Telegram-бот запущен'));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN не задан — Telegram-уведомления отключены');
}

/**
 * Отправляет сообщение в Telegram конкретному пользователю
 * @param {string|number} telegramId - ID пользователя в Telegram
 * @param {string} message - текст сообщения
 */
async function sendTelegramMessage(telegramId, message) {
  if (!bot || !telegramId) return;
  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    console.log(`📨 Telegram отправлен пользователю ${telegramId}`);
  } catch (err) {
    console.error(`❌ Ошибка отправки Telegram: ${err.message}`);
  }
}

// ────────────────────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ FIRESTORE / DEMO
// ────────────────────────────────────────────────────────────

/** Получить всех пользователей */
async function getAllUsers() {
  if (db) {
    const snap = await db.collection('users').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return [...demoData.users];
}

/** Получить пользователя по ID */
async function getUserById(id) {
  if (db) {
    const doc = await db.collection('users').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }
  return demoData.users.find(u => u.id === id) || null;
}

/** Получить пользователя по телефону */
async function getUserByPhone(phone) {
  if (db) {
    const snap = await db.collection('users').where('phone', '==', phone).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return demoData.users.find(u => u.phone === phone) || null;
}

/** Создать пользователя */
async function createUser(data) {
  if (db) {
    const ref = await db.collection('users').add({ ...data, createdAt: new Date().toISOString() });
    return { id: ref.id, ...data };
  }
  const newUser = { id: 'user_' + Date.now(), ...data, createdAt: new Date().toISOString() };
  demoData.users.push(newUser);
  return newUser;
}

/** Обновить пользователя */
async function updateUser(id, data) {
  if (db) {
    await db.collection('users').doc(id).update(data);
    return { id, ...data };
  }
  const idx = demoData.users.findIndex(u => u.id === id);
  if (idx !== -1) demoData.users[idx] = { ...demoData.users[idx], ...data };
  return demoData.users[idx];
}

/** Удалить пользователя */
async function deleteUser(id) {
  if (db) {
    await db.collection('users').doc(id).delete();
    return;
  }
  demoData.users = demoData.users.filter(u => u.id !== id);
}

/** Получить всё расписание */
async function getAllSchedule() {
  if (db) {
    const snap = await db.collection('schedule').orderBy('datetime').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return [...demoData.schedule].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
}

/** Получить слот по ID */
async function getSlotById(id) {
  if (db) {
    const doc = await db.collection('schedule').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }
  return demoData.schedule.find(s => s.id === id) || null;
}

/** Создать слот расписания */
async function createSlot(data) {
  if (db) {
    const ref = await db.collection('schedule').add(data);
    return { id: ref.id, ...data };
  }
  const slot = { id: 'slot_' + Date.now(), ...data };
  demoData.schedule.push(slot);
  return slot;
}

/** Обновить слот */
async function updateSlot(id, data) {
  if (db) {
    await db.collection('schedule').doc(id).update(data);
    return;
  }
  const idx = demoData.schedule.findIndex(s => s.id === id);
  if (idx !== -1) demoData.schedule[idx] = { ...demoData.schedule[idx], ...data };
}

/** Удалить слот */
async function deleteSlot(id) {
  if (db) {
    await db.collection('schedule').doc(id).delete();
    return;
  }
  demoData.schedule = demoData.schedule.filter(s => s.id !== id);
}

// ────────────────────────────────────────────────────────────
// MIDDLEWARE
// ────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ────────────────────────────────────────────────────────────
// API: АВТОРИЗАЦИЯ
// ────────────────────────────────────────────────────────────

/**
 * POST /api/login
 * Вход по ID или номеру телефона
 * Body: { login: string }
 */
app.post('/api/login', async (req, res) => {
  try {
    const { login } = req.body;
    if (!login) return res.status(400).json({ error: 'Укажите ID или номер телефона' });

    // Сначала ищем по ID, затем по телефону
    let user = await getUserById(login);
    if (!user) user = await getUserByPhone(login);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Возвращаем данные пользователя (без пароля — авторизация по ID/телефону)
    res.json({ success: true, user });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ────────────────────────────────────────────────────────────
// API: ПОЛЬЗОВАТЕЛИ (только для тренера)
// ────────────────────────────────────────────────────────────

/** GET /api/users — список всех учеников */
app.get('/api/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    // Возвращаем только учеников (не admin)
    res.json(users.filter(u => u.role === 'student'));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

/**
 * POST /api/users — создать нового ученика
 * Body: { name, phone, telegramId, sessions, paymentDate }
 */
app.post('/api/users', async (req, res) => {
  try {
    const { name, phone, telegramId, sessions, paymentDate } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Имя и телефон обязательны' });

    // Проверяем, нет ли уже такого телефона
    const existing = await getUserByPhone(phone);
    if (existing) return res.status(409).json({ error: 'Пользователь с таким телефоном уже существует' });

    const user = await createUser({
      name,
      phone,
      telegramId: telegramId || null,
      sessions: parseInt(sessions) || 0,
      paymentDate: paymentDate || null,
      role: 'student'
    });

    res.json({ success: true, user });
  } catch (err) {
    console.error('Ошибка создания пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PUT /api/users/:id — обновить данные ученика
 */
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await updateUser(id, data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

/** DELETE /api/users/:id — удалить ученика */
app.delete('/api/users/:id', async (req, res) => {
  try {
    await deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

/**
 * POST /api/users/:id/mark-attendance — отметить присутствие (списать 1 занятие)
 */
app.post('/api/users/:id/mark-attendance', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Ученик не найден' });
    if (user.sessions <= 0) return res.status(400).json({ error: 'Нет доступных занятий' });

    await updateUser(req.params.id, { sessions: user.sessions - 1 });

    // Уведомление если осталось мало занятий
    if (user.sessions - 1 <= 2 && user.telegramId) {
      await sendTelegramMessage(
        user.telegramId,
        `⚠️ <b>Внимание!</b> У вас осталось <b>${user.sessions - 1}</b> занятий. Пора обновить абонемент!`
      );
    }

    res.json({ success: true, sessionsLeft: user.sessions - 1 });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отметки присутствия' });
  }
});

// ────────────────────────────────────────────────────────────
// API: РАСПИСАНИЕ
// ────────────────────────────────────────────────────────────

/** GET /api/schedule — получить всё расписание */
app.get('/api/schedule', async (req, res) => {
  try {
    const schedule = await getAllSchedule();
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения расписания' });
  }
});

/**
 * POST /api/schedule — создать тренировочный слот
 * Body: { datetime: ISO-строка, duration: минуты, maxStudents }
 */
app.post('/api/schedule', async (req, res) => {
  try {
    const { datetime, duration, maxStudents, title } = req.body;
    if (!datetime) return res.status(400).json({ error: 'Дата и время обязательны' });

    const slot = await createSlot({
      datetime,
      duration: parseInt(duration) || 60,
      maxStudents: parseInt(maxStudents) || 1,
      title: title || 'Тренировка',
      bookedBy: null,  // ID ученика, записавшегося на занятие
      bookedByName: null
    });

    res.json({ success: true, slot });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка создания слота' });
  }
});

/** DELETE /api/schedule/:id — удалить слот */
app.delete('/api/schedule/:id', async (req, res) => {
  try {
    await deleteSlot(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления слота' });
  }
});

/**
 * POST /api/schedule/:id/book — записаться на тренировку
 * Body: { userId: string }
 */
app.post('/api/schedule/:id/book', async (req, res) => {
  try {
    const slot = await getSlotById(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Слот не найден' });
    if (slot.bookedBy) return res.status(409).json({ error: 'Слот уже занят' });

    const user = await getUserById(req.body.userId);
    if (!user) return res.status(404).json({ error: 'Ученик не найден' });
    if (user.sessions <= 0) return res.status(400).json({ error: 'Нет доступных занятий' });

    await updateSlot(req.params.id, {
      bookedBy: user.id,
      bookedByName: user.name
    });

    // Получаем Telegram ID тренера для уведомления
    const allUsers = await getAllUsers();
    const trainer = (await getAllUsers().catch(() => demoData.users)).find(u => u.role === 'admin') ||
      demoData.users.find(u => u.role === 'admin');

    const dateStr = new Date(slot.datetime).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Уведомление ученику
    if (user.telegramId) {
      await sendTelegramMessage(
        user.telegramId,
        `✅ <b>Запись подтверждена!</b>\n📅 ${slot.title} — ${dateStr}\n⏱ Длительность: ${slot.duration} мин.`
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка записи:', err);
    res.status(500).json({ error: 'Ошибка записи на тренировку' });
  }
});

/**
 * POST /api/schedule/:id/cancel — отменить запись
 * Body: { userId: string }
 */
app.post('/api/schedule/:id/cancel', async (req, res) => {
  try {
    const slot = await getSlotById(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Слот не найден' });
    if (slot.bookedBy !== req.body.userId) {
      return res.status(403).json({ error: 'Это не ваша запись' });
    }

    await updateSlot(req.params.id, { bookedBy: null, bookedByName: null });

    // Уведомление ученику об отмене
    const user = await getUserById(req.body.userId);
    if (user && user.telegramId) {
      const dateStr = new Date(slot.datetime).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      await sendTelegramMessage(
        user.telegramId,
        `❌ <b>Запись отменена</b>\n📅 ${slot.title} — ${dateStr}`
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отмены записи' });
  }
});

// ────────────────────────────────────────────────────────────
// CRON: АВТОМАТИЧЕСКИЕ УВЕДОМЛЕНИЯ
// ────────────────────────────────────────────────────────────

/**
 * Каждые 15 минут проверяем занятия, которые начнутся через ~2 часа
 * и отправляем напоминание записавшемуся ученику
 */
cron.schedule('*/15 * * * *', async () => {
  try {
    const schedule = await getAllSchedule();
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;
    const window = 15 * 60 * 1000; // окно 15 минут

    for (const slot of schedule) {
      if (!slot.bookedBy || !slot.datetime) continue;

      const slotTime = new Date(slot.datetime).getTime();
      const diff = slotTime - now;

      // Отправляем напоминание если до занятия осталось от 1:45 до 2:00
      if (diff > twoHours - window && diff <= twoHours) {
        const user = await getUserById(slot.bookedBy);
        if (user && user.telegramId) {
          const dateStr = new Date(slot.datetime).toLocaleString('ru-RU', {
            hour: '2-digit', minute: '2-digit'
          });
          await sendTelegramMessage(
            user.telegramId,
            `⏰ <b>Напоминание!</b>\nЧерез 2 часа (в ${dateStr}) у вас тренировка: <b>${slot.title}</b>.\nНе забудьте взять воду и форму! 💪`
          );
        }
      }
    }
  } catch (err) {
    console.error('Cron (напоминания):', err.message);
  }
});

/**
 * Каждый день в 09:00 проверяем даты оплаты
 * Если сегодня дата оплаты — уведомляем тренера и ученика
 */
cron.schedule('0 9 * * *', async () => {
  try {
    const users = await getAllUsers();
    const today = new Date().toISOString().split('T')[0];

    // Находим тренера для уведомления
    const trainer = users.find(u => u.role === 'admin');

    for (const user of users) {
      if (user.role !== 'student' || !user.paymentDate) continue;
      if (user.paymentDate !== today) continue;

      // Уведомление ученику
      if (user.telegramId) {
        await sendTelegramMessage(
          user.telegramId,
          `💳 <b>Сегодня дата оплаты!</b>\nНе забудьте оплатить абонемент для продолжения тренировок.\nОстаток занятий: <b>${user.sessions}</b>`
        );
      }

      // Уведомление тренеру
      if (trainer && trainer.telegramId) {
        await sendTelegramMessage(
          trainer.telegramId,
          `💳 <b>Дата оплаты ученика</b>\nУченик <b>${user.name}</b> (${user.phone}) должен оплатить абонемент сегодня.\nОстаток занятий: <b>${user.sessions}</b>`
        );
      }
    }
  } catch (err) {
    console.error('Cron (дата оплаты):', err.message);
  }
});

console.log('⏰ Cron-задачи запущены (напоминания каждые 15 мин, оплата в 09:00)');

// ────────────────────────────────────────────────────────────
// SPA: все остальные маршруты отдают index.html
// ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ────────────────────────────────────────────────────────────
// ЗАПУСК СЕРВЕРА
// ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log('📌 Для входа тренера: ID = "admin"');
  console.log('📌 Для входа ученика: телефон или ID\n');
});
