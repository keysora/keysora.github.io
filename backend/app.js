require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api'); // Add Telegram

const app = express();

// 1. MongoDB Connection (Improved)
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// 2. Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500' // Adjust to your frontend
}));
app.use(express.json());

// 3. Telegram Bot Setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Hello from FoxGem! Your ID: ${chatId}`);
});

// 4. Database Model (Add this before routes)
const GameResult = mongoose.model('GameResult', new mongoose.Schema({
  telegramId: { type: Number, required: true },
  score: { type: Number, required: true },
  date: { type: Date, default: Date.now }
}));

// 5. Enhanced Game Saving Route
app.post('/api/save', async (req, res) => {
  try {
    const { telegramId, score } = req.body;
    
    // Save to MongoDB
    const result = await GameResult.create({ telegramId, score });
    
    // Notify user via Telegram
    await bot.sendMessage(telegramId, `Your score ${score} was saved!`);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false });
  }
});

// 6. Frontend Serving (Add if you want Express to serve HTML)
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// 7. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:' + PORT}`);
});
