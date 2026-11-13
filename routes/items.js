
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET: Гээсэн болон олдсон эд зүйлсийн нэгдсэн жагсаалт
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
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

      ORDER BY created_at DESC
    `);

    return res.status(200).json({
      success: true,
      count: rows.length,
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
