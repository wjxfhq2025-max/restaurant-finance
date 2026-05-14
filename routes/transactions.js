const express = require('express');
const { get, all, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// List transactions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, category, startDate, endDate } = req.query;
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    let idx = 1;
    
    if (type) { sql += ` AND type = $${idx++}`; params.push(type); }
    if (category) { sql += ` AND category = $${idx++}`; params.push(category); }
    if (startDate) { sql += ` AND created_at >= $${idx++}`; params.push(startDate); }
    if (endDate) { sql += ` AND created_at <= $${idx++}`; params.push(endDate); }
    
    sql += ' ORDER BY created_at DESC';
    const rows = await all(sql, params);
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create transaction
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, category, amount, description } = req.body;
    if (!type || !category || !amount) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    const result = await run(
      'INSERT INTO transactions (type, category, amount, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [type, category, amount, description || '', req.session.userId]
    );
    res.json({ id: result?.id, message: '创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update transaction
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, category, amount, description } = req.body;
    
    await run(
      'UPDATE transactions SET type=$1, category=$2, amount=$3, description=$4 WHERE id=$5',
      [type, category, amount, description || '', id]
    );
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete transaction
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM transactions WHERE id = $1', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
