require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Подключаем MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.log('MongoDB error:', err));

// Разрешаем запросы от фронтенда
app.use(cors());
app.use(express.json());

// Тестовый маршрут
app.get('/', (req, res) => {
  res.send('FoxGem Backend is LIVE!');
});

// Сохранение результатов игры
app.post('/api/save', async (req, res) => {
  const { telegramId, score } = req.body;
  console.log(`User ${telegramId} scored ${score}`);
  res.json({ success: true });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
