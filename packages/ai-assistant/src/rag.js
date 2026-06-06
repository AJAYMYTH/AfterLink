const fs = require('fs');
const path = require('path');
const { preprocessQuery } = require('./preprocess');
const { CrossEncoderReranker } = require('./reranker');
const { calibrateConfidence, addContext, getCleanTopic } = require('./utils');

// Resolve the root data paths
const ROOT_DIR = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const FAISS_DIR = path.join(DATA_DIR, 'afterlink_index');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');

let pipeline;
let env;
let FAISS;

// Custom Embeddings wrapper for LangChain and Transformers.js
class XenovaEmbeddings {
  constructor(pipelineInstance) {
    this.pipeline = pipelineInstance;
  }

  async embedDocuments(texts) {
    const embeddings = [];
    for (const text of texts) {
      const emb = await this.embedQuery(text);
      embeddings.push(emb);
    }
    return embeddings;
  }

  async embedQuery(text) {
    const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}

// BM25 implementation for hybrid search
class BM25 {
  constructor(documents = []) {
    this.documents = documents;
    this.k1 = 1.2;
    this.b = 0.75;
    this.docCount = documents.length;
    this.avgDocLength = 0;
    this.docLengths = {};
    this.termFreqs = {}; 
    this.docFreqs = {}; 
    this.idf = {};
    
    if (documents.length > 0) {
      this.initialize();
    }
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s_\-\/]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }

  initialize() {
    let totalLength = 0;
    
    this.documents.forEach(doc => {
      const text = `${doc.title}\n${doc.content}`;
      const tokens = this.tokenize(text);
      const len = tokens.length;
      totalLength += len;
      this.docLengths[doc.id] = len;
      
      const freqs = {};
      tokens.forEach(token => {
        freqs[token] = (freqs[token] || 0) + 1;
      });
      this.termFreqs[doc.id] = freqs;
      
      Object.keys(freqs).forEach(token => {
        this.docFreqs[token] = (this.docFreqs[token] || 0) + 1;
      });
    });
    
    this.avgDocLength = this.docCount > 0 ? totalLength / this.docCount : 0;
    
    Object.keys(this.docFreqs).forEach(term => {
      const df = this.docFreqs[term];
      this.idf[term] = Math.max(0.0001, Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5)));
    });
  }

  search(query, limit = 20) {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.docCount === 0) return [];

    const scores = [];
    
    this.documents.forEach(doc => {
      let score = 0;
      const freqs = this.termFreqs[doc.id] || {};
      const docLen = this.docLengths[doc.id] || 0;
      
      queryTokens.forEach(token => {
        const tf = freqs[token] || 0;
        if (tf > 0) {
          const idf = this.idf[token] || 0.0001;
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength)));
          score += idf * (numerator / denominator);
        }
      });
      
      if (score > 0) {
        scores.push({ doc, score });
      }
    });

    return scores.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

class AfterLinkRAG {
  constructor(confidenceThreshold = 0.75) {
    this.embeddingModel = null;
    this.embeddingsWrapper = null;
    this.vectorStore = null;
    this.documents = [];
    this.confidenceThreshold = confidenceThreshold;
    this.sessionContext = new Map();
    this.reranker = new CrossEncoderReranker();
    this.bm25 = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Dynamically load peer dependencies
    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
    env = transformers.env;

    // Load LangChain FAISS
    const langchainFaiss = await import('@langchain/community/vectorstores/faiss');
    FAISS = langchainFaiss.FaissStore;

    // Use default local cache paths and environment configurations

    // Initialize all-MiniLM-L6-v2 embedding model
    try {
      this.embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.embeddingsWrapper = new XenovaEmbeddings(this.embeddingModel);
    } catch (err) {
      console.error(`[AI-RAG] Failed to load embedding model: ${err.message}`);
      throw err;
    }

    // Load document store JSON if exists
    if (fs.existsSync(DOCUMENTS_FILE)) {
      try {
        this.documents = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf-8'));
        this.bm25 = new BM25(this.documents);
      } catch (err) {
        console.error(`[AI-RAG] Error reading documents.json: ${err.message}`);
        this.documents = [];
      }
    }

    // Load FAISS index if exists
    if (fs.existsSync(path.join(FAISS_DIR, 'args.json'))) {
      try {
        this.vectorStore = await FAISS.load(FAISS_DIR, this.embeddingsWrapper);
      } catch (err) {
        console.error(`[AI-RAG] Error loading FAISS store: ${err.message}. Recreating...`);
        this.vectorStore = null;
      }
    }

    this.initialized = true;
  }

  /**
   * Ingest documents, generates embeddings, stores them in FAISS, and persists both FAISS and documents.json
   */
  async ingestDocuments(docs) {
    await this.initialize();
    
    if (!docs || docs.length === 0) return;

    // Standardize documents and structure metadata
    const parsedDocs = docs.map(doc => {
      const category = doc.metadata?.category || doc.category || 'documentation';
      const version = doc.metadata?.version || '1.0.0';
      const difficulty = doc.metadata?.difficulty || 'beginner';
      
      return {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        metadata: {
          category,
          version,
          difficulty
        }
      };
    });

    // Update internal documents state (idempotent: replace matching ids)
    for (const parsed of parsedDocs) {
      const idx = this.documents.findIndex(d => d.id === parsed.id);
      if (idx !== -1) {
        this.documents[idx] = parsed;
      } else {
        this.documents.push(parsed);
      }
    }

    // Rebuild BM25
    this.bm25 = new BM25(this.documents);

    // Save documents.json
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(this.documents, null, 2), 'utf-8');

    // Rebuild FAISS index
    const langchainDocs = this.documents.map(d => ({
      pageContent: `${d.title}\n${d.content}`,
      metadata: {
        id: d.id,
        title: d.title,
        category: d.metadata.category,
        version: d.metadata.version,
        difficulty: d.metadata.difficulty
      }
    }));

    try {
      const batchSize = 25;
      let vectorStore = null;

      for (let i = 0; i < langchainDocs.length; i += batchSize) {
        const batch = langchainDocs.slice(i, i + batchSize);
        if (!vectorStore) {
          vectorStore = await FAISS.fromDocuments(batch, this.embeddingsWrapper);
        } else {
          await vectorStore.addDocuments(batch);
        }
      }

      this.vectorStore = vectorStore;
      
      // Save FAISS index
      fs.mkdirSync(FAISS_DIR, { recursive: true });
      await this.vectorStore.save(FAISS_DIR);
    } catch (err) {
      console.error(`[AI-RAG] Failed to index FAISS: ${err.message}`);
      throw err;
    }
  }

  /**
   * Performs hybrid search (BM25 + Semantic FAISS) with metadata filtering
   */
  async hybridSearch(query, queryEmbedding, filterOptions = {}) {
    // 1. Run Semantic FAISS similarity search
    let faissResults = [];
    if (this.vectorStore) {
      const rawFaiss = await this.vectorStore.similaritySearchVectorWithScore(queryEmbedding, 40);
      faissResults = rawFaiss.map(([doc, score]) => ({
        doc: {
          id: doc.metadata.id,
          title: doc.metadata.title,
          content: doc.pageContent.substring(doc.metadata.title.length + 1), // strip off the prepended title
          metadata: {
            category: doc.metadata.category,
            version: doc.metadata.version,
            difficulty: doc.metadata.difficulty
          }
        },
        score: score, // Langchain FAISS returns L2 distance
        isDistance: true
      }));
    }

    // Apply metadata pre-filtering on FAISS results if filter set
    if (filterOptions.difficulty) {
      faissResults = faissResults.filter(item => item.doc.metadata.difficulty === filterOptions.difficulty);
    }

    // Convert L2 distances to similarity scores (range: [0, 1], higher is better)
    const processedSemantic = faissResults.map(item => {
      const similarity = 1.0 / (1.0 + item.score);
      return {
        ...item,
        score: similarity,
        isDistance: false
      };
    });

    // 2. Run BM25 keyword search
    let bm25Results = [];
    if (this.bm25) {
      const rawBm25 = this.bm25.search(query, 40);
      bm25Results = rawBm25.map(item => ({
        doc: item.doc,
        score: item.score,
        isDistance: false
      }));
    }

    // Apply metadata filtering on BM25 results if filter set
    if (filterOptions.difficulty) {
      bm25Results = bm25Results.filter(item => item.doc.metadata.difficulty === filterOptions.difficulty);
    }

    // Normalize BM25 scores to [0, 1] range
    let normalizedBm25 = [];
    if (bm25Results.length > 0) {
      const scores = bm25Results.map(r => r.score);
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      const range = maxScore - minScore;
      
      normalizedBm25 = bm25Results.map(item => ({
        ...item,
        score: range > 0 ? (item.score - minScore) / range : 1.0
      }));
    }

    // 3. Fuse scores (0.3 * BM25 + 0.7 * Embedding)
    const fusedMap = new Map();

    // Incorporate semantic results
    processedSemantic.forEach(item => {
      fusedMap.set(item.doc.id, {
        doc: item.doc,
        semanticScore: item.score,
        bm25Score: 0.0
      });
    });

    // Incorporate BM25 results
    normalizedBm25.forEach(item => {
      if (fusedMap.has(item.doc.id)) {
        fusedMap.get(item.doc.id).bm25Score = item.score;
      } else {
        fusedMap.set(item.doc.id, {
          doc: item.doc,
          semanticScore: 0.0,
          bm25Score: item.score
        });
      }
    });

    // Compute final fusion score (balanced hybrid search)
    const fusedResults = Array.from(fusedMap.values()).map(item => {
      const finalScore = 0.3 * item.bm25Score + 0.7 * item.semanticScore;
      return {
        doc: item.doc,
        score: parseFloat(finalScore.toFixed(4))
      };
    });

    // Sort by final score and take top-20
    return fusedResults.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  /**
   * Main query entry point. Returns { answer, confidence, sources: [{title, score}] }
   */
  async query(userQuery, sessionId = 'default') {
    await this.initialize();
    
    // Retrieve or initialize session context history
    if (!this.sessionContext.has(sessionId)) {
      this.sessionContext.set(sessionId, []);
    }
    const history = this.sessionContext.get(sessionId);

    // a) Preprocess query
    const preprocessed = preprocessQuery(userQuery);

    // b) Inject session context if follow-up detected
    const { expandedQuery, isFollowUpQuery } = addContext(preprocessed, history);

    // c) Generate query embedding
    const queryVector = await this.embeddingsWrapper.embedQuery(expandedQuery);

    // Metadata filter parser: Support prefixes like "advanced: TLS"
    let targetQuery = expandedQuery;
    let difficultyFilter = null;
    const prefixMatch = targetQuery.match(/^(advanced|intermediate|beginner|basic):\s*(.*)$/i);
    if (prefixMatch) {
      const level = prefixMatch[1].toLowerCase();
      difficultyFilter = (level === 'advanced') ? 'high' : (level === 'intermediate' ? 'medium' : 'beginner');
      targetQuery = prefixMatch[2];
    }

    // d) Retrieve top-20 candidates from hybrid search
    const candidates = await this.hybridSearch(targetQuery, queryVector, { difficulty: difficultyFilter });

    if (candidates.length === 0) {
      return {
        answer: "I couldn't find any relevant AfterLink documentation. Try asking a different way or specify key classes like Server or Client.",
        confidence: 0.0,
        sources: []
      };
    }

    // Run Cross-Encoder reranking
    let topCandidates = candidates;
    try {
      topCandidates = await this.reranker.rerankCandidates(targetQuery, candidates, 20);
    } catch (e) {
      // Fallback if cross-encoder fails
      topCandidates = candidates.slice(0, 5);
    }

    // e) Calibrate confidence using temperature scaling (T=1.5)
    const calibratedCandidates = calibrateConfidence(topCandidates, 1.5);
    const topMatch = calibratedCandidates[0];

    let answer = '';
    let sources = [];

    // f) If top confidence < threshold (0.75): return clarification request
    if (!topMatch || topMatch.confidence < this.confidenceThreshold) {
      answer = this.generateClarification(calibratedCandidates);
      sources = calibratedCandidates.slice(0, 3).map(c => ({
        title: c.doc.title,
        score: c.confidence
      }));
    } else {
      // g) If confidence >= 0.75: generate contextual response
      answer = this.generateResponse(calibratedCandidates.slice(0, 5));
      sources = calibratedCandidates.slice(0, 3).map(c => ({
        title: c.doc.title,
        score: c.confidence
      }));
    }

    // h) Update session memory with this turn
    const cleanTopic = topMatch ? getCleanTopic(topMatch.doc.title) : 'AfterLink';
    history.push({
      query: userQuery,
      topic: cleanTopic,
      answer,
      timestamp: Date.now()
    });

    // Sliding window of last 10 turns
    if (history.length > 10) {
      history.shift();
    }

    return {
      answer,
      confidence: topMatch ? topMatch.confidence : 0,
      sources,
      isFollowUp: isFollowUpQuery,
      preprocessedQuery: preprocessed,
      expandedQuery
    };
  }

  /**
   * Format response:
   * "Based on the AfterLink documentation, here's what I found: [content] For more details, see: [doc title]"
   */
  generateResponse(topDocs) {
    if (!topDocs || topDocs.length === 0) return '';
    const mainDoc = topDocs[0].doc;
    
    // Extract main overview/content of document (strip markdown title if it's already there)
    let content = mainDoc.content;
    
    return `Based on the AfterLink documentation, here's what I found:\n\n${content}\n\nFor more details, see: ${mainDoc.title}`;
  }

  /**
   * Return: "I'm not sure what you mean. Did you mean: 1. [topic] 2. [topic] 3. [topic]? Please clarify."
   */
  generateClarification(candidates) {
    const topics = candidates
      .slice(0, 3)
      .map((c, i) => `${i + 1}. ${getCleanTopic(c.doc.title)}`);

    if (topics.length === 0) {
      return "I'm not sure what you mean. Could you please rephrase your query with more specific technical details?";
    }

    return `I'm not sure what you mean. Did you mean:\n${topics.join('\n')}\n\nPlease clarify.`;
  }
}

module.exports = {
  AfterLinkRAG,
  XenovaEmbeddings,
  BM25
};
