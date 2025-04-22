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
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Models
const weeklyLeaderboardSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  score: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const userProfileSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  joinDate: { type: Date, default: Date.now }
});

const WeeklyLeaderboard = mongoose.model('WeeklyLeaderboard', weeklyLeaderboardSchema, 'weekly_leaderboard');
const UserProfile = mongoose.model('UserProfile', userProfileSchema, 'user_profiles');

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

// API Endpoints
app.post('/api/save', async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName, score } = req.body;
    
    // Validate and normalize data
    const userData = {
      telegramId: Number(telegramId),
      username: username || `user_${telegramId}`,
      firstName: firstName || 'Unknown',
      lastName: lastName || '',
      score: Number(score)
    };

    // Save to leaderboard
    const leaderboardEntry = await WeeklyLeaderboard.create({ 
      telegramId: userData.telegramId, 
      score: userData.score 
    });
    
    // Update user profile
    await UserProfile.findOneAndUpdate(
      { telegramId: userData.telegramId },
      { 
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        $setOnInsert: { joinDate: new Date() }
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, entry: leaderboardEntry });
    
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await UserProfile.findOne({ telegramId: Number(req.params.id) });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const bestScore = await WeeklyLeaderboard.findOne({ telegramId: Number(req.params.id) })
      .sort({ score: -1 })
      .limit(1);
      
    const gamesPlayed = await WeeklyLeaderboard.countDocuments({ telegramId: Number(req.params.id) });
    
    res.json({
      success: true,
      user: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        joinDate: user.joinDate
      },
      stats: {
        bestScore: bestScore?.score || 0,
        gamesPlayed
      }
    });
  } catch (error) {
    console.error('User data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
          "user.lastName": 1,
          "user.telegramId": 1
        }
      }
    ]);
    res.json({ success: true, leaders });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve game HTML
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
  WeeklyLeaderboard.createIndexes();
  UserProfile.createIndexes();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🕹️ Game WebApp URL: ${WEB_APP_URL}`);
  });
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
