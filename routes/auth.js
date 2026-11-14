
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// POST: Хэрэглэгч бүртгүүлэх
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Шаардлагатай талбар шалгах
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Нэр, имэйл, нууц үгээ бүрэн бөглөнө үү.'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Оролтын утгуудыг шалгах
    if (!cleanName || !cleanEmail) {
      return res.status(400).json({
        success: false,
        message: 'Нэр болон имэйл хоосон байж болохгүй.'
      });
    }

    if (cleanName.length > 100 || cleanEmail.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Нэр эсвэл имэйлийн урт хэтэрсэн байна.'
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Имэйл хаягийн формат буруу байна.'
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Нууц үг хамгийн багадаа 8 тэмдэгт байна.'
      });
    }

    // Имэйл давхардсан эсэхийг шалгах
    const [existingUsers] = await db.query(
      'SELECT user_id FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Энэ имэйл хаяг бүртгэлтэй байна.'
      });
    }

    // Нууц үгийг hash хийх
    const passwordHash = await bcrypt.hash(password, 10);

    // Хэрэглэгчийг database-д хадгалах
    const [result] = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES (?, ?, ?)`,
      [cleanName, cleanEmail, passwordHash]
    );

    return res.status(201).json({
      success: true,
      message: 'Хэрэглэгч амжилттай бүртгэгдлээ.',
      data: {
        user_id: result.insertId,
        name: cleanName,
        email: cleanEmail
      }
    });

  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Энэ имэйл хаяг бүртгэлтэй байна.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Бүртгэл хийх үед серверийн алдаа гарлаа.'
    });
  }
});

module.exports = router;
