import mysql from 'mysql2/promise';

let cachedPool: mysql.Pool | null = null;

export async function getDbConnection() {
  console.log('🗄️ getDbConnection called');
  console.log('🔗 DATABASE_URL present:', !!process.env.DATABASE_URL);
  
  if (cachedPool) {
    console.log('✅ Using cached database pool');
    return cachedPool;
  }
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  console.log('🔌 Creating new database connection pool...');
  try {
    cachedPool = mysql.createPool(process.env.DATABASE_URL);
    console.log('✅ Database connection pool established successfully');
    return cachedPool;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Helper function to execute queries with timeout
export async function executeQuery(sql: string, timeoutMs: number = 30000): Promise<object[]> {
  const pool = await getDbConnection();
  const queryStartTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Query timeout exceeded'));
    }, timeoutMs);
    
    pool.query(sql)
      .then(([rows]) => {
        clearTimeout(timeout);
        const queryTime = Date.now() - queryStartTime;
        console.log(`✅ Database query executed in ${queryTime}ms, returned ${(rows as object[]).length} rows`);
        resolve(rows as object[]);
      })
      .catch((error) => {
        clearTimeout(timeout);
        const queryTime = Date.now() - queryStartTime;
        console.error(`❌ Database query failed after ${queryTime}ms:`, error);
        reject(error);
      });
  });
} 