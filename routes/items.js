
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET: Гээсэн болон олдсон эд зүйлсийн нэгдсэн жагсаалт,
// хайлт болон ангиллын шүүлтүүртэй
router.get('/', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string'
      ? req.query.search.trim()
      : '';

    const category = typeof req.query.category === 'string'
      ? req.query.category.trim()
      : '';

    const type = typeof req.query.type === 'string'
      ? req.query.type.trim().toLowerCase()
      : '';

    // Оролтын утгуудыг шалгах
    if (search.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Хайлтын утга 150 тэмдэгтээс хэтэрч болохгүй.'
      });
    }

    if (category.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Ангиллын нэр 80 тэмдэгтээс хэтэрч болохгүй.'
      });
    }

    if (type && !['lost', 'found'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "type нь 'lost' эсвэл 'found' байх ёстой."
      });
    }

    // SQL нөхцөл болон параметрүүд
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`(
        item_name LIKE ?
        OR description LIKE ?
        OR category LIKE ?
        OR item_location LIKE ?
      )`);

      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (type) {
      conditions.push('item_type = ?');
      params.push(type);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Хоёр хүснэгтийн мэдээллийг нэгтгэх
    const sql = `
      SELECT *
      FROM (
        SELECT
          item_id,
          user_id,
          item_name,
          category,
          description,
          lost_date AS item_date,
          lost_location AS item_location,
          status,
          created_at,
          'lost' AS item_type,
          'Гээсэн' AS item_type_label
        FROM lost_items

        UNION ALL

        SELECT
          item_id,
          user_id,
          item_name,
          category,
          description,
          found_date AS item_date,
          found_location AS item_location,
          status,
          created_at,
          'found' AS item_type,
          'Олдсон' AS item_type_label
        FROM found_items
      ) AS items
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      filters: {
        search: search || null,
        category: category || null,
        type: type || null
      },
      data: rows
    });

  } catch (error) {
    console.error('Items list error:', error);

    return res.status(500).json({
      success: false,
      message: 'Эд зүйлсийн жагсаалт авах үед алдаа гарлаа.'
    });
  }
});

module.exports = router;
