const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// 从环境变量读取数据库连接（Render 自动提供 DATABASE_URL）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 兼容接口：get(sql, params) → 返回单行对象或 undefined
async function get(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows.length > 0 ? result.rows[0] : undefined;
}

// 兼容接口：all(sql, params) → 返回对象数组
async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// 兼容接口：run(sql, params) → 返回 { lastInsertRowid, changes }
async function run(sql, params = []) {
  const result = await pool.query(sql, params);
  return {
    lastInsertRowid: result.rowCount > 0 ? (result.insertId || result.rows[0]?.id || 0) : 0,
    changes: result.rowCount
  };
}

// 获取 INSERT 后的 last insert id（PostgreSQL 用 RETURNING）
async function runAndGetId(sql, params = []) {
  // 支持 RETURNING id 的 SQL
  const returnSql = sql.trim().endsWith(';') 
    ? sql.slice(0, -1) + ' RETURNING id' 
    : sql + ' RETURNING id';
  const result = await pool.query(returnSql, params);
  return {
    lastInsertRowid: result.rows.length > 0 ? result.rows[0].id : 0,
    changes: result.rowCount
  };
}

// 强制重建表并插入默认用户（调试用）
async function forceSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 删除现有表（按依赖顺序）
    await client.query('DROP TABLE IF EXISTS approval_tokens CASCADE');
    await client.query('DROP TABLE IF EXISTS approvals CASCADE');
    await client.query('DROP TABLE IF EXISTS purchase_requests CASCADE');
    await client.query('DROP TABLE IF EXISTS transactions CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('🗑️  已删除旧表');
    
    // 重新建表
    const tables = [
      `CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'purchaser',
        real_name TEXT,
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        receipt_path TEXT,
        created_by INTEGER,
        source TEXT DEFAULT 'direct',
        source_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE purchase_requests (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        attachment_path TEXT,
        applicant_id INTEGER,
        status TEXT DEFAULT 'pending_supervisor',
        rejected_by INTEGER,
        reject_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE approvals (
        id SERIAL PRIMARY KEY,
        request_id INTEGER,
        approver_id INTEGER,
        stage TEXT NOT NULL,
        decision TEXT NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE approval_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        request_id INTEGER,
        stage TEXT NOT NULL,
        approver_id INTEGER,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];
    
    for (const sql of tables) {
      await client.query(sql);
    }
    
    console.log('✅ 已重建所有表');
    
    // 插入默认用户
    const defaultUsers = [
      { username: 'admin', password: 'admin123', role: 'admin', real_name: '系统管理员' },
      { username: 'purchaser1', password: 'purchase123', role: 'purchaser', real_name: '采购员小张' },
      { username: 'supervisor', password: 'super123', role: 'supervisor', real_name: '张主管' },
      { username: 'finance', password: 'finance123', role: 'finance', real_name: '李财务' },
      { username: 'shareholder', password: 'share123', role: 'shareholder', real_name: '王股东' }
    ];
    
    for (const u of defaultUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      await client.query(
        'INSERT INTO users (username, password, role, real_name) VALUES ($1, $2, $3, $4)',
        [u.username, hash, u.role, u.real_name]
      );
      console.log(`  ✅ 已创建用户: ${u.username} / ${u.password}`);
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ 强制重建完成！已插入 ${defaultUsers.length} 个默认用户\n`);
    
    return { success: true, users: defaultUsers.map(u => u.username) };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 强制重建失败:', err);
    throw err;
  } finally {
    client.release();
  }
}

// 初始化：建表 + seed
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 建表
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'purchaser',
        real_name TEXT,
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        receipt_path TEXT,
        created_by INTEGER,
        source TEXT DEFAULT 'direct',
        source_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS purchase_requests (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        attachment_path TEXT,
        applicant_id INTEGER,
        status TEXT DEFAULT 'pending_supervisor',
        rejected_by INTEGER,
        reject_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS approvals (
        id SERIAL PRIMARY KEY,
        request_id INTEGER,
        approver_id INTEGER,
        stage TEXT NOT NULL,
        decision TEXT NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS approval_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        request_id INTEGER,
        stage TEXT NOT NULL,
        approver_id INTEGER,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      try { await client.query(sql); } catch (e) { /* 表已存在 */ }
    }

    // Seed: 如果没有用户则插入默认用户
    const userResult = await client.query('SELECT COUNT(*) as cnt FROM users');
    if (parseInt(userResult.rows[0].cnt) === 0) {
      console.log('🌱 正在插入默认用户...');
      const defaultUsers = [
        { username: 'admin', password: 'admin123', role: 'admin', real_name: '系统管理员' },
        { username: 'purchaser1', password: 'purchase123', role: 'purchaser', real_name: '采购员小张' },
        { username: 'supervisor', password: 'super123', role: 'supervisor', real_name: '张主管' },
        { username: 'finance', password: 'finance123', role: 'finance', real_name: '李财务' },
        { username: 'shareholder', password: 'share123', role: 'shareholder', real_name: '王股东' }
      ];
      for (const u of defaultUsers) {
        const hash = await bcrypt.hash(u.password, 10);
        await client.query(
          "INSERT INTO users (username, password, role, real_name) VALUES ($1, $2, $3, $4)",
          [u.username, hash, u.role, u.real_name]
        );
      }
      console.log(`🌱 已插入 ${defaultUsers.length} 个默认用户`);
    }

    await client.query('COMMIT');
    console.log('✅ 数据库初始化成功 (PostgreSQL)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { get, all, run, runAndGetId };
}

module.exports = { initDatabase, forceSeed, get, all, run, runAndGetId };
