const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run, forceSeed } = require('../database');

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

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.realName = user.real_name;

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
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
  res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
    real_name: req.session.realName
  });
});

module.exports = router;

// ===== 调试接口：强制重建数据库并插入默认用户 =====
// 访问: POST /api/auth/force-seed
router.post('/force-seed', async (req, res) => {
  try {
    console.log('🔧 收到强制重建数据库请求...');
    const result = await forceSeed();
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
    console.error('❌ 强制重建失败:', err);
    res.status(500).json({ error: '强制重建失败: ' + err.message });
  }
});
