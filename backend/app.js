require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// MongoDB Models с индексами в схемах
const weeklyLeaderboardSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  score: { type: Number, required: true, index: true },
  date: { type: Date, default: Date.now, index: true }
}, { collection: 'weekly_leaderboard' });

const userProfileSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  joinDate: { type: Date, default: Date.now },
  referralCode: { type: String, unique: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile' },
  referralCount: { type: Number, default: 0 },
  referralBonus: { type: Number, default: 0 },
  lastBonusReset: { type: Date, default: Date.now }}, 
  { collection: 'user_profiles' });

const WeeklyLeaderboard = mongoose.model('WeeklyLeaderboard', weeklyLeaderboardSchema);
const UserProfile = mongoose.model('UserProfile', userProfileSchema);

// Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://keysora.github.io';

// Bot Commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.username || msg.from.first_name;
  
  bot.sendMessage(chatId, `Привет, ${userName}! Хочешь сыграть?`, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: '🎮 Играть сейчас',
          web_app: { url: `${WEB_APP_URL}?tg=${chatId}` }
        }]
      ]
    }
  });
});

// Генерация реферальной ссылки
app.get('/api/referral/:userId', async (req, res) => {
  const user = await UserProfile.findOne({ telegramId: req.params.userId });
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  if (!user.referralCode) {
    user.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    await user.save();
  }
  
  res.json({ 
    code: user.referralCode,
    link: `${WEB_APP_URL}?ref=${user.referralCode}`
  });
});

// Обработка реферала
app.post('/api/referral', async (req, res) => {
  const { referrerCode, newUserId } = req.body;
  
  const referrer = await UserProfile.findOne({ referralCode: referrerCode });
  if (!referrer) return res.status(400).json({ error: 'Invalid referral code' });
  
  // Проверяем, что бонусы еще не начислялись на этой неделе
  const now = new Date();
  const lastReset = new Date(referrer.lastBonusReset);
  const weekAgo = new Date(now.setDate(now.getDate() - 7));
  
  if (lastReset < weekAgo) {
    referrer.referralBonus = 0;
    referrer.lastBonusReset = new Date();
  }
  
  referrer.referralCount += 1;
  referrer.referralBonus += 5; // +5 баллов за реферала
  await referrer.save();


  // Еженедельный сброс в 00:00 по воскресеньям
const cron = require('node-cron');
cron.schedule('0 0 * * 0', async () => {
  await UserProfile.updateMany(
    { referralBonus: { $gt: 0 } },
    { 
      $set: { 
        referralBonus: 0,
        lastBonusReset: new Date() 
      } 
    }
  );
  console.log('Реферальные баллы сброшены!');
});

  
  // Обновляем нового пользователя
  await UserProfile.updateOne(
    { telegramId: newUserId },
    { $set: { invitedBy: referrer._id } }
  );
  
  res.json({ success: true });
});
// API Endpoints (остаются без изменений)
app.post('/api/save', async (req, res) => {
  /* ... существующий код ... */
});

app.get('/game', (req, res) => {
  /* ... существующий код ... */
});

app.get('/api/leaderboard', async (req, res) => {
  const leaderboard = await UserProfile.aggregate([
    {
      $project: {
        username: 1,
        score: 1,
        referralBonus: 1,
        totalScore: { $add: ['$score', '$referralBonus'] }
      }
    },
    { $sort: { totalScore: -1 } },
    { $limit: 10 }
  ]);
  
  res.json(leaderboard);
});

app.get('/api/health', (req, res) => {
  /* ... существующий код ... */
});

// Исправленное подключение к MongoDB
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true // Автоматическое создание индексов
    });
    
    console.log('✅ MongoDB connected successfully');
    
    // Явная проверка индексов (не обязательно, т.к. autoIndex: true)
    try {
      await WeeklyLeaderboard.syncIndexes();
      await UserProfile.syncIndexes();
      console.log('✅ Indexes verified');
    } catch (indexError) {
      console.warn('⚠️ Index verification warning:', indexError.message);
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🕹️ Game WebApp URL: ${WEB_APP_URL}`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
}

// Запуск сервера
startServer();
