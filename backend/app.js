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
app.use(express.static(path.join(__dirname, '../public'))); // Serve static files

// MongoDB Models
const WeeklyLeaderboard = mongoose.model('WeeklyLeaderboard', new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  score: { type: Number, required: true },
  date: { type: Date, default: Date.now }
}), 'weekly_leaderboard');

const UserProfile = mongoose.model('UserProfile', new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  joinDate: { type: Date, default: Date.now }
}), 'user_profiles');

// Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Web App URL (replace with your actual URL)
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

// Handle game data submissions from Web App
app.post('/api/save', async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName, score } = req.body;
    
    const leaderboardEntry = await WeeklyLeaderboard.create({ telegramId, score });
    
    await UserProfile.updateOne(
      { telegramId },
      { 
        $setOnInsert: { 
          username, 
          firstName, 
          lastName,
          joinDate: new Date() 
        }
      },
      { upsert: true }
    );
    
    await bot.sendMessage(telegramId, `🎉 Ваш результат ${score} сохранен!`);
    res.json({ success: true, entry: leaderboardEntry });
    
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false });
  }
});

// Game endpoint (serves your game HTML)
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/game.html'));
});

// Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaders = await WeeklyLeaderboard.aggregate([
      {
        $lookup: {
          from: "user_profiles",
          localField: "telegramId",
          foreignField: "telegramId",
          as: "user"
        }
      },
      { $unwind: "$user" },
      { $sort: { score: -1 } },
      { $limit: 10 },
      {
        $project: {
          score: 1,
          date: 1,
          "user.username": 1,
          "user.firstName": 1,
          "user.lastName": 1
        }
      }
    ]);
  res.json({ success: true, leaders });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  
  // Create indexes
  WeeklyLeaderboard.createIndex({ score: -1 });
  WeeklyLeaderboard.createIndex({ date: 1 });
  UserProfile.createIndex({ telegramId: 1 }, { unique: true });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🕹️ Game WebApp URL: ${WEB_APP_URL}`);
  });
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
