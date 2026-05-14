const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// 数据库连接（SQLite）
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'finance.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 兼容接口：get(sql, params) → 返回单行对象或 undefined
function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  } catch (err) {
    console.error('DB get error:', err.message);
    return undefined;
  }
}

// 兼容接口：all(sql, params) → 返回对象数组
function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (err) {
    console.error('DB all error:', err.message);
    return [];
  }
}

// 兼容接口：run(sql, params) → 返回 { lastInsertRowid, changes }
function run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      lastInsertRowid: result.lastInsertRowid,
      changes: result.changes
    };
  } catch (err) {
    console.error('DB run error:', err.message);
    throw err;
  }
}

// 获取 INSERT 后的 last insert id（SQLite 自动返回 lastInsertRowid）
function runAndGetId(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      lastInsertRowid: result.lastInsertRowid,
      changes: result.changes
    };
  } catch (err) {
    console.error('DB runAndGetId error:', err.message);
    throw err;
  }
}

// 强制重建表并插入默认用户（调试用）
function forceSeed() {
  try {
    console.log('🗑️  开始强制重建数据库...');
    
    // 确保 data 目录存在
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 已创建 data 目录');
    }
    
    // 删除现有表（按依赖顺序）
    db.exec(`
      DROP TABLE IF EXISTS approval_tokens;
      DROP TABLE IF EXISTS approvals;
      DROP TABLE IF EXISTS purchase_requests;
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS users;
    `);
    
    console.log('🗑️  已删除旧表');
    
    // 重新建表
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'purchaser',
        real_name TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        receipt_path TEXT,
        created_by INTEGER,
        source TEXT DEFAULT 'direct',
        source_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        attachment_path TEXT,
        applicant_id INTEGER,
        status TEXT DEFAULT 'pending_supervisor',
        rejected_by INTEGER,
        reject_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER,
        approver_id INTEGER,
        stage TEXT NOT NULL,
        decision TEXT NOT NULL,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS approval_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        request_id INTEGER,
        stage TEXT NOT NULL,
        approver_id INTEGER,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ 已重建所有表');
    
    // 插入默认用户
    const defaultUsers = [
      { username: 'admin', password: 'admin123', role: 'admin', real_name: '系统管理员' },
      { username: 'purchaser1', password: 'purchase123', role: 'purchaser', real_name: '采购员小张' },
      { username: 'supervisor', password: 'super123', role: 'supervisor', real_name: '张主管' },
      { username: 'finance', password: 'finance123', role: 'finance', real_name: '李财务' },
      { username: 'shareholder', password: 'share123', role: 'shareholder', real_name: '王股东' }
    ];
    
    const insertUser = db.prepare('INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)');
    
    for (const u of defaultUsers) {
      const hash = bcrypt.hashSync(u.password, 10);
      insertUser.run(u.username, hash, u.role, u.real_name);
      console.log(`  ✅ 已创建用户: ${u.username} / ${u.password}`);
    }
    
    console.log(`\n✅ 强制重建完成！已插入 ${defaultUsers.length} 个默认用户\n`);
    
    return { success: true, users: defaultUsers.map(u => u.username) };
  } catch (err) {
    console.error('❌ 强制重建失败:', err);
    throw err;
  }
}

// 初始化：建表 + seed
function initDatabase() {
  try {
    console.log('📊 初始化数据库 (SQLite)...');
    
    // 确保 data 目录存在
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 已创建 data 目录');
    }
    
    // 建表
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'purchaser',
        real_name TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        receipt_path TEXT,
        created_by INTEGER,
        source TEXT DEFAULT 'direct',
        source_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        attachment_path TEXT,
        applicant_id INTEGER,
        status TEXT DEFAULT 'pending_supervisor',
        rejected_by INTEGER,
        reject_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER,
        approver_id INTEGER,
        stage TEXT NOT NULL,
        decision TEXT NOT NULL,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS approval_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        request_id INTEGER,
        stage TEXT NOT NULL,
        approver_id INTEGER,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ 数据库表已确保存在 (SQLite)');
    
    // 确保默认用户存在
    console.log('🌱 确保默认用户存在...');
    const defaultUsers = [
      { username: 'admin', password: 'admin123', role: 'admin', real_name: '系统管理员' },
      { username: 'purchaser1', password: 'purchase123', role: 'purchaser', real_name: '采购员小张' },
      { username: 'supervisor', password: 'super123', role: 'supervisor', real_name: '张主管' },
      { username: 'finance', password: 'finance123', role: 'finance', real_name: '李财务' },
      { username: 'shareholder', password: 'share123', role: 'shareholder', real_name: '王股东' }
    ];
    
    for (const u of defaultUsers) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
      if (!existing) {
        const hash = bcrypt.hashSync(u.password, 10);
        db.prepare('INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)').run(
          u.username, hash, u.role, u.real_name
        );
        console.log(`  ✅ ${u.username} / ${u.password} (${u.role})`);
      } else {
        // 更新现有用户的密码和角色
        const hash = bcrypt.hashSync(u.password, 10);
        db.prepare('UPDATE users SET password = ?, role = ?, real_name = ? WHERE username = ?').run(
          hash, u.role, u.real_name, u.username
        );
        console.log(`  ✅ ${u.username} / ${u.password} (${u.role}) [已更新]`);
      }
    }
    console.log(`🌱 默认用户已确保存在（共 ${defaultUsers.length} 个）`);
    
    console.log('✅ 数据库初始化成功 (SQLite)');
    
    return { get, all, run, runAndGetId };
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err);
    throw err;
  }
}

module.exports = { initDatabase, forceSeed, get, all, run, runAndGetId, db };
