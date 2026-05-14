const express = require('express');
const multer = require('multer');
const path = require('path');
const { get, all, run } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Multer setup for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// List transactions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, category, startDate, endDate, page, limit, search } = req.query;
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    let idx = 1;
    
    if (type) { sql += ` AND type = $${idx++}`; params.push(type); }
    if (category) { sql += ` AND category = $${idx++}`; params.push(category); }
    if (startDate) { sql += ` AND created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { sql += ` AND created_at <= $${idx++}`; params.push(endDate); }
    if (search) { sql += ` AND (description LIKE $${idx++} OR category LIKE $${idx++})`; params.push('%' + search + '%', '%' + search + '%'); }
    
    // Count total
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countRow = await get(countSql, params);
    const total = countRow ? countRow.total : 0;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;
    sql += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limitNum, offset);
    
    const rows = await all(sql, params);
    res.json({ list: rows || [], total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single transaction
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const tx = await get('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!tx) return res.status(404).json({ error: '记录不存在' });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create transaction (with optional receipt upload)
router.post('/', authMiddleware, upload.single('receipt'), async (req, res) => {
  try {
    const { type, category, amount, description } = req.body;
    if (!type || !category || !amount) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    const receiptPath = req.file ? '/uploads/' + req.file.filename : null;
    
    const result = await run(
      'INSERT INTO transactions (type, category, amount, description, receipt_path, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [type, category, amount, description || '', receiptPath, req.session.userId]
    );
    res.json({ id: result.lastInsertRowid, message: '创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update transaction (admin only)
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { type, category, amount, description } = req.body;
    
    const existing = await get('SELECT id FROM transactions WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: '记录不存在' });
    
    await run(
      'UPDATE transactions SET type=$1, category=$2, amount=$3, description=$4 WHERE id=$5',
      [type, category, amount, description || '', id]
    );
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete transaction (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT id FROM transactions WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: '记录不存在' });
    
    await run('DELETE FROM transactions WHERE id = $1', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
