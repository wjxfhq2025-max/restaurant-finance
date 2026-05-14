const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// sql.js WASM 文件路径
const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

// 数据库实例（初始化后赋值）
let db = null;
let dbPath;
let saveTimer = null;

// 保存数据库到文件（防抖，避免频繁写入）
function saveDb() {
  if (!db || dbPath === ':memory:') return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('保存数据库失败:', err.message);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDb, 1000);
}

// 兼容接口：get(sql, params) → 返回单行对象或 undefined
function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  } catch (err) {
    console.error('DB get error:', err.message, 'SQL:', sql);
    return undefined;
  }
}

// 兼容接口：all(sql, params) → 返回对象数组
function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (err) {
    console.error('DB all error:', err.message, 'SQL:', sql);
    return [];
  }
}

// 兼容接口：run(sql, params) → 返回 { lastInsertRowid, changes }
function run(sql, params = []) {
  try {
    db.run(sql, params);
    scheduleSave();
    return {
      lastInsertRowid: get('SELECT last_insert_rowid() as id').id || 0,
      changes: db.getRowsModified()
    };
  } catch (err) {
    console.error('DB run error:', err.message, 'SQL:', sql);
    throw err;
  }
}

// runAndGetId（与 run 相同，SQLite 自动提供 lastInsertRowid）
function runAndGetId(sql, params = []) {
  return run(sql, params);
}

// 强制重建表并插入默认用户
function forceSeed() {
  try {
    console.log('🗑️  开始强制重建数据库...');
    
    db.run(`
      DROP TABLE IF EXISTS approval_tokens;
      DROP TABLE IF EXISTS approvals;
      DROP TABLE IF EXISTS purchase_requests;
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS users;
    `);
    
    console.log('🗑️  已删除旧表');
    createTables();
    console.log('✅ 已重建所有表');
    seedDefaultUsers();
    saveDb();
    
    return { success: true };
  } catch (err) {
    console.error('❌ 强制重建失败:', err);
    throw err;
  }
}

// 创建表
function createTables() {
  db.run(`
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
}

// 插入默认用户
function seedDefaultUsers() {
  const defaultUsers = [
    { username: 'admin', password: 'admin123', role: 'admin', real_name: '系统管理员' },
    { username: 'purchaser1', password: 'purchase123', role: 'purchaser', real_name: '采购员小张' },
    { username: 'supervisor', password: 'super123', role: 'supervisor', real_name: '张主管' },
    { username: 'finance', password: 'finance123', role: 'finance', real_name: '李财务' },
    { username: 'shareholder', password: 'share123', role: 'shareholder', real_name: '王股东' }
  ];
  
  for (const u of defaultUsers) {
    const existing = get('SELECT id FROM users WHERE username = ?', [u.username]);
    if (!existing) {
      const hash = bcrypt.hashSync(u.password, 10);
      db.run('INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)',
        [u.username, hash, u.role, u.real_name]);
      console.log(`  ✅ ${u.username} / ${u.password} (${u.role})`);
    } else {
      const hash = bcrypt.hashSync(u.password, 10);
      db.run('UPDATE users SET password = ?, role = ?, real_name = ? WHERE username = ?',
        [hash, u.role, u.real_name, u.username]);
      console.log(`  ✅ ${u.username} / ${u.password} (${u.role}) [已更新]`);
    }
  }
  console.log(`🌱 默认用户已确保存在（共 ${defaultUsers.length} 个）`);
}

// 初始化数据库（异步，在 server.js 中 await 调用）
async function initDatabase() {
  console.log('📊 初始化数据库 (sql.js / SQLite WASM)...');
  
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });
  
  dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'finance.db');
  
  // 尝试加载现有数据库文件
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('✅ 已加载现有数据库:', dbPath);
    } else {
      db = new SQL.Database();
      console.log('✅ 已创建新数据库');
    }
  } catch (err) {
    console.warn('⚠️ 无法加载文件数据库，使用内存数据库:', err.message);
    db = new SQL.Database();
    dbPath = ':memory:';
  }
  
  // 建表
  createTables();
  console.log('✅ 数据库表已确保存在');
  
  // 确保默认用户存在
  seedDefaultUsers();
  
  // 保存到文件
  saveDb();
  
  console.log('✅ 数据库初始化成功');
  
  return { get, all, run, runAndGetId };
}

module.exports = { initDatabase, forceSeed, get, all, run, runAndGetId };
