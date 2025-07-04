export function validateSelectQuery(sql: string) {
  // Clean the SQL - remove markdown code blocks if present
  let cleanSql = sql.trim();
  
  // Remove markdown code blocks (```sql ... ```)
  if (cleanSql.startsWith('```sql')) {
    cleanSql = cleanSql.replace(/^```sql\s*/, '').replace(/\s*```$/, '');
  } else if (cleanSql.startsWith('```')) {
    cleanSql = cleanSql.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  cleanSql = cleanSql.trim();
  console.log('🧹 Cleaned SQL:', cleanSql);
  
  // Only allow queries that start with SELECT (case-insensitive, ignoring whitespace)
  if (!/^\s*select\b/i.test(cleanSql)) {
    throw new Error('Only SELECT queries are allowed');
  }
  // Optionally, block dangerous keywords (for extra safety)
  const forbidden = /\b(insert|update|delete|drop|alter|create|replace|truncate|grant|revoke|commit|rollback)\b/i;
  if (forbidden.test(cleanSql)) {
    throw new Error('Query contains forbidden keywords');
  }
  return true;
} 