import fs from 'fs/promises';
import path from 'path';

const schemaPath = path.resolve(process.cwd(), 'src/app/config/schema.json');

let cachedSchema: any = null;

export async function loadSchema() {
  if (cachedSchema) {
    console.log('📋 Using cached schema');
    return cachedSchema;
  }
  
  console.log('📋 Loading schema from file...');
  const data = await fs.readFile(schemaPath, 'utf-8');
  cachedSchema = JSON.parse(data);
  console.log('✅ Schema cached successfully');
  return cachedSchema;
} 