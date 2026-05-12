const bcrypt = require('bcryptjs');
const { getDb, saveDatabase } = require('./database');

async function seed() {
  await require('./database').initDatabase();
  const db = getDb();
  
  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (existing.c > 0) {
    console.log('数据库已有用户数据，跳过初始化');
    return;
  }
  
  const users = [
    { username: 'admin', password: 'admin123', role: 'admin', real_name: '系统管理员' },
    { username: 'purchaser1', password: 'purchase123', role: 'purchaser', real_name: '采购员小张' },
    { username: 'supervisor', password: 'super123', role: 'supervisor', real_name: '张主管' },
    { username: 'finance', password: 'finance123', role: 'finance', real_name: '李财务' },
    { username: 'shareholder', password: 'share123', role: 'shareholder', real_name: '王股东' }
  ];
  
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    db.run(
      'INSERT INTO users (username, password, role, real_name) VALUES (?, ?, ?, ?)',
      [u.username, hash, u.role, u.real_name]
    );
  }
  
  saveDatabase();
  console.log('✅ 默认用户已创建:');
  console.log('  管理员: admin / admin123');
  console.log('  采购员: purchaser1 / purchase123');
  console.log('  主  管: supervisor / super123');
  console.log('  财  务: finance / finance123');
  console.log('  股  东: shareholder / share123');
}

seed().then(() => process.exit(0)).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
