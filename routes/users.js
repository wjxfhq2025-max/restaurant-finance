const express = require('express');
const bcrypt = require('bcryptjs');
const { get, all, run } = require('../database');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// List users (admin only)
router.get('/', authMiddleware, requireRole('管理员'), async (req, res) => {
  try {
    const rows = await all('SELECT id, username, role, real_name, created_at FROM users ORDER BY id');
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user (admin only)
router.post('/', authMiddleware, requireRole('管理员'), async (req, res) => {
  try {
    const { username, password, role, real_name } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    
    const existing = await get('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password, role, real_name) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, hashedPassword, role, real_name || username]
    );
    res.json({ id: result?.id, message: '创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { password, role, real_name } = req.body;
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await run('UPDATE users SET password=$1, role=$2, real_name=$3 WHERE id=$4', 
        [hashedPassword, role, real_name, id]);
    } else {
      await run('UPDATE users SET role=$1, real_name=$2 WHERE id=$3', [role, real_name, id]);
    }
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
router.delete('/:id', authMiddleware, requireRole('管理员'), async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
