const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');

const expectedTables = [
  'login_attempts',
  'import_jobs',
  'temp_uploads'
];

(async () => {
  try {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    const db = drizzle(pool);
    const [result] = await db.execute('SHOW TABLES');
    const existingTables = result.map(r => Object.values(r)[0]);
    
    console.log('=== 数据库表检查 ===');
    console.log('现有表数:', existingTables.length);
    
    console.log('\n=== 缺少的表 ===');
    for (const table of expectedTables) {
      if (!existingTables.includes(table)) {
        console.log('❌', table);
      } else {
        console.log('✅', table);
      }
    }
    
    pool.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
