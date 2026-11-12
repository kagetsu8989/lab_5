  const express = require('express');
  const router = express.Router();
  const db = require('../config/db');

  // GET /api/lost-items - бүх гээсэн эд зүйлийг жагсаах
  router.get('/', async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT li.item_id, li.user_id, u.name AS registered_by,
                li.item_name, li.category, li.description,
                DATE_FORMAT(li.lost_date, '%Y-%m-%d') AS lost_date,
                li.lost_location, li.status, li.created_at
        FROM lost_items li
        INNER JOIN users u ON u.user_id = li.user_id
        ORDER BY li.created_at DESC`
      );

      res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
      console.error('GET /lost-items error:', error);
      res.status(500).json({ success: false, message: 'Өгөгдөл авахад алдаа гарлаа.' });
    }
  });

  // POST /api/lost-items - гээсэн эд зүйл бүртгэх
  router.post('/', async (req, res) => {
    const {
      user_id,
      item_name,
      category,
      description,
      lost_date,
      lost_location
    } = req.body;

    // Шаардлагатай талбаруудыг шалгах
    const required = { user_id, item_name, category, description, lost_date, lost_location };
    const missing = Object.entries(required)
      .filter(([key, value]) => value === undefined || value === null || String(value).trim() === '')
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
      return res.status(400).json({ success: false, message: 'user_id эерэг бүхэл тоо байх ёстой.' });
    }

    // YYYY-MM-DD форматыг болон бодит огноог шалгах
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(lost_date))) {
      return res.status(400).json({ success: false, message: 'lost_date нь YYYY-MM-DD форматтай байна.' });
    }
    const date = new Date(`${lost_date}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== lost_date) {
      return res.status(400).json({ success: false, message: 'Алдсан огноо хүчинтэй биш байна.' });
    }

    if (String(item_name).trim().length > 150 || String(category).trim().length > 80 ||
        String(lost_location).trim().length > 255) {
      return res.status(400).json({ success: false, message: 'Нэр, ангилал эсвэл байршлын урт хэтэрсэн байна.' });
    }

    try {
      // Parameterized query нь SQL injection эрсдэлийг бууруулна.
      const [result] = await db.execute(
        `INSERT INTO lost_items
        (user_id, item_name, category, description, lost_date, lost_location)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          parsedUserId,
          String(item_name).trim(),
          String(category).trim(),
          String(description).trim(),
          lost_date,
          String(lost_location).trim()
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Гээсэн эд зүйлийн мэдээлэл амжилттай бүртгэгдлээ.',
        item_id: result.insertId
      });
    } catch (error) {
      console.error('POST /lost-items error:', error);
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ success: false, message: 'Ийм user_id-тэй хэрэглэгч олдсонгүй.' });
      }
      res.status(500).json({ success: false, message: 'Бүртгэх үед өгөгдлийн сангийн алдаа гарлаа.' });
    }
  });

  module.exports = router;
