const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { get, all, run } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ uploads 目录已创建:', uploadsDir);
}

// Multer setup for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});

// File filter: only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只支持上传图片文件'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Wrap upload middleware with error handling
const uploadMiddleware = (req, res, next) => {
  upload.single('receipt')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '图片文件过大，请选择小于 10MB 的图片' });
      }
      return res.status(400).json({ error: '文件上传失败: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

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
router.post('/', authMiddleware, uploadMiddleware, async (req, res) => {
  try {
    const { type, category, amount, description } = req.body;
    if (!type || !category || !amount) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    const receiptPath = req.file ? '/uploads/' + req.file.filename : null;
    
    await run(
      'INSERT INTO transactions (type, category, amount, description, receipt_path, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [type, category, amount, description || '', receiptPath, req.session.userId]
    );
    res.json({ id: 0, message: '创建成功', receipt: receiptPath });
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
