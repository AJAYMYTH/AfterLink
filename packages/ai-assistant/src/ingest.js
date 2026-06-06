const fs = require('fs');
const path = require('path');
const { AfterLinkRAG } = require('./rag');

const ROOT_DIR = path.resolve(__dirname, '../../..');

// Files to scan
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const EXAMPLES_DIR = path.join(ROOT_DIR, 'examples');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');

const documents = [];

function log(message, type = 'info') {
  const reset = '\x1b[0m';
  const colors = {
    info: '\x1b[36m', // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m' // Red
  };
  console.log(`${colors[type] || ''}[RAG-Ingest] ${message}${reset}`);
}

/**
 * Smart difficulty classifying based on technical complexity of content
 */
function classifyDifficulty(title, content) {
  const combined = (title + ' ' + content).toLowerCase();
  
  const highIndicators = ['tls', 'ssl', 'certificate', 'security', 'benchmark', 'performance', 'tuning', 'concurrency', 'throughput', 'encryption', 'privatekey'];
  const mediumIndicators = ['middleware', 'router', 'pubsub', 'stream', 'session', 'health', 'heartbeat', 'validate', 'zod', 'handler', 'reconnect', 'bridge'];
  
  if (highIndicators.some(ind => combined.includes(ind))) {
    return 'high';
  }
  if (mediumIndicators.some(ind => combined.includes(ind))) {
    return 'medium';
  }
  return 'beginner';
}

function cleanAndStructureMarkdown(title, body) {
  let cleaned = body;
  
  // 1. Remove standard markdown badges
  cleaned = cleaned.replace(/\[\!\[.*?\]\(.*?\bin\.svg\b.*?\]\(.*?\)/g, '');
  cleaned = cleaned.replace(/\[\!\[.*?\]\(.*?\bshield\b.*?\]\(.*?\)/g, '');
  cleaned = cleaned.replace(/\[\!\[.*?\]\(.*?\bbadge\b.*?\]\(.*?\)/g, '');
  cleaned = cleaned.replace(/\[\!\[.*?\]\(.*?\bimg\.shields\b.*?\]\(.*?\)/g, '');
  cleaned = cleaned.replace(/\!\[.*?\]\(.*?\)/g, '');
  
  // 2. Remove typical markdown link blocks (header nav)
  cleaned = cleaned.replace(/\[\*\*Docs\*\*\][\s\S]*?(\n|$)/gi, '');
  cleaned = cleaned.replace(/\[\*\*npm\*\*\][\s\S]*?(\n|$)/gi, '');
  
  // 3. Remove standard HTML tags
  cleaned = cleaned.replace(/<div[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/div>/gi, '');
  cleaned = cleaned.replace(/<img[^>]*>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*>.*?<\/span>/gi, '');
  
  // 4. Standardize code blocks syntax
  cleaned = cleaned.replace(/```js/g, '```javascript');
  
  // 5. Clean excess whitespace and carriage returns
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();
  
  // 6. Build the clean, structured output layout
  let structured = `### ${title}\n\n`;
  
  const codeBlocks = [];
  const codeBlockRegex = /```javascript([\s\S]*?)```/g;
  let match;
  let hasCode = false;
  
  while ((match = codeBlockRegex.exec(cleaned)) !== null) {
    codeBlocks.push(match[0]);
    hasCode = true;
  }
  
  let explanation = cleaned.replace(/```javascript[\s\S]*?```/g, '').trim();
  explanation = explanation.replace(/\n{3,}/g, '\n\n');
  
  structured += `## 📖 DESCRIPTION / OVERVIEW\n${explanation || 'Overview of the specified AfterLink communication module.'}\n\n`;
  
  if (hasCode) {
    structured += `## 💻 CODE IMPLEMENTATION & BOILERPLATE\n`;
    codeBlocks.forEach((block) => {
      const codeOnly = block.replace(/```javascript\n|```/g, '').trim();
      structured += `\n\`\`\`javascript\n${codeOnly}\n\`\`\`\n`;
    });
  } else {
    structured += `## 💻 HOW TO USE / IMPLEMENTATION\n`;
    const titleLower = title.toLowerCase();
    if (titleLower.includes('install') || titleLower.includes('installation')) {
      structured += `To set up AfterLink in your project, execute these standard terminal steps:\n` +
                    `\`\`\`javascript\n` +
                    `// 1. Create a project folder and navigate in:\n` +
                    `//    mkdir my-afterlink-app && cd my-afterlink-app\n\n` +
                    `// 2. Initialize Node.js environment:\n` +
                    `//    npm init -y\n\n` +
                    `// 3. Install the AfterLink framework:\n` +
                    `//    npm install afterlink\n` +
                    `\`\`\`\n`;
    } else if (titleLower.includes('quick start') || titleLower.includes('setup') || titleLower.includes('connect')) {
      structured += `Here is a complete, ready-to-run full-stack AfterLink boilerplate:\n` +
                    `\`\`\`javascript\n` +
                    `// --- SERVER SETUP (server.js) ---\n` +
                    `const { Server } = require('@afterlink/server');\n` +
                    `const server = new Server({ port: 4000 });\n\n` +
                    `server.on('ping', async (req, res) => {\n` +
                    `  res.send({ message: 'pong', timestamp: Date.now() });\n` +
                    `});\n` +
                    `server.listen();\n\n` +
                    `// --- CLIENT SETUP (client.js) ---\n` +
                    `const { Client } = require('@afterlink/client');\n` +
                    `async function main() {\n` +
                    `  const client = new Client('afterlink://localhost:4000');\n` +
                    `  await client.connect();\n\n` +
                    `  const res = await client.request('ping', {});\n` +
                    `  console.log(res); // { message: 'pong', ... }\n\n` +
                    `  await client.disconnect();\n` +
                    `}\n` +
                    `main();\n` +
                    `\`\`\`\n`;
    } else if (titleLower.includes('cli')) {
      structured += `Use the AfterLink CLI tool for direct testing:\n\`\`\`javascript\n// In your terminal:\n// npx afterlink ping localhost:4000\n\`\`\`\n`;
    } else {
      structured += `For complete usage references, see the official AfterLink documentation at: https://afterlinkdocs.vercel.app\n`;
    }
  }
  
  return structured;
}

function processMarkdownFile(filePath, category) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);
    
    // Split by markdown headers
    const sections = content.split(/^#+\s+/m);
    
    sections.forEach(section => {
      if (!section.trim()) return;
      
      const lines = section.split('\n');
      const title = lines[0].trim();
      const body = lines.slice(1).join('\n').trim();
      
      if (body.length < 10) return;
      
      const structuredContent = cleanAndStructureMarkdown(title, body);
      const difficulty = classifyDifficulty(title, structuredContent);
      const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
      const uniqueId = `doc_${relPath.replace(/[^a-z0-9]/gi, '_')}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

      documents.push({
        id: uniqueId,
        title: `${category}: ${title}`,
        content: structuredContent,
        metadata: {
          category: 'documentation',
          version: '1.0.0',
          difficulty
        }
      });
    });
    
    log(`Processed markdown: ${filename}`, 'success');
  } catch (err) {
    log(`Error reading markdown ${filePath}: ${err.message}`, 'error');
  }
}

function processCodeFile(filePath, category) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);
    
    if (content.length > 50000 || content.includes('// minified')) return;
    
    const difficulty = classifyDifficulty(filename, content);
    const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
    const uniqueId = `code_${relPath.replace(/[^a-z0-9]/gi, '_')}`;
    
    documents.push({
      id: uniqueId,
      title: `${category}: ${filename}`,
      content: `File: ${filename}\n\`\`\`javascript\n${content}\n\`\`\``,
      metadata: {
        category: 'code',
        version: '1.0.0',
        difficulty
      }
    });
    
    log(`Processed code file: ${filename} (${category})`, 'success');
  } catch (err) {
    log(`Error reading code file ${filePath}: ${err.message}`, 'error');
  }
}

function crawlDirectory(dirPath, allowedExts, category, excludeDirs = []) {
  if (!fs.existsSync(dirPath)) return;
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name) || entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      crawlDirectory(fullPath, allowedExts, category, excludeDirs);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (allowedExts.includes(ext)) {
        if (ext === '.md') {
          processMarkdownFile(fullPath, category);
        } else {
          processCodeFile(fullPath, category);
        }
      }
    }
  }
}

async function main() {
  log('Starting AfterLink offline RAG knowledge base ingestion...', 'info');
  
  // 1. Process main README.md
  const mainReadme = path.join(ROOT_DIR, 'README.md');
  if (fs.existsSync(mainReadme)) {
    processMarkdownFile(mainReadme, 'Overview');
  }
  
  // 2. Process documentation folder
  crawlDirectory(DOCS_DIR, ['.md'], 'Documentation');
  
  // 3. Process examples
  crawlDirectory(EXAMPLES_DIR, ['.js', '.json', '.md'], 'Examples', ['node_modules']);
  
  // 4. Process packages core signatures
  crawlDirectory(path.join(PACKAGES_DIR, 'core'), ['.ts', '.js', '.md'], 'Core Protocol', ['node_modules', 'test']);
  crawlDirectory(path.join(PACKAGES_DIR, 'server'), ['.ts', '.js', '.md'], 'Server SDK', ['node_modules', 'test']);
  crawlDirectory(path.join(PACKAGES_DIR, 'client'), ['.ts', '.js', '.md'], 'Client SDK', ['node_modules', 'test']);
  crawlDirectory(path.join(PACKAGES_DIR, 'browser'), ['.ts', '.js', '.md'], 'Browser SDK', ['node_modules', 'test']);
  crawlDirectory(path.join(PACKAGES_DIR, 'cli'), ['.ts', '.js', '.md'], 'CLI Tool', ['node_modules', 'test']);
  
  log(`Found ${documents.length} document nodes. Initializing RAG pipeline for embedding generation...`, 'info');
  
  // Run embedding generation and indexing in RAG Main Class
  const rag = new AfterLinkRAG();
  
  console.time('Ingestion time');
  try {
    await rag.ingestDocuments(documents);
    log(`Successfully generated embeddings and indexed ${documents.length} documents!`, 'success');
  } catch (err) {
    log(`Failed during RAG ingestion: ${err.message}`, 'error');
    process.exit(1);
  }
  console.timeEnd('Ingestion time');
  
  log('Ingestion completed successfully!', 'success');
}

main();
