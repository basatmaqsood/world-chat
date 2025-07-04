'use server';

import { loadSchema } from './lib/schemaLoader';
import { generateSQL, formatResponse, processQueryWithAI } from './lib/aiService';
import { validateSelectQuery } from './lib/sqlValidator';
import { executeQuery } from './lib/db';

export type QueryResult = {
  response: string;
  htmlResponse?: string;
};

function cleanSql(sql: string): string {
  let cleanSql = sql.trim();
  
  // Remove markdown code blocks (```sql ... ```)
  if (cleanSql.startsWith('```sql')) {
    cleanSql = cleanSql.replace(/^```sql\s*/, '').replace(/\s*```$/, '');
  } else if (cleanSql.startsWith('```')) {
    cleanSql = cleanSql.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  return cleanSql.trim();
}

// Fast path for simple queries that don't need AI
function isSimpleQuery(userQuery: string): boolean {
  const simplePatterns = [
    /^list\s+(all\s+)?(movies?|films?)$/i,
    /^show\s+(all\s+)?(movies?|films?)$/i,
    /^get\s+(all\s+)?(movies?|films?)$/i,
    /^action\s+movies?$/i,
    /^comedy\s+movies?$/i,
    /^drama\s+movies?$/i,
    /^horror\s+movies?$/i,
    /^recent\s+movies?$/i,
    /^old\s+movies?$/i,
    /^top\s+actors?$/i,
    /^popular\s+categories?$/i,
    /^rental\s+statistics?$/i,
  ];
  
  return simplePatterns.some(pattern => pattern.test(userQuery));
}

export async function processUserQuery(userQuery: string): Promise<QueryResult> {
  console.log('🔍 Starting processUserQuery with query:', userQuery);
  let schema, rawSql, sql, rows, response;
  try {
    // 1. Load schema
    try {
      const schemaStartTime = Date.now();
      schema = await loadSchema();
      console.log(`✅ Schema loaded successfully in ${Date.now() - schemaStartTime}ms:`, Object.keys(schema.tables).length, 'tables');
    } catch (err) {
      console.error('❌ Error loading schema:', err);
      throw err;
    }

    // 2. Generate SQL
    try {
      const sqlStartTime = Date.now();
      rawSql = await generateSQL(userQuery, schema);
      console.log(`✅ Raw SQL generated in ${Date.now() - sqlStartTime}ms:`, rawSql);
    } catch (err) {
      console.error('❌ Error generating SQL:', err);
      throw err;
    }

    // 3. Clean and validate SQL
    try {
      sql = cleanSql(rawSql);
      const validationStartTime = Date.now();
      validateSelectQuery(rawSql);
      console.log(`✅ SQL validation passed in ${Date.now() - validationStartTime}ms`);
    } catch (err) {
      console.error('❌ Error validating SQL:', err);
      throw err;
    }

    // 4. Execute SQL
    try {
      const dbStartTime = Date.now();
      rows = await executeQuery(sql, 15000);
      console.log(`✅ SQL executed in ${Date.now() - dbStartTime}ms, rows returned:`, rows?.length || 0);
    } catch (err) {
      console.error('❌ Error executing SQL:', err);
      throw err;
    }

    // 5. Format response
    try {
      const formattingStartTime = Date.now();
      response = await formatResponse(userQuery, rows);
      console.log('🤖 Using AI for response formatting');
      console.log(`✅ Response formatted in ${Date.now() - formattingStartTime}ms:`, response.substring(0, 100) + '...');
    } catch (err) {
      console.error('❌ Error formatting response:', err);
      throw err;
    }

    // 6. Prepare result
    let htmlResponse: string | undefined;
    let textResponse: string = '';
    if (/<[^>]*>/.test(response)) {
      htmlResponse = response;
      textResponse = 'View formatted results below';
    } else if (typeof response === 'string' && response.startsWith('$')) {
      const refMatch = response.match(/^\$(\d+)/);
      if (refMatch) {
        const refNum = refMatch[1];
        console.error('❌ htmlResponse is a reference, but no multipart context is available.');
        return {
          response: 'Oops, something went wrong. Try again!',
          htmlResponse: undefined
        };
      }
    } else {
      htmlResponse = undefined;
      textResponse = response || '';
    }
    return {
      response: textResponse,
      htmlResponse
    };
  } catch (error: unknown) {
    console.error('❌ Error in processUserQuery:', error);
    if (error instanceof Error) {
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    return {
      response: 'Oops, something went wrong. Try again!',
      htmlResponse: undefined
    };
  }
}

// Fast HTML generation for simple queries without AI
function generateSimpleHTML(userQuery: string, results: object[]): string {
  const query = userQuery.toLowerCase();
  
  if (query.includes('action') || query.includes('comedy') || query.includes('drama') || query.includes('horror')) {
    const category = query.includes('action') ? 'Action' : 
                    query.includes('comedy') ? 'Comedy' : 
                    query.includes('drama') ? 'Drama' : 'Horror';
    
    return `<div class="mb-4">
      <h3 class="text-blue-400 text-lg font-semibold mb-2">${category} Movies Found:</h3>
      <ul class="space-y-2">
        ${results.map((row: any) => 
          `<li class="p-3 bg-gray-800 rounded"><strong>${row.title || 'Unknown'}</strong> (${row.release_year || 'N/A'}) - Rating: ${row.rating || 'N/A'}</li>`
        ).join('')}
      </ul>
    </div>`;
  }
  
  if (query.includes('recent') || query.includes('new')) {
    return `<div class="mb-4">
      <h3 class="text-blue-400 text-lg font-semibold mb-2">Recent Movies Found:</h3>
      <ul class="space-y-2">
        ${results.map((row: any) => 
          `<li class="p-3 bg-gray-800 rounded"><strong>${row.title || 'Unknown'}</strong> (${row.release_year || 'N/A'}) - Rating: ${row.rating || 'N/A'}</li>`
        ).join('')}
      </ul>
    </div>`;
  }
  
  if (query.includes('actor')) {
    return `<div class="mb-4">
      <h3 class="text-blue-400 text-lg font-semibold mb-2">Top Actors Found:</h3>
      <ul class="space-y-2">
        ${results.map((row: any) => 
          `<li class="p-3 bg-gray-800 rounded"><strong>${row.first_name || ''} ${row.last_name || ''}</strong> - ${row.film_count || 0} films</li>`
        ).join('')}
      </ul>
    </div>`;
  }
  
  if (query.includes('category')) {
    return `<div class="mb-4">
      <h3 class="text-blue-400 text-lg font-semibold mb-2">Popular Categories:</h3>
      <ul class="space-y-2">
        ${results.map((row: any) => 
          `<li class="p-3 bg-gray-800 rounded"><strong>${row.name || 'Unknown'}</strong> - ${row.film_count || 0} films</li>`
        ).join('')}
      </ul>
    </div>`;
  }
  
  // Default fallback
  return `<div class="mb-4">
    <h3 class="text-blue-400 text-lg font-semibold mb-2">Results Found:</h3>
    <ul class="space-y-2">
      ${results.map((row: any) => 
        `<li class="p-3 bg-gray-800 rounded">${JSON.stringify(row)}</li>`
      ).join('')}
    </ul>
  </div>`;
} 