import fs from 'fs/promises';
import path from 'path';

const aiConfigPath = path.resolve(process.cwd(), 'src/app/config/aiConfig.json');

let cachedConfig: Record<string, unknown> | undefined = undefined;

async function loadConfig(): Promise<Record<string, unknown>> {
  if (cachedConfig !== undefined) return cachedConfig;
  console.log('📁 Loading AI config from:', aiConfigPath);
  const data = await fs.readFile(aiConfigPath, 'utf-8');
  const config = JSON.parse(data) as Record<string, unknown>;
  cachedConfig = config;
  console.log('✅ AI config loaded:', { model: config.model, apiEndpoint: config.apiEndpoint });
  return config;
}

async function callGeminiAPI(prompt: string, config: Record<string, unknown>): Promise<string> {
  const { apiEndpoint, apiKey, model } = config as { apiEndpoint: string; apiKey: string; model: string };
  const apiStartTime = Date.now();
  console.log('🌐 Calling Gemini API:', { model, apiEndpoint });
  console.log('🔑 API Key present:', !!apiKey);
  
  const url = `${apiEndpoint}/models/${model}:generateContent?key=${apiKey}`;
  console.log('🔗 Full URL:', url.replace(apiKey, '***'));
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        "thinkingConfig": {
        "thinkingBudget": 0
      },
        temperature: 0.1, // Lower temperature for more consistent results
        maxOutputTokens: 2048, // Limit response size
      },
    }),
  });
  
  console.log('📡 API Response status:', res.status, res.statusText);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Gemini API error response:', errorText);
    throw new Error(`Gemini API error: ${res.status} ${res.statusText} - ${errorText}`);
  }
  
  const data = await res.json();
  console.log('📄 API Response data keys:', Object.keys(data));
  
  // Gemini returns response in data.candidates[0].content.parts[0].text
  const response = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const apiTime = Date.now() - apiStartTime;
  console.log(`✅ Gemini API response received in ${apiTime}ms, length:`, response.length);
  return response;
}

type Schema = {
  database: string;
  tables: Record<string, unknown>;
};

// SQL templates for common queries to bypass AI entirely
const SQL_TEMPLATES = {
  'action movies': 'SELECT title, release_year, rating FROM film f JOIN film_category fc ON f.film_id = fc.film_id JOIN category c ON fc.category_id = c.category_id WHERE c.name = "Action" ORDER BY release_year DESC LIMIT 50',
  'comedy movies': 'SELECT title, release_year, rating FROM film f JOIN film_category fc ON f.film_id = fc.film_id JOIN category c ON fc.category_id = c.category_id WHERE c.name = "Comedy" ORDER BY release_year DESC LIMIT 50',
  'drama movies': 'SELECT title, release_year, rating FROM film f JOIN film_category fc ON f.film_id = fc.film_id JOIN category c ON fc.category_id = c.category_id WHERE c.name = "Drama" ORDER BY release_year DESC LIMIT 50',
  'horror movies': 'SELECT title, release_year, rating FROM film f JOIN film_category fc ON f.film_id = fc.film_id JOIN category c ON fc.category_id = c.category_id WHERE c.name = "Horror" ORDER BY release_year DESC LIMIT 50',
  'recent movies': 'SELECT title, release_year, rating FROM film WHERE release_year >= 2000 ORDER BY release_year DESC LIMIT 50',
  'old movies': 'SELECT title, release_year, rating FROM film WHERE release_year < 2000 ORDER BY release_year ASC LIMIT 50',
  'top actors': 'SELECT a.first_name, a.last_name, COUNT(fa.film_id) as film_count FROM actor a JOIN film_actor fa ON a.actor_id = fa.actor_id GROUP BY a.actor_id ORDER BY film_count DESC LIMIT 50',
  'popular categories': 'SELECT c.name, COUNT(fc.film_id) as film_count FROM category c JOIN film_category fc ON c.category_id = fc.category_id GROUP BY c.category_id ORDER BY film_count DESC LIMIT 20',
  'rental statistics': 'SELECT COUNT(*) as total_rentals, COUNT(DISTINCT customer_id) as unique_customers, COUNT(DISTINCT film_id) as unique_films FROM rental LIMIT 1',
};

// Check if query matches a template
function getTemplateSQL(userQuery: string): string | null {
  const query = userQuery.toLowerCase();
  
  for (const [key, sql] of Object.entries(SQL_TEMPLATES)) {
    if (query.includes(key)) {
      console.log(`🎯 Using template for: ${key}`);
      return sql;
    }
  }
  
  return null;
}

// Optimized schema summary for faster processing
function createSchemaSummary(schema: Schema): string {
  const tableNames = Object.keys(schema.tables);
  const summary = tableNames.map(tableName => {
    const table = schema.tables[tableName] as any;
    const columns = table.columns ? Object.keys(table.columns).join(', ') : 'unknown columns';
    return `${tableName}(${columns})`;
  }).join('\n');
  
  return `Database: ${schema.database}\nTables:\n${summary}`;
}

// Combined function that generates SQL and formats response in one call
export async function processQueryWithAI(userQuery: string, schema: Schema, sqlResults: object[]): Promise<{ sql: string; response: string }> {
  console.log('🚀 Processing query with combined AI call...');
  const config = await loadConfig();
  
  const schemaSummary = createSchemaSummary(schema);
  const limitedResults = limitResults(sqlResults);
  const optimizedResults = optimizeResultsForAI(limitedResults);
  
  const prompt = `Database schema:\n${schemaSummary}\n\nUser query: "${userQuery}"\n\nSQL results: ${JSON.stringify(optimizedResults)}\n\nGenerate SQL query and format results as HTML. Return in this exact format:\n\nSQL: [your SQL query here]\n\nHTML: [formatted HTML response here]\n\nUse HTML format:\n- Lists: <ul><li class="p-3 bg-gray-800 rounded"><strong>Title</strong> (Year) - Details</li></ul>\n- Tables: <table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>\n- Headers: <h3 class="text-blue-400 text-lg font-semibold mb-2">Title</h3>`;
  
  const response = await callGeminiAPI(prompt, config);
  
  // Parse the combined response
  const sqlMatch = response.match(/SQL:\s*([\s\S]*?)(?=\n\nHTML:)/);
  const htmlMatch = response.match(/HTML:\s*([\s\S]*)/);
  
  const sql = sqlMatch ? sqlMatch[1].trim() : '';
  const htmlResponse = htmlMatch ? htmlMatch[1].trim() : response;
  
  return { sql, response: htmlResponse };
}

export async function generateSQL(userQuery: string, schema: Schema): Promise<string> {
  console.log('🔧 generateSQL called with query:', userQuery);
  
  // Check for template first
  const templateSQL = getTemplateSQL(userQuery);
  if (templateSQL) {
    console.log('⚡ Using SQL template');
    return templateSQL;
  }
  
  const config = await loadConfig();
  
  // Use optimized schema summary instead of full schema
  const schemaSummary = createSchemaSummary(schema);
  const prompt = `Database schema:\n${schemaSummary}\n\nConvert this query to SQL: "${userQuery}"\n\nReturn only the SQL query, no explanations.`;
  
  console.log('📝 SQL generation prompt length:', prompt.length);
  return await callGeminiAPI(prompt, config);
}

// Limit results to prevent massive responses
function limitResults(results: object[], maxResults: number = 50): object[] {
  if (results.length <= maxResults) return results;
  console.log(`📊 Limiting results from ${results.length} to ${maxResults}`);
  return results.slice(0, maxResults);
}

// Optimize results for AI processing
function optimizeResultsForAI(results: object[]): object[] {
  return results.map(row => {
    const optimized: any = {};
    Object.entries(row).forEach(([key, value]) => {
      // Truncate long text fields
      if (typeof value === 'string' && value.length > 100) {
        optimized[key] = value.substring(0, 100) + '...';
      } else {
        optimized[key] = value;
      }
    });
    return optimized;
  });
}

export async function formatResponse(userQuery: string, sqlResults: object[]): Promise<string> {
  console.log('🔧 formatResponse called with results count:', sqlResults.length);
  
  // Handle empty results quickly
  if (sqlResults.length === 0) {
    return `<div>No results found for your query: "${userQuery}".</div>`;
  }
  
  const config = await loadConfig();
  
  // Limit and optimize results
  const limitedResults = limitResults(sqlResults);
  const optimizedResults = optimizeResultsForAI(limitedResults);
  
  let prompt: string;
  if (/family/i.test(userQuery)) {
    prompt = `User: ${userQuery}\nResults: ${JSON.stringify(optimizedResults)}\nOutput: Write a short, clear paragraph that answers the user's question in natural language. Do not use lists, tables, or HTML formatting. Do not use markdown. Do not explain.`;
  } else {
    prompt = `User: ${userQuery}\nResults: ${JSON.stringify(optimizedResults)}\nOutput: Simple, clean HTML for direct display. Use only basic HTML tags (like <h3>, <ul>, <li>, <table>, <tr>, <td>, <strong>, etc). Do not use CSS classes or inline styles. Do not use markdown. Do not explain.`;
  }
  
  console.log('📝 Response formatting prompt length:', prompt.length);
  return await callGeminiAPI(prompt, config);
} 