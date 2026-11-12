
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/found-items - бүх олдсон эд зүйлийг жагсаах
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT fi.item_id, fi.user_id, u.name AS registered_by,
              fi.item_name, fi.category, fi.description,
              DATE_FORMAT(fi.found_date, '%Y-%m-%d') AS found_date,
              fi.found_location, fi.status, fi.created_at
       FROM found_items fi
       INNER JOIN users u ON u.user_id = fi.user_id
       ORDER BY fi.created_at DESC`
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('GET /found-items error:', error);
    res.status(500).json({
      success: false,
      message: 'Олдсон эд зүйлийн мэдээлэл авахад алдаа гарлаа.'
    });
  }
});

// POST /api/found-items - олдсон эд зүйл бүртгэх
router.post('/', async (req, res) => {
  const {
    user_id,
    item_name,
    category,
    description,
    found_date,
    found_location
  } = req.body;

  // Шаардлагатай талбар шалгах
  const required = {
    user_id,
    item_name,
    category,
    description,
    found_date,
    found_location
  };

  const missing = Object.entries(required)
    .filter(([key, value]) =>
      value === undefined ||
      value === null ||
      String(value).trim() === ''
    )
    .map(([key]) => key);

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Шаардлагатай талбаруудыг бөглөнө үү.',
      missing_fields: missing
    });
  }

  const parsedUserId = Number(user_id);

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'user_id эерэг бүхэл тоо байх ёстой.'
    });
  }

  // Огноо шалгах
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(found_date))) {
    return res.status(400).json({
      success: false,
      message: 'found_date нь YYYY-MM-DD форматтай байна.'
    });
  }

  const date = new Date(`${found_date}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== found_date
  ) {
    return res.status(400).json({
      success: false,
      message: 'Олсон огноо хүчинтэй биш байна.'
    });
  }

  if (
    String(item_name).trim().length > 150 ||
    String(category).trim().length > 80 ||
    String(found_location).trim().length > 255
  ) {
    return res.status(400).json({
      success: false,
      message: 'Нэр, ангилал эсвэл байршлын урт хэтэрсэн байна.'
    });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO found_items
       (user_id, item_name, category, description,
        found_date, found_location)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        parsedUserId,
        String(item_name).trim(),
        String(category).trim(),
        String(description).trim(),
        found_date,
        String(found_location).trim()
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Олдсон эд зүйлийн мэдээлэл амжилттай бүртгэгдлээ.',
      item_id: result.insertId
    });

  } catch (error) {
    console.error('POST /found-items error:', error);

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Ийм user_id-тэй хэрэглэгч олдсонгүй.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Бүртгэх үед өгөгдлийн сангийн алдаа гарлаа.'
    });
  }
});

module.exports = router;
