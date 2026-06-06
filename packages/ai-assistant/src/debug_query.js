const { AfterLinkRAG } = require('./rag');
const { preprocessQuery } = require('./preprocess');

async function main() {
  const rag = new AfterLinkRAG(0.70);
  await rag.initialize();

  const targetQueries = [
    "What is the role of the Frame Router?",
    "How to create custom pub sub broker",
    "persistent tcp conection",
    "API specs"
  ];

  for (const q of targetQueries) {
    console.log(`\n========================================`);
    console.log(`Query: "${q}"`);
    
    // a) Preprocess query
    const preprocessed = preprocessQuery(q);
    console.log(`Preprocessed: "${preprocessed}"`);

    // c) Generate query embedding
    const queryVector = await rag.embeddingsWrapper.embedQuery(preprocessed);

    // d) Retrieve top-20 candidates from hybrid search
    const candidates = await rag.hybridSearch(preprocessed, queryVector);
    console.log(`\nTop 5 Hybrid Candidates:`);
    candidates.slice(0, 5).forEach((c, idx) => {
      console.log(`  ${idx + 1}. Title: "${c.doc.title}", Score: ${c.score}`);
    });

    // Run Cross-Encoder reranking
    const topCandidates = await rag.reranker.rerankCandidates(preprocessed, candidates, 20);
    console.log(`\nTop 5 Reranked Candidates:`);
    topCandidates.slice(0, 5).forEach((c, idx) => {
      console.log(`  ${idx + 1}. Title: "${c.doc.title}", RerankScore: ${c.score} (Orig: ${c.originalScore})`);
    });
  }
}

main().catch(err => console.error(err));

