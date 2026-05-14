const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDatabase } = require('./database');
const config = require('./config');

const app = express();
const PORT = config.port;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/users', require('./routes/users'));

// Serve static files (SPA)
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || '服务器错误' });
});

// Start
console.log('📊 正在初始化数据库 (SQLite)...');
initDatabase();
console.log('✅ 数据库初始化完成');

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🍽️  餐饮店财务管理系统 (SQLite 版本)');
  console.log(`   本地访问地址: http://localhost:${PORT}`);
  console.log(`   Render 部署后自动使用云端地址`);
  console.log('');
});
