const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'finance.db');
let db = null;

// SQL 转义
function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return "'" + String(val).replace(/'/g, "''") + "'";
}

// 替换 ? 占位符
function bindParams(sql, params) {
  if (!params || params.length === 0) return sql;
  let idx = 0;
  return sql.replace(/\?/g, () => {
    if (idx >= params.length) throw new Error('参数数量不匹配');
    return escapeSql(params[idx++]);
  });
}

// 解析 sql.js 的 exec 结果为对象数组
function parseResult(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  if (!values || values.length === 0) return [];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// 兼容 better-sqlite3 的 get()
function get(sql, params) {
  const boundSql = bindParams(sql, params);
  const result = db.exec(boundSql);
  const rows = parseResult(result);
  return rows.length > 0 ? rows[0] : undefined;
}

// 兼容 better-sqlite3 的 all()
function all(sql, params) {
  const boundSql = bindParams(sql, params);
  const result = db.exec(boundSql);
  return parseResult(result);
}

// 兼容 better-sqlite3 的 run()
function run(sql, params) {
  const boundSql = bindParams(sql, params);
  db.run(boundSql);
  saveDatabase();
  return {
    lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0].values[0][0],
    changes: db.exec('SELECT changes()')[0].values[0][0]
  };
}

async function initDatabase() {
  const SQL = await initSqlJs();

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 建表（逐条执行）
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'purchaser',
      real_name TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
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
    )`,
    `CREATE TABLE IF NOT EXISTS purchase_requests (
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
    )`,
    `CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER,
      approver_id INTEGER,
      stage TEXT NOT NULL,
      decision TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS approval_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      request_id INTEGER,
      stage TEXT NOT NULL,
      approver_id INTEGER,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tables) {
    try { db.run(sql); } catch (e) { /* 表已存在 */ }
  }

  saveDatabase();
  console.log('✅ 数据库初始化成功');
  return { get, all, run, saveDatabase };
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

module.exports = { initDatabase, get, all, run, saveDatabase };
