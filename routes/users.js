const express = require('express');
const bcrypt = require('bcryptjs');
const { get, all, run } = require('../database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all users
router.get('/', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const users = await all('SELECT id, username, role, real_name, phone, created_at FROM users ORDER BY id');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
router.post('/', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { username, password, role, real_name, phone } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: '请填写用户名、密码和角色' });
    }
    
    const existing = await get('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await run(
      'INSERT INTO users (username, password, role, real_name, phone) VALUES ($1, $2, $3, $4, $5)',
      [username, hashedPassword, role, real_name || '', phone || '']
    );
    
    res.json({ message: '用户创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change own password
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }
    
    const user = await get('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: '原密码错误' });
    }
    
    const hashed = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.session.userId]);
    
    res.json({ message: '密码修改成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
