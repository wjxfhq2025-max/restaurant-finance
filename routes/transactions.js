const express = require('express');
const multer = require('multer');
const path = require('path');
const { get, all, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '_' + Math.random().toString(36).substr(2, 8) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片格式'));
    }
  }
});

// Get transactions list
router.get('/', authMiddleware, (req, res) => {
  try {
    const { type, page = 1, limit = 20, search, category, date_from, date_to } = req.query;
    let where = ['1=1'];
    let params = [];
    
    if (type) {
      where.push('t.type = ?');
      params.push(type);
    }
    if (search) {
      where.push('(t.description LIKE ? OR t.category LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      where.push('t.category = ?');
      params.push(category);
    }
    if (date_from) {
      where.push('t.created_at >= ?');
      params.push(date_from);
    }
    if (date_to) {
      where.push('t.created_at <= ?');
      params.push(date_to + ' 23:59:59');
    }
    
    const whereClause = where.join(' AND ');
    
    // Count
    const countResult = get(`SELECT COUNT(*) as total FROM transactions t WHERE ${whereClause}`, params);
    const total = countResult.total;
    
    // List
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    const rows = all(
      `SELECT t.*, u.real_name as creator_name 
       FROM transactions t 
       LEFT JOIN users u ON t.created_by = u.id 
       WHERE ${whereClause} 
       ORDER BY t.created_at DESC 
       LIMIT ? OFFSET ?`,
      params
    );
    
    res.json({
      list: rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create transaction
router.post('/', authMiddleware, upload.single('receipt'), (req, res) => {
  try {
    const { type, amount, category, description } = req.body;
    
    if (!type || !amount || !category) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    
    const receiptPath = req.file ? req.file.filename : null;
    
    run(
      'INSERT INTO transactions (type, amount, category, description, receipt_path, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [type, parseFloat(amount), category, description || '', receiptPath, req.session.userId]
    );
    
    res.json({ message: type === 'income' ? '收入记录已添加' : '支出记录已添加' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single transaction
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const row = get(
      `SELECT t.*, u.real_name as creator_name 
       FROM transactions t 
       LEFT JOIN users u ON t.created_by = u.id 
       WHERE t.id = ?`,
      [req.params.id]
    );
    
    if (!row) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete transaction
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    run('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    res.json({ message: '记录已删除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
