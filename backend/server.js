require('dotenv').config(); // Загружает переменные из .env

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));



const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Подключение к MongoDB
mongoose.connect('mongodb+srv://ваш_логин:ваш_пароль@ваш_кластер.mongodb.net/ваша_бд?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Модель пользователя
const User = mongoose.model('User', new mongoose.Schema({
  telegramId: { type: Number, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  gamesPlayed: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  lastPlayed: { type: Date, default: Date.now }
}));

// Сохранение данных пользователя
app.post('/api/save-user', async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName } = req.body;
    
    const user = await User.findOneAndUpdate(
      { telegramId },
      { 
        username,
        firstName,
        lastName,
        lastPlayed: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получение данных пользователя
app.get('/api/user', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.query.id });
    res.json(user || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновление счета
app.post('/api/save-score', async (req, res) => {
  try {
    const { telegramId, score } = req.body;
    
    const user = await User.findOneAndUpdate(
      { telegramId },
      { 
        $inc: { gamesPlayed: 1 },
        $max: { bestScore: score },
        lastPlayed: new Date()
      },
      { new: true }
    );
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Лидерборд
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await User.find()
      .sort({ bestScore: -1 })
      .limit(10);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
