const express = require('express');
const bcrypt = require('bcryptjs');
const { get, all, run, forceSeed } = require('../database');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const user = await get('SELECT * FROM users WHERE username = $1', [username]);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // Parse roles (comma-separated)
    const roles = (user.role || '').split(',').map(r => r.trim());

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role; // Store raw comma-separated string
    req.session.realName = user.real_name;

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      roles: roles, // Array of roles for frontend use
      real_name: user.real_name
    });
  } catch (err) {
    res.status(500).json({ error: '登录失败：' + err.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: '已退出登录' });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: '未登录' });
  }
  const roles = (req.session.role || '').split(',').map(r => r.trim());
  res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
    roles: roles,
    real_name: req.session.realName
  });
});

// ===== Debug: check database status =====
router.get('/debug', async (req, res) => {
  try {
    let userCount = 0;
    let users = [];
    let tableExists = false;

    try {
      const tableCheck = await get("SELECT to_regclass('users') as exists");
      tableExists = !!tableCheck?.exists;

      if (tableExists) {
        const countResult = await get('SELECT COUNT(*) as cnt FROM users');
        userCount = countResult ? countResult.cnt : 0;

        if (userCount > 0) {
          users = await all('SELECT id, username, role, real_name FROM users');
        }
      }
    } catch (e) {
      return res.json({ error: 'Database query failed', message: e.message });
    }

    res.json({ database_url_set: !!process.env.DATABASE_URL, users_table_exists: tableExists, user_count: userCount, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Debug: force rebuild database =====
router.get('/force-seed', async (req, res) => {
  try {
    console.log('🔧 Force rebuild database...');
    await forceSeed();
    res.json({
      message: '数据库已强制重建',
      users: [
        { username: 'admin', password: 'admin123', role: '管理员' },
        { username: 'purchaser1', password: 'purchase123', role: '采购员' },
        { username: 'supervisor', password: 'super123', role: '主管' },
        { username: 'finance', password: 'finance123', role: '财务' },
        { username: 'shareholder', password: 'share123', role: '股东' }
      ]
    });
  } catch (err) {
    console.error('❌ Force rebuild failed:', err);
    res.status(500).json({ error: '强制重建失败：' + err.message });
  }
});

module.exports = router;
