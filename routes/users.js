const express = require('express');
const bcrypt = require('bcryptjs');
const { get, all, run } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// List users (admin only)
router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const rows = await all('SELECT id, username, role, real_name, phone, created_at FROM users ORDER BY id');
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user (admin only)
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, role, real_name, phone } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: '缺少必填字段（用户名/密码/角色）' });
    }
    
    const existing = await get('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password, role, real_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, hashedPassword, role, real_name || username, phone || '']
    );
    res.json({ id: result.lastInsertRowid, message: '创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change own password (auth required)
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '旧密码和新密码不能为空，新密码至少6位' });
    }
    
    const user = await get('SELECT password FROM users WHERE id = $1', [req.session.userId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(400).json({ error: '原密码错误' });
    
    const hashed = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password=$1 WHERE id=$2', [hashed, req.session.userId]);
    res.json({ message: '密码修改成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user (admin only)
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password, role, real_name, phone } = req.body;
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await run('UPDATE users SET password=$1, role=$2, real_name=$3, phone=$4 WHERE id=$5', 
        [hashedPassword, role, real_name, phone || '', id]);
    } else {
      await run('UPDATE users SET role=$1, real_name=$2, phone=$3 WHERE id=$4', 
        [role, real_name, phone || '', id]);
    }
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: '不能删除自己' });
    }
    await run('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
