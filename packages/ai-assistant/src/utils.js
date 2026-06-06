/**
 * Calibrates confidence scores for retrieved candidates using Temperature Scaling and Softmax.
 * Temperature T = 1.5
 * rawScore should be a similarity score (higher is better). 
 * If FAISS returns L2 distances, they are converted to similarity scores before calibration.
 */
function calibrateConfidence(candidates, temperature = 1.5) {
  if (!candidates || candidates.length === 0) return [];

  // Deduplicate candidates by document content to prevent duplicate dilution
  const uniqueCandidates = [];
  const seenContents = new Set();
  
  for (const c of candidates) {
    const contentKey = (c.doc.content || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!seenContents.has(contentKey)) {
      seenContents.add(contentKey);
      uniqueCandidates.push(c);
    }
  }

  // Slice to top-5 unique candidates to prevent score dilution in softmax
  const topCandidates = uniqueCandidates.slice(0, 5);

  if (topCandidates.length === 1) {
    let similarity = topCandidates[0].score;
    if (topCandidates[0].isDistance) {
      similarity = 1.0 / (1.0 + topCandidates[0].score);
    }
    return [{
      doc: topCandidates[0].doc,
      rawScore: topCandidates[0].score,
      similarity,
      confidence: parseFloat(similarity.toFixed(4))
    }];
  }

  // 1. Convert similarity scores to logits and scale by temperature
  const scaledScores = topCandidates.map(c => {
    let similarity = c.score;
    if (c.isDistance) {
      similarity = 1.0 / (1.0 + c.score);
    }
    
    // Clamp similarity to avoid Math.log(0) or division by zero
    const clampedSimilarity = Math.max(0.0001, Math.min(0.9999, similarity));
    
    // Logit function: ln(p / (1 - p))
    const logit = Math.log(clampedSimilarity / (1.0 - clampedSimilarity));
    
    return {
      ...c,
      similarity,
      logit,
      scaledScore: logit / temperature
    };
  });

  // If the top candidate has a decent similarity score (>= 0.55),
  // bypass relative softmax to avoid multi-match dilution!
  const topSimilarity = scaledScores[0].similarity;
  if (topSimilarity >= 0.55) {
    return scaledScores.map((c, i) => {
      const confidence = i === 0 ? topSimilarity : (c.similarity / topSimilarity) * (1.0 - topSimilarity);
      return {
        doc: c.doc,
        rawScore: c.score,
        similarity: c.similarity,
        confidence: parseFloat(confidence.toFixed(4))
      };
    });
  }

  const maxScaled = Math.max(...scaledScores.map(c => c.scaledScore));
  
  // Subtract maxScaled to prevent overflow in exp
  const exps = scaledScores.map(c => Math.exp(c.scaledScore - maxScaled));
  const sumExps = exps.reduce((a, b) => a + b, 0);

  return scaledScores.map((c, i) => {
    const confidence = sumExps > 0 ? exps[i] / sumExps : 0;
    return {
      doc: c.doc,
      rawScore: c.score,
      similarity: c.similarity,
      confidence: parseFloat(confidence.toFixed(4))
    };
  });
}

/**
 * Detects if a query is a follow-up question.
 * Criteria:
 * - Query length is short (< 20 characters)
 * - Contains pronouns: "it", "that", "this", "they", "them"
 * - Starts with phrases like "and", "what about", "how about", "tell me about"
 */
function isFollowUp(query) {
  if (!query) return false;
  const clean = query.trim().toLowerCase();
  
  if (clean.length < 20) return true;

  const pronouns = /\b(it|that|this|they|them)\b/i;
  if (pronouns.test(clean)) return true;

  const followUpStarts = /^(and\b|what\s+about\b|how\s+about\b|tell\s+me\s+about\b|can\s+you\b|can\s+we\b|why\b|where\b)/i;
  if (followUpStarts.test(clean)) return true;

  return false;
}

/**
 * Adds context to a query if it is a follow-up.
 * Maintains sliding window of history (last 10 turns).
 */
function addContext(query, history = []) {
  if (history.length === 0) {
    return { expandedQuery: query, isFollowUpQuery: false };
  }

  const isFollow = isFollowUp(query);
  if (isFollow) {
    // Retrieve last turn's topic
    const lastTurn = history[history.length - 1];
    if (lastTurn && lastTurn.topic) {
      const expandedQuery = `${lastTurn.topic}. ${query}`;
      return { expandedQuery, isFollowUpQuery: true };
    }
  }

  return { expandedQuery: query, isFollowUpQuery: false };
}

/**
 * Strips category prefixes from document titles to formulate a clean topic.
 * E.g., "Documentation: TLS configuration" -> "TLS configuration"
 */
function getCleanTopic(title) {
  if (!title) return '';
  return title.replace(/^(documentation|overview|examples|core\s+protocol|server\s+sdk|client\s+sdk|browser\s+sdk|cli\s+tool):\s*/i, '').trim();
}

module.exports = {
  calibrateConfidence,
  isFollowUp,
  addContext,
  getCleanTopic
};
