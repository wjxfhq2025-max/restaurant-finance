const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL 连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 监听连接错误
pool.on('error', (err) => {
  console.error('PostgreSQL 连接池错误:', err.message);
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
    lastInsertRowid: result.rowCount > 0 ? (result.rows[0]?.id || 0) : 0,
    changes: result.rowCount
  };
}

// 获取 INSERT 后的 last insert id（PostgreSQL 用 RETURNING）
async function runAndGetId(sql, params = []) {
  const returnSql = sql.trim().endsWith(';') 
    ? sql.slice(0, -1) + ' RETURNING id' 
    : sql + ' RETURNING id';
  const result = await pool.query(returnSql, params);
  return {
    lastInsertRowid: result.rows.length > 0 ? result.rows[0].id : 0,
    changes: result.rowCount
  };
}

// 强制重建表并插入默认用户
async function forceSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('DROP TABLE IF EXISTS approval_tokens CASCADE');
    await client.query('DROP TABLE IF EXISTS approvals CASCADE');
    await client.query('DROP TABLE IF EXISTS purchase_requests CASCADE');
    await client.query('DROP TABLE IF EXISTS transactions CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('🗑️  已删除旧表');
    
    await createTablesInternal(client);
    console.log('✅ 已重建所有表');
    
    await seedDefaultUsersInternal(client);
    
    await client.query('COMMIT');
    console.log('✅ 强制重建完成');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 强制重建失败:', err);
    throw err;
  } finally {
    client.release();
  }
}

// 创建表（使用 client 参数，支持事务）
async function createTablesInternal(client) {
  const queries = [
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
  
  for (const sql of queries) {
    await (client || pool).query(sql);
  }
}

// 插入默认用户（使用 client 参数，支持事务）
async function seedDefaultUsersInternal(client) {
  const defaultUsers = [
    { username: 'admin', password: 'admin123', role: 'admin', real_name: '系统管理员' },
    { username: 'purchaser1', password: 'purchase123', role: 'purchaser', real_name: '采购员小张' },
    { username: 'supervisor', password: 'super123', role: 'supervisor', real_name: '张主管' },
    { username: 'finance', password: 'finance123', role: 'finance', real_name: '李财务' },
    { username: 'shareholder', password: 'share123', role: 'shareholder', real_name: '王股东' }
  ];
  
  const q = client || pool;
  
  for (const u of defaultUsers) {
    const hash = await bcrypt.hash(u.password, 10);
    await q.query(
      `INSERT INTO users (username, password, role, real_name) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (username) DO UPDATE SET password = $2, role = $3, real_name = $4`,
      [u.username, hash, u.role, u.real_name]
    );
    console.log(`  ✅ ${u.username} / ${u.password} (${u.role})`);
  }
  console.log(`🌱 默认用户已确保存在（共 ${defaultUsers.length} 个）`);
}

// 初始化：建表 + seed（带重试）
async function initDatabase() {
  console.log('📊 初始化数据库 (PostgreSQL)...');
  console.log('DATABASE_URL 是否设置:', !!process.env.DATABASE_URL);
  if (process.env.DATABASE_URL) {
    // 只打印前20字符，隐藏密码
    const masked = process.env.DATABASE_URL.substring(0, 20) + '...';
    console.log('DATABASE_URL (前20字符):', masked);
  }
  
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`🔄 第 ${attempt}/5 次尝试连接数据库...`);
      
      // 测试连接
      const result = await pool.query('SELECT NOW() as now');
      console.log('✅ PostgreSQL 连接成功:', result.rows[0].now);
      
      // 建表
      await createTablesInternal();
      console.log('✅ 数据库表已确保存在');
      
      // 确保默认用户存在
      await seedDefaultUsersInternal();
      
      console.log('✅ 数据库初始化成功');
      return { get, all, run, runAndGetId };
    } catch (err) {
      lastError = err;
      console.error(`❌ 第 ${attempt} 次尝试失败:`, err.message);
      if (attempt < 5) {
        console.log(`⏳ 等待 ${attempt * 2} 秒后重试...`);
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }
  
  console.error('❌ 数据库初始化失败（已重试5次）:', lastError.message);
  throw lastError;
}

module.exports = { initDatabase, forceSeed, get, all, run, runAndGetId };
