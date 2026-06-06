let pipeline;
let env;

// Lazily import @xenova/transformers to prevent load delays
async function getTransformers() {
  const transformers = await import('@xenova/transformers');
  pipeline = transformers.pipeline;
  env = transformers.env;
  
  // Rely on default cached paths and environment settings
}

class CrossEncoderReranker {
  constructor() {
    this.modelName = 'Xenova/ms-marco-MiniLM-L-6-v2';
    this.reranker = null;
  }

  async initialize() {
    if (this.reranker) return;
    
    if (!pipeline) {
      await getTransformers();
    }
    
    try {
      // Cross-encoders are represented as text-classification pipelines in Transformers.js
      this.reranker = await pipeline('text-classification', this.modelName);
    } catch (err) {
      console.error(`[AI-Reranker] Failed to load reranker model ${this.modelName}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Reranks top candidates for a given query
   * @param {string} query - The user query
   * @param {Array} candidates - Array of {doc, score} from FAISS/BM25
   * @param {number} topK - Number of candidates to return
   */
  async rerankCandidates(query, candidates, topK = 5) {
    if (!candidates || candidates.length === 0) return [];
    
    await this.initialize();

    const reranked = [];
    
    // Process candidates in chunks/batches to optimize CPU utilization
    for (const item of candidates) {
      try {
        const text = query;
        // Construct standard input pair
        // Input to ms-marco cross encoder is query and document content
        const content = item.doc.content || '';
        
        // Tokenize query and content together for the Cross-Encoder
        const inputs = await this.reranker.tokenizer(text, { text_pair: content, padding: true, truncation: true });
        
        // Run direct sequence classification model forward pass
        const outputs = await this.reranker.model(inputs);
        
        // Extract the raw logit
        const logit = outputs.logits.data[0];
        
        // Apply Sigmoid with a +2.0 logit shift to convert logit to a similarity score [0, 1]
        // This calibrates the conservative cross-encoder predictions for highly specific technical domain terms
        const score = 1.0 / (1.0 + Math.exp(-(logit + 2.0)));
        
        reranked.push({
          ...item,
          rerankScore: score
        });
      } catch (err) {
        // Fall back to original score if reranking fails for a specific document
        reranked.push({
          ...item,
          rerankScore: item.score || 0
        });
      }
    }

    // Sort by rerank score descending
    reranked.sort((a, b) => b.rerankScore - a.rerankScore);

    // Map rerank score back to score field and return topK
    return reranked.slice(0, topK).map(item => ({
      doc: item.doc,
      score: item.rerankScore,
      originalScore: item.score
    }));
  }
}

module.exports = {
  CrossEncoderReranker
};
