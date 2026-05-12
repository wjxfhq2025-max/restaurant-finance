const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '_' + Math.random().toString(36).substr(2, 8) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext) ? true : false);
  }
});

const HIGH_AMOUNT = 10000;

// Get purchase requests list
router.get('/', authMiddleware, (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let where = ['1=1'];
    let params = [];
    
    if (status) {
      where.push('pr.status = ?');
      params.push(status);
    }
    
    // Non-admin/non-finance users only see their own requests (except pending ones for their role)
    const role = req.session.role;
    if (role === 'purchaser') {
      where.push('pr.applicant_id = ?');
      params.push(req.session.userId);
    }
    
    const whereClause = where.join(' AND ');
    const countResult = get(`SELECT COUNT(*) as total FROM purchase_requests pr WHERE ${whereClause}`, params);
    const total = countResult.total;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    
    const rows = all(
      `SELECT pr.*, u.real_name as applicant_name 
       FROM purchase_requests pr 
       LEFT JOIN users u ON pr.applicant_id = u.id 
       WHERE ${whereClause} 
       ORDER BY pr.created_at DESC 
       LIMIT ? OFFSET ?`,
      params
    );
    
    // Get approvals for each request
    for (const row of rows) {
      row.approvals = all(
        `SELECT a.*, u.real_name as approver_name 
         FROM approvals a 
         LEFT JOIN users u ON a.approver_id = u.id 
         WHERE a.request_id = ? 
         ORDER BY a.created_at`,
        [row.id]
      );
    }
    
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

// Create purchase request
router.post('/', authMiddleware, upload.single('attachment'), (req, res) => {
  try {
    const { title, amount, category, description } = req.body;
    
    if (!title || !amount || !category) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    
    const attachmentPath = req.file ? req.file.filename : null;
    const amt = parseFloat(amount);
    
    const result = run(
      'INSERT INTO purchase_requests (title, amount, category, description, attachment_path, applicant_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, amt, category, description || '', attachmentPath, req.session.userId, 'pending_supervisor']
    );
    
    const requestId = Number(result.lastInsertRowid);
    
    // Generate approval token for supervisor
    const supervisor = get("SELECT id FROM users WHERE role = 'supervisor' LIMIT 1");
    if (supervisor) {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substr(0, 19);
      run(
        'INSERT INTO approval_tokens (token, request_id, stage, approver_id, expires_at) VALUES (?, ?, ?, ?, ?)',
        [token, requestId, 'supervisor', supervisor.id, expiresAt]
      );
    }
    
    res.json({ 
      message: '采购申请已提交，等待主管审批',
      id: requestId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single request
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const row = get(
      `SELECT pr.*, u.real_name as applicant_name 
       FROM purchase_requests pr 
       LEFT JOIN users u ON pr.applicant_id = u.id 
       WHERE pr.id = ?`,
      [req.params.id]
    );
    
    if (!row) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    row.approvals = all(
      `SELECT a.*, u.real_name as approver_name 
       FROM approvals a 
       LEFT JOIN users u ON a.approver_id = u.id 
       WHERE a.request_id = ? 
       ORDER BY a.created_at`,
      [row.id]
    );
    
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve request
router.post('/:id/approve', authMiddleware, (req, res) => {
  try {
    const { stage, comment } = req.body;
    const requestId = parseInt(req.params.id);
    
    const pr = get('SELECT * FROM purchase_requests WHERE id = ?', [requestId]);
    if (!pr) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    // Validate stage
    const expectedStatus = `pending_${stage}`;
    if (pr.status !== expectedStatus) {
      return res.status(400).json({ error: `当前状态不允许此操作，需要: ${expectedStatus}` });
    }
    
    // Record approval
    run(
      'INSERT INTO approvals (request_id, approver_id, stage, decision, comment) VALUES (?, ?, ?, ?, ?)',
      [requestId, req.session.userId, stage, 'approved', comment || '']
    );
    
    // Determine next status
    let nextStatus;
    if (stage === 'supervisor') {
      nextStatus = 'pending_finance';
    } else if (stage === 'finance') {
      if (pr.amount >= HIGH_AMOUNT) {
        nextStatus = 'pending_shareholder';
      } else {
        nextStatus = 'approved';
      }
    } else if (stage === 'shareholder') {
      nextStatus = 'approved';
    }
    
    run(
      'UPDATE purchase_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextStatus, requestId]
    );
    
    // Generate approval token for next approver
    if (nextStatus !== 'approved') {
      const nextRole = nextStatus.replace('pending_', '');
      const nextApprover = get('SELECT id FROM users WHERE role = ? LIMIT 1', [nextRole]);
      if (nextApprover) {
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substr(0, 19);
        run(
          'INSERT INTO approval_tokens (token, request_id, stage, approver_id, expires_at) VALUES (?, ?, ?, ?, ?)',
          [token, requestId, nextRole, nextApprover.id, expiresAt]
        );
      }
    }
    
    // Auto-create expense record when fully approved
    if (nextStatus === 'approved') {
      run(
        'INSERT INTO transactions (type, amount, category, description, receipt_path, created_by, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['expense', pr.amount, pr.category, pr.description, pr.attachment_path, pr.applicant_id, 'purchase_request', requestId]
      );
    }
    
    res.json({ message: '审批通过', nextStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject request
router.post('/:id/reject', authMiddleware, (req, res) => {
  try {
    const { stage, reason } = req.body;
    const requestId = parseInt(req.params.id);
    
    const pr = get('SELECT * FROM purchase_requests WHERE id = ?', [requestId]);
    if (!pr) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    if (!pr.status.startsWith('pending_')) {
      return res.status(400).json({ error: '当前状态不允许此操作' });
    }
    
    run(
      'INSERT INTO approvals (request_id, approver_id, stage, decision, comment) VALUES (?, ?, ?, ?, ?)',
      [requestId, req.session.userId, stage || pr.status.replace('pending_', ''), 'rejected', reason || '']
    );
    
    run(
      'UPDATE purchase_requests SET status = ?, rejected_by = ?, reject_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['rejected', req.session.userId, reason || '', requestId]
    );
    
    res.json({ message: '已拒绝' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public approval link - get info (no auth needed)
router.get('/approve/:token', (req, res) => {
  try {
    const tokenRow = get(
      'SELECT at.*, pr.*, u.real_name as applicant_name FROM approval_tokens at JOIN purchase_requests pr ON at.request_id = pr.id LEFT JOIN users u ON pr.applicant_id = u.id WHERE at.token = ? AND at.used = 0',
      [req.params.token]
    );
    
    if (!tokenRow) {
      return res.status(404).json({ error: '链接无效或已使用' });
    }
    
    // Check expiry
    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(410).json({ error: '链接已过期' });
    }
    
    // Get previous approvals
    const approvals = all(
      `SELECT a.*, u.real_name as approver_name FROM approvals a LEFT JOIN users u ON a.approver_id = u.id WHERE a.request_id = ? ORDER BY a.created_at`,
      [tokenRow.request_id]
    );
    
    res.json({
      request: tokenRow,
      approvals,
      stage: tokenRow.stage,
      needsShareholder: tokenRow.amount >= HIGH_AMOUNT
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public approval link - submit decision (no auth needed)
router.post('/approve/:token', (req, res) => {
  try {
    const { decision, comment } = req.body;
    const token = req.params.token;
    
    const tokenRow = get('SELECT * FROM approval_tokens WHERE token = ? AND used = 0', [token]);
    
    if (!tokenRow) {
      return res.status(404).json({ error: '链接无效或已使用' });
    }
    
    if (new Date(tokenRow.expires_at) < new Date()) {
      return res.status(410).json({ error: '链接已过期' });
    }
    
    const requestId = tokenRow.request_id;
    const pr = get('SELECT * FROM purchase_requests WHERE id = ?', [requestId]);
    
    if (!pr) {
      return res.status(404).json({ error: '申请不存在' });
    }
    
    // Mark token as used
    run('UPDATE approval_tokens SET used = 1 WHERE token = ?', [token]);
    
    if (decision === 'approved') {
      run(
        'INSERT INTO approvals (request_id, approver_id, stage, decision, comment) VALUES (?, ?, ?, ?, ?)',
        [requestId, tokenRow.approver_id, tokenRow.stage, 'approved', comment || '']
      );
      
      let nextStatus;
      if (tokenRow.stage === 'supervisor') {
        nextStatus = 'pending_finance';
      } else if (tokenRow.stage === 'finance') {
        nextStatus = pr.amount >= HIGH_AMOUNT ? 'pending_shareholder' : 'approved';
      } else if (tokenRow.stage === 'shareholder') {
        nextStatus = 'approved';
      }
      
      run(
        'UPDATE purchase_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextStatus, requestId]
      );
      
      // Generate token for next approver
      if (nextStatus !== 'approved') {
        const nextRole = nextStatus.replace('pending_', '');
        const nextApprover = get('SELECT id FROM users WHERE role = ? LIMIT 1', [nextRole]);
        if (nextApprover) {
          const newToken = uuidv4();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substr(0, 19);
          run(
            'INSERT INTO approval_tokens (token, request_id, stage, approver_id, expires_at) VALUES (?, ?, ?, ?, ?)',
            [newToken, requestId, nextRole, nextApprover.id, expiresAt]
          );
        }
      }
      
      // Auto-create expense on full approval
      if (nextStatus === 'approved') {
        run(
          'INSERT INTO transactions (type, amount, category, description, receipt_path, created_by, source, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          ['expense', pr.amount, pr.category, pr.description, pr.attachment_path, pr.applicant_id, 'purchase_request', requestId]
        );
      }
      
      res.json({ message: '✅ 审批通过！', nextStatus });
      
    } else {
      // Rejected
      run(
        'INSERT INTO approvals (request_id, approver_id, stage, decision, comment) VALUES (?, ?, ?, ?, ?)',
        [requestId, tokenRow.approver_id, tokenRow.stage, 'rejected', comment || '']
      );
      
      run(
        'UPDATE purchase_requests SET status = ?, rejected_by = ?, reject_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['rejected', tokenRow.approver_id, comment || '', requestId]
      );
      
      res.json({ message: '❌ 已拒绝该申请' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending requests for current user's role
router.get('/pending/mine', authMiddleware, (req, res) => {
  try {
    const role = req.session.role;
    let status = null;
    
    if (role === 'supervisor') status = 'pending_supervisor';
    else if (role === 'finance') status = 'pending_finance';
    else if (role === 'shareholder') status = 'pending_shareholder';
    else if (role === 'admin') status = null;
    
    let rows;
    if (status) {
      rows = all(
        `SELECT pr.*, u.real_name as applicant_name 
         FROM purchase_requests pr 
         LEFT JOIN users u ON pr.applicant_id = u.id 
         WHERE pr.status = ? 
         ORDER BY pr.created_at DESC`,
        [status]
      );
    } else {
      rows = all(
        `SELECT pr.*, u.real_name as applicant_name 
         FROM purchase_requests pr 
         LEFT JOIN users u ON pr.applicant_id = u.id 
         WHERE pr.status LIKE 'pending_%' 
         ORDER BY pr.created_at DESC`
      );
    }
    
    for (const row of rows) {
      row.approvals = all(
        `SELECT a.*, u.real_name as approver_name 
         FROM approvals a LEFT JOIN users u ON a.approver_id = u.id 
         WHERE a.request_id = ? ORDER BY a.created_at`,
        [row.id]
      );
    }
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
