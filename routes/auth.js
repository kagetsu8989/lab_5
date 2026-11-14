
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==========================================
// US-01: ХЭРЭГЛЭГЧ БҮРТГҮҮЛЭХ
// POST /api/auth/register
// ==========================================

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Шаардлагатай талбар шалгах
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Нэр, имэйл, нууц үгээ бүрэн бөглөнө үү.'
      });
    }

    // 2. Өгөгдлийн төрлийг шалгах
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Оролтын өгөгдлийн формат буруу байна.'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // 3. Нэр болон имэйл хоосон эсэх
    if (!cleanName || !cleanEmail) {
      return res.status(400).json({
        success: false,
        message: 'Нэр болон имэйл хоосон байж болохгүй.'
      });
    }

    // 4. Урт шалгах
    if (cleanName.length > 100 || cleanEmail.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Нэр эсвэл имэйлийн урт хэтэрсэн байна.'
      });
    }

    // 5. Имэйлийн формат шалгах
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Имэйл хаягийн формат буруу байна.'
      });
    }

    // 6. Нууц үгийн урт шалгах
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Нууц үг хамгийн багадаа 8 тэмдэгт байна.'
      });
    }

    // 7. Имэйл давхардсан эсэхийг шалгах
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

    // 8. Нууц үгийг bcrypt hash болгох
    const passwordHash = await bcrypt.hash(password, 10);

    // 9. Хэрэглэгчийг database-д хадгалах
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


// ==========================================
// US-02: ХЭРЭГЛЭГЧ НЭВТРЭХ
// POST /api/auth/login
// ==========================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Шаардлагатай талбар шалгах
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Имэйл болон нууц үгээ бөглөнө үү.'
      });
    }

    // 2. Өгөгдлийн төрлийг шалгах
    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Оролтын өгөгдлийн формат буруу байна.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 3. Имэйл хоосон эсэх
    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: 'Имэйл хаягаа оруулна уу.'
      });
    }

    // 4. Хэрэглэгчийг database-ээс хайх
    const [users] = await db.query(
      `SELECT user_id, name, email, password_hash
       FROM users
       WHERE email = ?`,
      [cleanEmail]
    );

    // 5. Хэрэглэгч олдоогүй
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Имэйл эсвэл нууц үг буруу байна.'
      });
    }

    const user = users[0];

    // 6. Нууц үгийг bcrypt ашиглан шалгах
    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Имэйл эсвэл нууц үг буруу байна.'
      });
    }

    // 7. JWT_SECRET тохируулагдсан эсэх
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET тохируулаагүй байна.');
    }

    // 8. JWT token үүсгэх
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1h'
      }
    );

    // 9. Амжилттай нэвтэрсэн хариу
    return res.status(200).json({
      success: true,
      message: 'Амжилттай нэвтэрлээ.',
      token: token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      message: 'Нэвтрэх үед серверийн алдаа гарлаа.'
    });
  }
});


// ==========================================
// ROUTER EXPORT
// ==========================================

module.exports = router;
