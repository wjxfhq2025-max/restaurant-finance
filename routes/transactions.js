const express = require('express');
const multer = require('multer');
const { get, all, run } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Cloudinary 配置
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = express.Router();

// Multer 使用内存存储（用于 Cloudinary 上传）
const storage = multer.memoryStorage();

// 文件过滤器：只允许图片
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

// 包装上传中间件，处理错误
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

// 辅助函数：上传到 Cloudinary（自动压缩+转WebP）
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'restaurant-finance/receipts',
        quality: 'auto:good',    // 自动压缩，保证质量
        format: 'webp',          // 转为WebP格式（比JPEG小30-50%）
        transformation: [
          { width: 1920, crop: 'limit' },  // 最大宽度1920px，等比缩放
          { quality: 'auto:good' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({
          url: result.secure_url,
          size: result.bytes,  // 压缩后大小
          publicId: result.public_id  // 用于后续删除
        });
      }
    );
    stream.end(fileBuffer);
  });
};

// 辅助函数：检查存储用量，超90%自动删除最早的图片
const ensureStorageSpace = async () => {
  try {
    const usage = await cloudinary.api.usage();
    const storage = usage?.storage;
    const used = (storage?.used ?? 0) * 1024 * 1024;
    const limit = (storage?.limit ?? 1024) * 1024 * 1024;
    const percent = limit > 0 ? (used / limit) * 100 : 0;
    
    if (percent < 90) return;  // 存储充足，不需要清理
    
    console.log(`[Storage] 用量 ${percent.toFixed(1)}%，开始自动清理最早图片...`);
    
    // 按创建时间升序获取最早的图片（最多删5张腾出空间）
    const resources = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'restaurant-finance/receipts/',
      max_results: 10,
      direction: 'asc'
    });
    
    if (!resources?.resources?.length) return;
    
    // 删除最早的3张图片
    const toDelete = resources.resources.slice(0, 3).map(r => r.public_id);
    if (toDelete.length > 0) {
      await cloudinary.api.delete_resources(toDelete);
      console.log(`[Storage] 已删除 ${toDelete.length} 张最早图片以释放空间`);
    }
  } catch (err) {
    console.error('[Storage] 自动清理失败:', err.message);
    // 清理失败不阻塞上传
  }
};

// 列出交易记录
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, category, startDate, endDate, page, limit, search } = req.query;
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    let idx = 1;
    
    if (type) { sql += ` AND type = $${idx++}`; params.push(type); }
    if (category) { sql += ` AND category = $${idx++}`; params.push(category); }
    if (startDate) { sql += ` AND created_at >= $${idx++}`; params.push(startDate + ' 00:00:00'); }
    if (endDate) { sql += ` AND created_at <= $${idx++}`; params.push(endDate + ' 23:59:59'); }
    if (category) { sql += ` AND category = $${idx++}`; params.push(category); }
    if (search) { sql += ` AND (description LIKE $${idx++} OR category LIKE $${idx++})`; params.push('%' + search + '%', '%' + search + '%'); }
    
    // 计算总数
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

// 获取单个交易记录
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const tx = await get('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (!tx) return res.status(404).json({ error: '记录不存在' });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建交易记录（上传到 Cloudinary）
router.post('/', authMiddleware, uploadMiddleware, async (req, res) => {
  try {
    const { type, category, amount, description } = req.body;
    if (!type || !category || !amount) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    let receiptUrl = null;
    let compressedSize = null;
    if (req.file) {
      // 检查存储空间，超90%自动清理最早图片
      await ensureStorageSpace();
      // 上传到 Cloudinary（自动压缩+转WebP）
      const result = await uploadToCloudinary(req.file.buffer);
      receiptUrl = result.url;
      compressedSize = result.size;
    }
    
    await run(
      'INSERT INTO transactions (type, category, amount, description, receipt_path, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [type, category, amount, description || '', receiptUrl, req.session.userId]
    );
    res.json({ id: 0, message: '创建成功', receipt: receiptUrl, compressedSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新交易记录（仅管理员）
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

// 删除交易记录（仅管理员）
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
