const express = require('express');
const { get, all, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// List requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT r.*, u.real_name as requester_name FROM requests r JOIN users u ON r.requester_id = u.id WHERE 1=1';
    const params = [];
    let idx = 1;
    
    if (status) { sql += ` AND r.status = $${idx++}`; params.push(status); }
    sql += ' ORDER BY r.created_at DESC';
    
    const rows = await all(sql, params);
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, amount, description } = req.body;
    if (!type || !amount) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    const result = await run(
      'INSERT INTO requests (type, amount, description, requester_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [type, amount, description || '', req.session.userId, 'pending']
    );
    res.json({ id: result?.id, message: '申请已提交' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve/Reject request
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效状态' });
    }
    
    await run(
      'UPDATE requests SET status=$1, reviewer_id=$2, review_comment=$3, reviewed_at=NOW() WHERE id=$4',
      [status, req.session.userId, comment || '', id]
    );
    res.json({ message: '审批完成' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
