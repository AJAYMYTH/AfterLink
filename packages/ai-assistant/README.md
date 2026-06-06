# @ajaymyth/ai-assistant (Proprietary Neural Network Model)

A fully-custom, 100% offline **Multi-Layer Perceptron (MLP) Neural Network** built entirely from scratch in Node.js. 

This package does **not** rely on Ollama, Llama, Gemini, OpenAI, or any other pre-trained third-party LLMs. It represents your own proprietary neural network trained directly on the AfterLink Communication Protocol source code, examples, and documentation, complete with high-fidelity CLI micro-animations.

---

## Technical Architecture

* **Input Layer**: Vector size equal to vocabulary size (default: 800 most frequent tokens across the codebase). Evaluated using normalized bag-of-words.
* **Hidden Layer**: 64 neurons utilizing the ReLU (Rectified Linear Unit) activation function.
* **Output Layer**: Dynamic dimension matching the total number of knowledge categories and code blocks parsed (344 endpoints/specifications). Uses the **Softmax** activation function to output clear class probability distributions.
* **Backpropagation Engine**: Employs categorical cross-entropy loss with Stochastic Gradient Descent (SGD) weight updates.
* **Inference Pipeline**: Converts natural language queries into feature vectors using **TF-IDF Inverse Document Frequency (IDF)** scaling, runs the forward propagation pass, and retrieves the most statistically relevant codebase solutions.

---

## Premium Console Micro-Animations

To provide a state-of-the-art interactive coding experience, the CLI terminal features custom physics-based TUI animations:
1. **Sweep Text Shimmer**: A dynamic, looping bright Cyan light sweep that runs across `"🧠 Analyzing query against proprietary neural network..."` during active neural reasoning, cleaning up seamlessly upon completion.
2. **Line-by-Line Dot Matrix Scan**: Phased console printing. Every output block—including code panels, boxes, headers, and resource lists—is first drawn as a sequence of high-contrast dot matrix loading placeholders (`░░░░░░░`) before scanning and revealing the actual formatted, colorized text.

---

## Project Structure

```
packages/ai-assistant/
├── README.md               # User guide & documentation
├── package.json            # Scripts & project manifest
└── src/
    ├── afterlink-knowledge.json  # Ingested codebase database (generated)
    ├── vocabulary.json     # Trained vectorizer terms (generated)
    ├── model-weights.json  # Trained neural network weights (generated)
    ├── neural-net.js       # Forward-pass, Backprop & SGD Neural Network class
    ├── ingest.js           # Extracts text chunks from codebase
    ├── train.js            # Vocabulary compiler and Backprop training loop
    └── chat.js             # Interactive terminal UI executing local inferences and TUI animations
```

---

## 1. Prerequisites & Setup

Ensure you have Node.js 20.0.0 or higher installed. There are **no other software dependencies** (no Ollama, no API keys, no python binaries).

Install the package developer dependencies:

```bash
pnpm install
```

---

## 2. Training Your Custom Model

To index your codebase and train your proprietary neural network, execute the compilation pipeline:

```bash
# Step 1: Ingest documentation and source code
node packages/ai-assistant/src/ingest.js

# Step 2: Train the Multi-Layer Perceptron Neural Network
node packages/ai-assistant/src/train.js
```

During execution of `train.js`, the script will build the vectorizer vocabulary, calculate Inverse Document Frequencies (IDF), initialize the neural network matrices, perform gradient descent, and save the parameters.

---

## 3. Launching the Assistant

To query your trained model and seek assistance on building applications, troubleshooting bugs, or retrieving specifications with animated transitions:

```bash
node packages/ai-assistant/src/chat.js
```

Type a question such as:
* *"How do I set up a secure AfterLink server with TLS?"*
* *"What is the structure of the 10-byte binary frame header?"*
* *"Explain the Zod schema validation rules."*
