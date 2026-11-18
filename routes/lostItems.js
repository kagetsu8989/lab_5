
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ============================================
// GET /api/lost-items
// Бүх гээсэн эд зүйлийн жагсаалт
// ============================================

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
          li.item_id,
          li.user_id,
          u.name AS registered_by,
          li.item_name,
          li.category,
          li.description,
          DATE_FORMAT(li.lost_date, '%Y-%m-%d') AS lost_date,
          li.lost_location,
          li.status,
          li.created_at
       FROM lost_items li
       INNER JOIN users u ON u.user_id = li.user_id
       ORDER BY li.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('GET /lost-items error:', error);

    return res.status(500).json({
      success: false,
      message: 'Өгөгдөл авахад алдаа гарлаа.'
    });
  }
});


// ============================================
// POST /api/lost-items
// Шинэ гээсэн эд зүйл бүртгэх
// ============================================

router.post('/', async (req, res) => {
  const {
    user_id,
    item_name,
    category,
    description,
    lost_date,
    lost_location
  } = req.body || {};

  const required = {
    user_id,
    item_name,
    category,
    description,
    lost_date,
    lost_location
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

  if (
    !Number.isSafeInteger(parsedUserId) ||
    parsedUserId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'user_id эерэг бүхэл тоо байх ёстой.'
    });
  }

  // Огнооны формат шалгах
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(lost_date))) {
    return res.status(400).json({
      success: false,
      message: 'lost_date нь YYYY-MM-DD форматтай байна.'
    });
  }

  const date = new Date(`${lost_date}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== lost_date
  ) {
    return res.status(400).json({
      success: false,
      message: 'Алдсан огноо хүчинтэй биш байна.'
    });
  }

  if (
    String(item_name).trim().length > 150 ||
    String(category).trim().length > 80 ||
    String(lost_location).trim().length > 255
  ) {
    return res.status(400).json({
      success: false,
      message: 'Нэр, ангилал эсвэл байршлын урт хэтэрсэн байна.'
    });
  }

  try {
    // Хэрэглэгч бүртгэлтэй эсэх
    const [users] = await db.execute(
      'SELECT user_id FROM users WHERE user_id = ?',
      [parsedUserId]
    );

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Ийм user_id-тэй хэрэглэгч олдсонгүй.'
      });
    }

    const [result] = await db.execute(
      `INSERT INTO lost_items
        (
          user_id,
          item_name,
          category,
          description,
          lost_date,
          lost_location
        )
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

    return res.status(201).json({
      success: true,
      message: 'Гээсэн эд зүйлийн мэдээлэл амжилттай бүртгэгдлээ.',
      item_id: result.insertId
    });
  } catch (error) {
    console.error('POST /lost-items error:', error);

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Ийм user_id-тэй хэрэглэгч олдсонгүй.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Бүртгэх үед серверийн алдаа гарлаа.'
    });
  }
});


// ============================================
// GET /api/lost-items/:id
// Нэг эд зүйлийн дэлгэрэнгүй мэдээлэл
// ============================================

router.get('/:id', async (req, res) => {
  const itemId = Number(req.params.id);

  if (
    !Number.isSafeInteger(itemId) ||
    itemId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'ID буруу байна.'
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT
          li.item_id,
          li.user_id,
          u.name AS registered_by,
          li.item_name,
          li.category,
          li.description,
          DATE_FORMAT(li.lost_date, '%Y-%m-%d') AS lost_date,
          li.lost_location,
          li.status,
          li.created_at
       FROM lost_items li
       INNER JOIN users u ON li.user_id = u.user_id
       WHERE li.item_id = ?`,
      [itemId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Эд зүйл олдсонгүй.'
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('GET /lost-items/:id error:', error);

    return res.status(500).json({
      success: false,
      message: 'Серверийн алдаа.'
    });
  }
});


// ============================================
// JWT шалгах туслах функц
// PATCH болон DELETE үйлдэлд ашиглана
// ============================================

function authenticate(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(
    req.headers.authorization || ''
  );

  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'Нэвтрэх шаардлагатай.'
    });
  }

  try {
    const decoded = jwt.verify(
      match[1],
      process.env.JWT_SECRET,
      { algorithms: ['HS256'] }
    );

    const userId = Number(decoded.user_id);

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw new Error('Invalid user ID');
    }

    req.userId = userId;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token хүчингүй эсвэл хугацаа дууссан.'
    });
  }
}


// ============================================
// PATCH /api/lost-items/:id
// Өөрийн эд зүйлийн мэдээллийг шинэчлэх
// ============================================

router.patch('/:id', authenticate, async (req, res) => {
  const itemId = Number(req.params.id);
  const userId = req.userId;

  if (
    !Number.isSafeInteger(itemId) ||
    itemId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Эд зүйлийн ID буруу байна.'
    });
  }

  // Зөвшөөрөгдсөн талбарууд
  const limits = {
    item_name: 150,
    category: 80,
    description: null,
    lost_date: null,
    lost_location: 255
  };

  const input = req.body;

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    return res.status(400).json({
      success: false,
      message: 'JSON object илгээнэ үү.'
    });
  }

  const fields = Object.keys(input);

  if (
    fields.length === 0 ||
    fields.some(field => !Object.hasOwn(limits, field))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Засварлах талбар буруу эсвэл хоосон байна.'
    });
  }

  const values = [];

  for (const field of fields) {
    const value = input[field];

    if (
      typeof value !== 'string' ||
      !value.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: `${field} талбар буруу байна.`
      });
    }

    const cleanValue = value.trim();

    if (
      limits[field] !== null &&
      cleanValue.length > limits[field]
    ) {
      return res.status(400).json({
        success: false,
        message: `${field} талбар хэт урт байна.`
      });
    }

    if (field === 'lost_date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
        return res.status(400).json({
          success: false,
          message: 'Огноо YYYY-MM-DD форматтай байна.'
        });
      }

      const date = new Date(`${cleanValue}T00:00:00Z`);

      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== cleanValue
      ) {
        return res.status(400).json({
          success: false,
          message: 'Огноо хүчинтэй биш байна.'
        });
      }
    }

    values.push(cleanValue);
  }

  try {
    const [rows] = await db.execute(
      'SELECT user_id FROM lost_items WHERE item_id = ?',
      [itemId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Эд зүйл олдсонгүй.'
      });
    }

    // Зөвхөн өөрийн бүртгэлээ засах эрхтэй
    if (Number(rows[0].user_id) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Энэ мэдээллийг засах эрхгүй.'
      });
    }

    const setClause = fields
      .map(field => `${field} = ?`)
      .join(', ');

    const [result] = await db.execute(
      `UPDATE lost_items
       SET ${setClause}
       WHERE item_id = ? AND user_id = ?`,
      [...values, itemId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Бүртгэл олдсонгүй.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Мэдээлэл амжилттай шинэчлэгдлээ.',
      item_id: itemId
    });
  } catch (error) {
    console.error('PATCH /lost-items/:id error:', error);

    return res.status(500).json({
      success: false,
      message: 'Серверийн алдаа гарлаа.'
    });
  }
});


// ============================================
// DELETE /api/lost-items/:id
// Зөвхөн өөрийн бүртгэсэн эд зүйлийг устгах
// ============================================

router.delete('/:id', authenticate, async (req, res) => {
  const itemId = Number(req.params.id);
  const userId = req.userId;

  if (
    !Number.isSafeInteger(itemId) ||
    itemId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Эд зүйлийн ID буруу байна.'
    });
  }

  try {
    // Бүртгэл байгаа эсэх, эзэмшигчийг шалгах
    const [rows] = await db.execute(
      'SELECT user_id FROM lost_items WHERE item_id = ?',
      [itemId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Эд зүйл олдсонгүй.'
      });
    }

    if (Number(rows[0].user_id) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Энэ эд зүйлийг устгах эрхгүй.'
      });
    }

    const [result] = await db.execute(
      'DELETE FROM lost_items WHERE item_id = ? AND user_id = ?',
      [itemId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Эд зүйл олдсонгүй.'
      });
    }

    // 204 статус нь response body-гүй байна
    return res.status(204).send();
  } catch (error) {
    console.error('DELETE /lost-items/:id error:', error);

    return res.status(500).json({
      success: false,
      message: 'Серверийн алдаа гарлаа.'
    });
  }
});


// ============================================
// Router export
// ============================================

module.exports = router;
