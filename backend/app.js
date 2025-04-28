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

// API Endpoints (остаются без изменений)
app.post('/api/save', async (req, res) => {
  /* ... существующий код ... */
});

app.get('/game', (req, res) => {
  /* ... существующий код ... */
});

app.get('/api/leaderboard', async (req, res) => {
  /* ... существующий код ... */
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
