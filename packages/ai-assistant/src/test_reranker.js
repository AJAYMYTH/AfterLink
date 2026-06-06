const { CrossEncoderReranker } = require('./reranker');
const { AfterLinkRAG } = require('./rag');

async function main() {
  const reranker = new CrossEncoderReranker();
  console.log("Initializing reranker...");
  await reranker.initialize();
  console.log("Reranker initialized.");

  const query = "how to install afterlink";
  const docs = [
    { doc: { content: "To install AfterLink, run npm install afterlink." }, score: 0.9 },
    { doc: { content: "This is some unrelated text about nothing." }, score: 0.1 }
  ];

  console.log("Running rerank...");
  try {
    const rawRes1 = await reranker.reranker(query, docs[0].doc.content);
    const rawRes2 = await reranker.reranker(query, docs[1].doc.content);
    console.log("Raw output 1:", rawRes1);
    console.log("Raw output 2:", rawRes2);
    const results = await reranker.rerankCandidates(query, docs, 2);
    console.log("Rerank results:", JSON.stringify(results, null, 2));
  } catch (e) {
    console.error("Rerank failed:", e);
  }
}

main();
