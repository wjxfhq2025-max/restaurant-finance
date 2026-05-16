const express = require('express');
const multer = require('multer');
const path = require('path');
const { get, all, run } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// List purchase requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT r.*, u.real_name as applicant_name 
               FROM purchase_requests r 
               JOIN users u ON r.applicant_id = u.id WHERE 1=1`;
    const params = [];
    
    if (status === 'pending') {
      sql += ` AND r.status LIKE 'pending%'`;
    } else if (status === 'approved') {
      sql += ` AND r.status = 'approved'`;
    } else if (status === 'rejected') {
      sql += ` AND r.status = 'rejected'`;
    }
    
    sql += ' ORDER BY r.created_at DESC LIMIT 50';
    
    const rows = await all(sql, params);
    res.json({ list: rows || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: check if user has a role (supports comma-separated roles)
const hasRole = (userRole, checkRole) => userRole && userRole.split(',').map(r => r.trim()).includes(checkRole);

// Get pending requests for current user (to approve)
router.get('/pending/mine', authMiddleware, async (req, res) => {
  try {
    const role = req.session.role;
    let stages = [];
    
    if (hasRole(role, 'supervisor')) stages.push('pending_supervisor');
    if (hasRole(role, 'finance')) stages.push('pending_finance');
    if (hasRole(role, 'shareholder')) stages.push('pending_shareholder');
    if (hasRole(role, 'admin')) stages.push('pending_supervisor', 'pending_finance', 'pending_shareholder');
    
    if (stages.length === 0) return res.json([]);
    
    const uniqueStages = [...new Set(stages)];
    const placeholders = uniqueStages.map((_, i) => `$${i+1}`).join(',');
    const rows = await all(
      `SELECT r.*, u.real_name as applicant_name 
       FROM purchase_requests r 
       JOIN users u ON r.applicant_id = u.id 
       WHERE r.status IN (${placeholders}) 
       ORDER BY r.created_at DESC`,
      uniqueStages
    );
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single request
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const row = await get(
      `SELECT r.*, u.real_name as applicant_name 
       FROM purchase_requests r 
       JOIN users u ON r.applicant_id = u.id 
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: '申请不存在' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create purchase request (with optional file upload)
router.post('/', authMiddleware, upload.single('attachment'), async (req, res) => {
  try {
    const { title, amount, category, description } = req.body;
    if (!title || !amount || !category) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    const attachmentPath = req.file ? '/uploads/' + req.file.filename : null;
    
    const result = await run(
      `INSERT INTO purchase_requests (title, amount, category, description, attachment_path, applicant_id, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_supervisor') RETURNING id`,
      [title, amount, category, description || '', attachmentPath, req.session.userId]
    );
    res.json({ id: result.lastInsertRowid, message: '申请已提交' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve request
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, comment } = req.body;
    const role = req.session.role;
    
    const request = await get('SELECT * FROM purchase_requests WHERE id = $1', [id]);
    if (!request) return res.status(404).json({ error: '申请不存在' });
    
    let newStatus = request.status;
    if (hasRole(role, 'supervisor') && request.status === 'pending_supervisor') {
      newStatus = 'pending_finance';
    } else if (hasRole(role, 'finance') && request.status === 'pending_finance') {
      newStatus = request.amount >= 10000 ? 'pending_shareholder' : 'approved';
    } else if (hasRole(role, 'shareholder') && request.status === 'pending_shareholder') {
      newStatus = 'approved';
    } else if (hasRole(role, 'admin') && (request.status.startsWith('pending_'))) {
      newStatus = 'approved';
    }
    
    if (newStatus === request.status) {
      return res.status(400).json({ error: '无权审批或状态不允许' });
    }
    
    await run(
      `UPDATE purchase_requests SET status=$1, updated_at=NOW() WHERE id=$2`,
      [newStatus, id]
    );
    
    await run(
      `INSERT INTO approvals (request_id, approver_id, stage, decision, comment) VALUES ($1,$2,$3,$4,$5)`,
      [id, req.session.userId, request.status, 'approved', comment || '']
    );
    
    res.json({ message: '审批已通过', status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject request
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, reason } = req.body;
    
    const request = await get('SELECT status FROM purchase_requests WHERE id=$1', [id]);
    
    await run(
      `UPDATE purchase_requests SET status='rejected', rejected_by=$1, reject_reason=$2, updated_at=NOW() WHERE id=$3`,
      [req.session.userId, reason || '', id]
    );
    
    await run(
      `INSERT INTO approvals (request_id, approver_id, stage, decision, comment) VALUES ($1,$2,$3,$4,$5)`,
      [id, req.session.userId, request?.status || 'unknown', 'rejected', reason || '']
    );
    
    res.json({ message: '申请已拒绝' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public approval via token (no auth)
router.get('/approve/:token', async (req, res) => {
  try {
    const tokenRow = await get(
      `SELECT * FROM approval_tokens WHERE token = $1 AND used = 0 AND expires_at > NOW()`,
      [req.params.token]
    );
    if (!tokenRow) return res.status(404).json({ error: '链接无效或已过期' });
    
    const request = await get('SELECT * FROM purchase_requests WHERE id = $1', [tokenRow.request_id]);
    res.json({ request, stage: tokenRow.stage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approve/:token', async (req, res) => {
  try {
    const { decision, comment } = req.body;
    const tokenRow = await get(
      `SELECT * FROM approval_tokens WHERE token = $1 AND used = 0 AND expires_at > NOW()`,
      [req.params.token]
    );
    if (!tokenRow) return res.status(404).json({ error: '链接无效或已过期' });
    
    await run(`UPDATE approval_tokens SET used=1 WHERE id=$1`, [tokenRow.id]);
    
    if (decision === 'reject') {
      await run(`UPDATE purchase_requests SET status='rejected', reject_reason=$1, updated_at=NOW() WHERE id=$2`,
        [comment || '', tokenRow.request_id]);
    } else {
      let nextStage = 'approved';
      if (tokenRow.stage === 'supervisor') nextStage = 'pending_finance';
      else if (tokenRow.stage === 'finance') nextStage = 'pending_admin';
      
      await run(`UPDATE purchase_requests SET status=$1, updated_at=NOW() WHERE id=$2`,
        [nextStage, tokenRow.request_id]);
    }
    
    await run(
      `INSERT INTO approvals (request_id, approver_id, stage, decision, comment) VALUES ($1,$2,$3,$4,$5)`,
      [tokenRow.request_id, tokenRow.approver_id, tokenRow.stage, decision, comment || '']
    );
    
    res.json({ message: '审批已完成' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
