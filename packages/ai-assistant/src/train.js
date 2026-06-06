const fs = require('fs');
const path = require('path');
const { NeuralNetwork } = require('./neural-net');

const KNOWLEDGE_FILE = path.resolve(__dirname, 'afterlink-knowledge.json');
const MODEL_WEIGHTS_FILE = path.resolve(__dirname, 'model-weights.json');
const VOCABULARY_FILE = path.resolve(__dirname, 'vocabulary.json');

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cant', 'cannot',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into',
  'is', 'isnt', 'it', 'its', 'itself', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves',
  // Framework noise terms:
  'afterlink', 'protocol', 'fast', 'reliable', 'custom', 'messaging', 'communication', 'app', 'apps', 'project',
  'system', 'ecosystem', 'framework',
  // Prototype pollution filter keywords:
  'constructor', 'prototype', 'tostring', 'valueof', 'hasownproperty', '__proto__', 'constructor1'
]);

function log(message, type = 'info') {
  const reset = '\x1b[0m';
  const colors = {
    info: '\x1b[36m', // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m' // Red
  };
  console.log(`${colors[type] || ''}[AI-Train] ${message}${reset}`);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_\-\/]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function buildVocabularyAndIDF(documents) {
  const termCounts = {};
  const df = {};
  
  documents.forEach(doc => {
    const text = `${doc.title} ${doc.tags.join(' ')} ${doc.content}`;
    const tokens = tokenize(text);
    const uniqueTokens = new Set(tokens);
    
    tokens.forEach(token => {
      if (STOP_WORDS.has(token)) return;
      termCounts[token] = (termCounts[token] || 0) + 1;
    });

    uniqueTokens.forEach(token => {
      if (STOP_WORDS.has(token)) return;
      df[token] = (df[token] || 0) + 1;
    });
  });

  const sortedTerms = Object.entries(termCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1200)
    .map(entry => entry[0]);

  const vocab = {};
  const idf = {};
  
  sortedTerms.forEach((term, index) => {
    vocab[term] = index;
    const docFreq = df[term] || 0;
    idf[term] = Math.log(1.0 + (documents.length / (1.0 + docFreq)));
  });

  return { vocab, idf };
}

function textToVector(text, vocab, idf, isTitle = false) {
  const vocabSize = Object.keys(vocab).length;
  const vector = new Array(vocabSize).fill(0);
  const tokens = tokenize(text);
  
  tokens.forEach(token => {
    if (vocab[token] !== undefined) {
      const idx = vocab[token];
      const weightMultiplier = isTitle ? 3.5 : 1.0;
      const idfVal = idf[token] !== undefined ? idf[token] : 1.0;
      vector[idx] += idfVal * weightMultiplier;
    }
  });

  const sumSq = vector.reduce((a, b) => a + b * b, 0);
  if (sumSq > 0) {
    const norm = Math.sqrt(sumSq);
    for (let i = 0; i < vocabSize; i++) {
      vector[i] /= norm;
    }
  }
  
  return vector;
}

function main() {
  log('Starting optimized TF-IDF Neural Network training...', 'info');

  if (!fs.existsSync(KNOWLEDGE_FILE)) {
    log('Knowledge database not found. Please run "node src/ingest.js" first.', 'error');
    process.exit(1);
  }

  const documents = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8'));
  log(`Loaded ${documents.length} knowledge documents from database.`, 'info');

  const { vocab, idf } = buildVocabularyAndIDF(documents);
  const vocabSize = Object.keys(vocab).length;
  log(`Compiled vocabulary with ${vocabSize} unique features.`, 'success');

  fs.writeFileSync(VOCABULARY_FILE, JSON.stringify({ vocab, idf }, null, 2), 'utf-8');

  const trainingSet = [];
  const classCount = documents.length;

  documents.forEach((doc, docIndex) => {
    const targetVector = new Array(classCount).fill(0);
    targetVector[docIndex] = 1.0;

    // Sample 1: Document title (3.5x weighted)
    trainingSet.push({
      input: textToVector(doc.title, vocab, idf, true),
      target: targetVector
    });

    // Sample 2: Brief content description
    const briefDesc = doc.content.slice(0, 300);
    trainingSet.push({
      input: textToVector(`${doc.title} ${doc.tags.join(' ')} ${briefDesc}`, vocab, idf),
      target: targetVector
    });

    // Sample 3: Tags
    if (doc.tags.length > 0) {
      trainingSet.push({
        input: textToVector(doc.tags.join(' '), vocab, idf),
        target: targetVector
      });
    }

    // 4. Clean, targeted data augmentation mapped to exact document IDs to prevent vector overlaps
    const docId = doc.id.toLowerCase();
    
    // Setup and Installation mapping
    if (docId === 'doc_readme_installation') {
      const setupQueries = [
        'how to install afterlink',
        'how to setup the afterlink and install it',
        'how to install afterlink client server core',
        'command for setting afterlink by command prompt',
        'create new project initialize packages',
        'getting started guide dependency installation',
        'install client server and browser packages npm pnpm'
      ];
      setupQueries.forEach(query => {
        trainingSet.push({
          input: textToVector(query, vocab, idf),
          target: targetVector
        });
      });
    }

    // Secure TLS/SSL mapping
    if (docId === 'doc_readme_tls_ssl_encryption') {
      const tlsQueries = [
        'how to setup secure tls connection',
        'configure ssl certificates server',
        'tls certificates afterlink server Client connection',
        'secure connection tls encryption keepalive ssl',
        'generate developer local certificates afterlink'
      ];
      tlsQueries.forEach(query => {
        trainingSet.push({
          input: textToVector(query, vocab, idf),
          target: targetVector
        });
      });
    }

    // Zod schema validation mapping
    if (docId === 'doc_readme_what_is_afterlink' || docId === 'doc_readme_why_afterlink') {
      const valQueries = [
        'zod schema validation request payload',
        'validate payload errors routing middleware',
        'schema validation automatic check zod schema',
        'validation error taxonomy code handler definitions'
      ];
      valQueries.forEach(query => {
        trainingSet.push({
          input: textToVector(query, vocab, idf),
          target: targetVector
        });
      });
    }

    // Browser WebSocket bridge mapping
    if (docId === 'doc_browser_quick_start') {
      const browserQueries = [
        'websocket bridge browser setup sdk',
        'connect browser client to afterlink tcp server',
        'ws transport browser client bridge adapter',
        'quick start client browser integrations'
      ];
      browserQueries.forEach(query => {
        trainingSet.push({
          input: textToVector(query, vocab, idf),
          target: targetVector
        });
      });
    }

    // Pub/Sub mapping
    if (docId === 'doc_readme_quick_start') {
      const pubsubQueries = [
        'publish subscribe channels real-time communication',
        'subscribe to channels broadcast events client',
        'publish messages topics connection sub subscribe',
        'realtime active websocket browser subscriber'
      ];
      pubsubQueries.forEach(query => {
        trainingSet.push({
          input: textToVector(query, vocab, idf),
          target: targetVector
        });
      });
    }

    // CLI Utility mapping
    if (docId === 'doc_cli_commands' || docId === 'doc_cli_installation') {
      const cliQueries = [
        'afterlink cli call command options',
        'ping afterlink server command prompt',
        'call route test monitor inspect terminal',
        'npx afterlink command utility arguments'
      ];
      cliQueries.forEach(query => {
        trainingSet.push({
          input: textToVector(query, vocab, idf),
          target: targetVector
        });
      });
    }
  });

  log(`Generated targeted dataset with ${trainingSet.length} samples (Overlaps resolved).`, 'info');

  // Input sanitization check
  let nanInputs = 0;
  trainingSet.forEach((sample, idx) => {
    sample.input.forEach((val, i) => {
      if (isNaN(val)) nanInputs++;
    });
  });
  if (nanInputs > 0) {
    log(`[CRITICAL ERROR] Found ${nanInputs} NaN values inside input vectors!`, 'error');
    process.exit(1);
  } else {
    log('Dataset input vectors sanitized: 100% clean of NaNs.', 'success');
  }

  const hiddenSize = 64;
  const nn = new NeuralNetwork(vocabSize, hiddenSize, classCount);

  log('Training Neural Network with stable convergence SGD parameters...', 'info');

  const epochs = 250;
  let learningRate = 0.02;

  for (let epoch = 1; epoch <= epochs; epoch++) {
    let epochLoss = 0;
    trainingSet.sort(() => Math.random() - 0.5);

    for (let i = 0; i < trainingSet.length; i++) {
      const sample = trainingSet[i];
      const loss = nn.trainStep(sample.input, sample.target, learningRate);
      epochLoss += loss;
    }

    learningRate *= 0.992;
    if (learningRate < 0.005) learningRate = 0.005;

    if (epoch === 1 || epoch % 50 === 0 || epoch === epochs) {
      const averageLoss = epochLoss / trainingSet.length;
      log(`Epoch ${epoch}/${epochs} - Learning Rate: ${learningRate.toFixed(4)} - Loss: ${averageLoss.toFixed(6)}`, 'info');
    }
  }

  let correctCount = 0;
  trainingSet.forEach(sample => {
    const { a2 } = nn.forward(sample.input);
    const predictedIndex = a2.indexOf(Math.max(...a2));
    const targetIndex = sample.target.indexOf(1.0);
    if (predictedIndex === targetIndex) {
      correctCount++;
    }
  });

  const accuracy = (correctCount / trainingSet.length) * 100;
  log(`Proprietary Model trained stably with ${accuracy.toFixed(2)}% accuracy.`, 'success');

  nn.save(MODEL_WEIGHTS_FILE);
  log(`Trained weights saved successfully.`, 'success');
}

main();
