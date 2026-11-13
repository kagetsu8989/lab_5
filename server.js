
const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env')
});

// Route файлуудыг холбох
const lostItemsRoutes = require('./routes/lostItems');
const foundItemsRoutes = require('./routes/foundItems');
const itemsRoutes = require('./routes/items');

// Express application үүсгэх
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Үндсэн хуудас
app.get('/', (req, res) => {
  res.json({
    message: 'Lost & Found API is running',
    endpoints: {
      health: 'GET /api/health',
      lostItems: 'GET /api/lost-items',
      createLostItem: 'POST /api/lost-items',
      foundItems: 'GET /api/found-items',
      createFoundItem: 'POST /api/found-items'
    }
  });
});

// Серверийн ажиллагаа шалгах
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy'
  });
});

// API route-ууд
app.use('/api/lost-items', lostItemsRoutes);
app.use('/api/found-items', foundItemsRoutes);
app.use('/api/items', itemsRoutes);

// Олдоогүй route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route олдсонгүй.'
  });
});

// Алдаа боловсруулах middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  res.status(500).json({
    success: false,
    message: 'Серверийн дотоод алдаа гарлаа.'
  });
});

// Сервер эхлүүлэх
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
