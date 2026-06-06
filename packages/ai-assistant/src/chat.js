#!/usr/bin/env node
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { AfterLinkRAG } = require('./rag');
const { logFeedback } = require('./feedback');

let chalk;
try {
  chalk = require('chalk');
} catch (e) {
  chalk = {
    cyan: t => `\x1b[36m${t}\x1b[0m`,
    green: t => `\x1b[32m${t}\x1b[0m`,
    yellow: t => `\x1b[33m${t}\x1b[0m`,
    red: t => `\x1b[31m${t}\x1b[0m`,
    gray: t => `\x1b[90m${t}\x1b[0m`,
    bold: t => `\x1b[1m${t}\x1b[22m`,
    blue: t => `\x1b[34m${t}\x1b[0m`,
    magenta: t => `\x1b[35m${t}\x1b[0m`,
    bgCyan: t => `\x1b[46m\x1b[30m${t}\x1b[0m`
  };
}

const ROOT_DIR = path.resolve(__dirname, '../../..');
const FEEDBACK_FILE = path.join(ROOT_DIR, 'data', 'feedback.json');

const rag = new AfterLinkRAG();

function formatResponse(text) {
  let formatted = text;
  
  // 1. Format code blocks with premium terminal boxes
  formatted = formatted.replace(/```javascript([\s\S]*?)```/g, (match, code) => {
    const rawLines = code.trim().split('\n');
    
    // Perform keyword syntax highlighting
    const highlightedLines = rawLines.map(line => {
      let l = line;
      if (l.trim().startsWith('//')) return chalk.gray(l);
      
      l = l.replace(/\b(const|let|var|function|return|async|await|class|new|require|module\.exports)\b/g, chalk.cyan('$1'))
           .replace(/\b(Server|Client|Router|Frame|Serializer|TcpClient)\b/g, chalk.magenta('$1'))
           .replace(/(["'`])(.*?)\1/g, chalk.green('$1$2$1'));
      return l;
    });

    const boxWidth = 72;
    const borderTop = chalk.cyan('┌' + '─'.repeat(boxWidth - 2) + '┐');
    const borderBottom = chalk.cyan('└' + '─'.repeat(boxWidth - 2) + '┘');
    
    const paddedLines = highlightedLines.map((line, idx) => {
      const visibleLength = rawLines[idx].length;
      const paddingNeeded = Math.max(0, boxWidth - 4 - visibleLength);
      return chalk.cyan('│ ') + line + ' '.repeat(paddingNeeded) + chalk.cyan(' │');
    });

    return `\n${borderTop}\n${paddedLines.join('\n')}\n${borderBottom}\n`;
  });

  // 2. Format high-level structured headers with stylish ANSI graphics
  formatted = formatted
    .replace(/## 📖 DESCRIPTION \/ OVERVIEW/g, chalk.bold(chalk.cyan('\n🔹 [DESCRIPTION / OVERVIEW] ──────────────────────────────────────')))
    .replace(/## 💻 CODE IMPLEMENTATION & BOILERPLATE/g, chalk.bold(chalk.green('\n⚡ [CODE BOILERPLATE & EXAMPLE] ──────────────────────────────────')))
    .replace(/## 💻 HOW TO USE \/ IMPLEMENTATION/g, chalk.bold(chalk.green('\n⚡ [HOW TO USE / BOILERPLATE] ─────────────────────────────────────')))
    .replace(/### (.*)/g, (match, p1) => chalk.bold(chalk.blue(`📌 Topic: ${p1}`)));

  return formatted;
}

// 🧠 Thinking Shimmer Animation Loop
function runShimmerThinking(durationMs) {
  return new Promise((resolve) => {
    const text = "🧠 Analyzing query against AfterLink offline RAG pipeline... ";
    let sweepIndex = 0;
    
    const interval = setInterval(() => {
      let output = '\r';
      for (let i = 0; i < text.length; i++) {
        const distance = Math.abs(i - sweepIndex);
        if (distance === 0) {
          output += chalk.bold(chalk.cyan(text[i]));
        } else if (distance === 1) {
          output += chalk.cyan(text[i]);
        } else if (distance === 2) {
          output += chalk.blue(text[i]);
        } else {
          output += chalk.gray(text[i]);
        }
      }
      process.stdout.write(output);
      
      sweepIndex = (sweepIndex + 1) % text.length;
    }, 60);

    setTimeout(() => {
      clearInterval(interval);
      // Clear the shimmer text before resolving
      process.stdout.write('\r' + ' '.repeat(text.length + 10) + '\r');
      resolve();
    }, durationMs);
  });
}

// ░░ Dot Matrix Scan Reveal Animation
function animateDotMatrixLines(lines, index = 0, callback) {
  if (index >= lines.length) {
    callback();
    return;
  }

  const line = lines[index];
  const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
  const visibleLength = cleanLine.length;

  if (visibleLength === 0) {
    process.stdout.write('\n');
    animateDotMatrixLines(lines, index + 1, callback);
    return;
  }

  // Phase 1: Draw dot matrix placeholder blocks
  const dots = chalk.cyan('░'.repeat(visibleLength));
  process.stdout.write(dots);

  // Phase 2: Reveal actual colorized line
  setTimeout(() => {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(line + '\n');
    
    // Phase 3: Move to next line
    setTimeout(() => {
      animateDotMatrixLines(lines, index + 1, callback);
    }, 12);
  }, 25);
}

function getConfidenceColor(confidence) {
  if (confidence >= 0.75) return chalk.green;
  if (confidence >= 0.5) return chalk.yellow;
  return chalk.red;
}

function printHelpfulStats() {
  let logs = [];
  if (fs.existsSync(FEEDBACK_FILE)) {
    try {
      logs = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
    } catch (e) {
      logs = [];
    }
  }

  const total = logs.length;
  const helpfulCount = logs.filter(l => l.helpful).length;
  const ratio = total > 0 ? ((helpfulCount / total) * 100).toFixed(1) : '0.0';

  console.log(chalk.cyan('\n========================================================================'));
  console.log(chalk.bold(chalk.cyan('                     AI ASSISTANT SESSION STATISTICS                    ')));
  console.log(chalk.cyan('========================================================================'));
  console.log(`  * Total Logged Feedback:  ${chalk.bold(total)}`);
  console.log(`  * Helpful Responses:      ${chalk.green(chalk.bold(helpfulCount))}`);
  console.log(`  * Unhelpful Responses:    ${chalk.red(chalk.bold(total - helpfulCount))}`);
  console.log(`  * Helpfulness Ratio:      ${getConfidenceColor(helpfulCount / (total || 1))(ratio + '%')}`);
  console.log(chalk.cyan('========================================================================\n'));
}

function printTurnHistory(sessionId) {
  const history = rag.sessionContext.get(sessionId) || [];
  if (history.length === 0) {
    console.log(chalk.yellow('\nNo conversation history found for this session.'));
    return;
  }

  console.log(chalk.cyan('\n========================================================================'));
  console.log(chalk.bold(chalk.cyan('                       CONVERSATION SESSION HISTORY                     ')));
  console.log(chalk.cyan('========================================================================'));
  history.forEach((turn, idx) => {
    console.log(chalk.gray(`\n  [Turn ${idx + 1}] Timestamp: ${new Date(turn.timestamp).toLocaleTimeString()}`));
    console.log(`    User query:  "${chalk.bold(turn.query)}"`);
    console.log(`    Topic matched: "${chalk.cyan(turn.topic)}"`);
  });
  console.log(chalk.cyan('\n========================================================================\n'));
}

async function main() {
  console.clear();
  console.log(chalk.cyan('========================================================================'));
  console.log(chalk.bold(chalk.cyan('             AFTERLINK PROPRIETARY RAG ASSISTANT CLI                   ')));
  console.log(chalk.cyan('========================================================================'));
  console.log(chalk.gray('  100% Offline · Modern Retrieval-Augmented Generation (RAG) Pipeline  '));
  console.log(chalk.cyan('========================================================================\n'));

  process.stdout.write(chalk.cyan('⚡ Initializing offline models, FAISS vector index, and BM25 index... '));
  const startTime = Date.now();
  try {
    await rag.initialize();
    process.stdout.write(chalk.green('SUCCESS!\n'));
    console.log(chalk.gray(`Loaded ${rag.documents.length} knowledge segments in ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`));
  } catch (err) {
    process.stdout.write(chalk.red('FAILED!\n'));
    console.error(chalk.red(`\n[FATAL ERROR] Could not initialize RAG engine: ${err.message}`));
    console.log(chalk.gray('Make sure you have run the ingestion script first:'));
    console.log(chalk.bold('  npm run ingest\n'));
    process.exit(1);
  }

  console.log(chalk.gray('Ask technical questions, configurations, setups, or request troubleshooting.'));
  console.log(chalk.gray('Commands: /reset (clear memory), /history (list session), /stats (feedback stats), /quit\n'));
  console.log(chalk.cyan('--- Interface Ready. Type your query below ---'));

  const sessionId = 'default';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold(chalk.green('\nYou > '))
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    const lowerText = text.toLowerCase();

    // Command Handling
    if (lowerText === '/quit' || lowerText === '/exit') {
      console.log(chalk.cyan('\nGoodbye.'));
      rl.close();
      process.exit(0);
    }

    if (lowerText === '/reset') {
      rag.sessionContext.set(sessionId, []);
      console.log(chalk.green('\nSession conversation context memory has been cleared.'));
      rl.prompt();
      return;
    }

    if (lowerText === '/stats') {
      printHelpfulStats();
      rl.prompt();
      return;
    }

    if (lowerText === '/history') {
      printTurnHistory(sessionId);
      rl.prompt();
      return;
    }

    // 1. Play Shimmer Thinking Animation
    console.log();
    const queryStartTime = Date.now();
    await runShimmerThinking(1200);

    // 2. Execute RAG Query Pipeline
    let result;
    try {
      result = await rag.query(text, sessionId);
    } catch (err) {
      console.log(chalk.red(`Assistant > Error processing query: ${err.message}`));
      rl.prompt();
      return;
    }
    const latency = Date.now() - queryStartTime;

    // 3. Compile Answer and Metadata block
    const outputBuffer = [];
    const colorizer = getConfidenceColor(result.confidence);
    
    outputBuffer.push(chalk.bold(chalk.cyan('Assistant > ')));
    
    // Add calibration status metadata
    const confidencePercent = (result.confidence * 100).toFixed(1);
    const sourceString = result.sources.length > 0 ? result.sources[0].title : 'Clarification';
    
    outputBuffer.push(colorizer(`[Source: ${sourceString} | Model Confidence: ${confidencePercent}% | Latency: ${latency}ms]\n`));

    // Append formatted answer
    outputBuffer.push(formatResponse(result.answer));

    // Append sources panel if it was a successful RAG retrieval (confidence >= threshold)
    if (result.confidence >= rag.confidenceThreshold && result.sources.length > 0) {
      outputBuffer.push(chalk.bold(chalk.blue('\n🔗 [OFFICIAL RESOURCES & SOURCES] ───────────────────────────────')));
      result.sources.forEach((src, sIdx) => {
        outputBuffer.push(`  ${sIdx + 1}. [${(src.score * 100).toFixed(1)}%] ${src.title}`);
      });
      outputBuffer.push(`  * Main Documentation:  ${chalk.cyan('https://afterlink-docs.vercel.app')}`);
      outputBuffer.push(`  * GitHub Code Base:    ${chalk.cyan('https://github.com/AJAYMYTH/AfterLink')}`);
      outputBuffer.push(chalk.blue('──────────────────────────────────────────────────────────────────'));
    }

    // 4. Render Dot Matrix Animation strictly on the main answer
    const allLines = outputBuffer.join('\n').split('\n');
    
    animateDotMatrixLines(allLines, 0, () => {
      // 5. Trigger feedback collection
      rl.question(chalk.bold(chalk.yellow('\nWas this helpful? (y/n): ')), (helpfulAns) => {
        const cleanHelpful = helpfulAns.trim().toLowerCase();
        if (cleanHelpful === 'y' || cleanHelpful === 'n' || cleanHelpful === 'yes' || cleanHelpful === 'no') {
          logFeedback({
            query: text,
            response: result.answer,
            confidence: result.confidence,
            helpful: cleanHelpful,
            sources: result.sources
          });
          console.log(chalk.green('Thank you for your feedback!'));
        } else {
          console.log(chalk.gray('Feedback skipped.'));
        }
        rl.prompt();
      });
    });
  });
}

main().catch(err => {
  console.error(chalk.red(`Fatal error in TUI: ${err.message}`));
});
