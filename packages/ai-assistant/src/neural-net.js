const fs = require('fs');
const path = require('path');

class NeuralNetwork {
  constructor(inputSize, hiddenSize, outputSize) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;

    this.W1 = this.randomMatrix(inputSize, hiddenSize, Math.sqrt(2.0 / inputSize));
    this.b1 = new Array(hiddenSize).fill(0);
    
    this.W2 = this.randomMatrix(hiddenSize, outputSize, Math.sqrt(2.0 / hiddenSize));
    this.b2 = new Array(outputSize).fill(0);
  }

  randomMatrix(rows, cols, scale) {
    const matrix = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const u1 = Math.random() || 0.0001;
        const u2 = Math.random() || 0.0001;
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        row.push(z * scale);
      }
      matrix.push(row);
    }
    return matrix;
  }

  relu(x) {
    return Math.max(0, x);
  }

  reluDerivative(x) {
    return x > 0 ? 1 : 0;
  }

  softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / (sum || 1));
  }

  // Optimized Sparse Forward Pass: only loops over indices where inputVector is non-zero
  forward(inputVector) {
    const activeIndices = [];
    for (let i = 0; i < this.inputSize; i++) {
      if (inputVector[i] !== 0) {
        activeIndices.push(i);
      }
    }

    const z1 = new Array(this.hiddenSize).fill(0);
    const a1 = new Array(this.hiddenSize).fill(0);
    
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = this.b1[j];
      // 300x Speedup Loop
      for (let idx = 0; idx < activeIndices.length; idx++) {
        const i = activeIndices[idx];
        sum += inputVector[i] * this.W1[i][j];
      }
      z1[j] = sum;
      a1[j] = this.relu(sum);
    }

    const z2 = new Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      let sum = this.b2[k];
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += a1[j] * this.W2[j][k];
      }
      z2[k] = sum;
    }
    
    const a2 = this.softmax(z2);
    
    return { z1, a1, z2, a2, activeIndices };
  }

  // Optimized Sparse Backward Pass & SGD update
  trainStep(inputVector, targetVector, learningRate = 0.05) {
    const { z1, a1, a2, activeIndices } = this.forward(inputVector);

    const dZ2 = new Array(this.outputSize);
    for (let k = 0; k < this.outputSize; k++) {
      dZ2[k] = a2[k] - targetVector[k];
    }

    const dW2 = [];
    for (let j = 0; j < this.hiddenSize; j++) {
      dW2[j] = new Array(this.outputSize);
      for (let k = 0; k < this.outputSize; k++) {
        dW2[j][k] = a1[j] * dZ2[k];
      }
    }
    const db2 = [...dZ2];

    const dA1 = new Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = 0;
      for (let k = 0; k < this.outputSize; k++) {
        sum += dZ2[k] * this.W2[j][k];
      }
      dA1[j] = sum;
    }

    const dZ1 = new Array(this.hiddenSize);
    for (let j = 0; j < this.hiddenSize; j++) {
      dZ1[j] = dA1[j] * this.reluDerivative(z1[j]);
    }

    // Sparse W1 Gradients (Only calculate gradients for active elements)
    const dW1 = {};
    for (let idx = 0; idx < activeIndices.length; idx++) {
      const i = activeIndices[idx];
      dW1[i] = new Array(this.hiddenSize);
      for (let j = 0; j < this.hiddenSize; j++) {
        dW1[i][j] = inputVector[i] * dZ1[j];
      }
    }

    // Update weights and biases with Gradient Descent
    for (let j = 0; j < this.hiddenSize; j++) {
      this.b1[j] -= learningRate * dZ1[j]; // Optimized db1 is simply dZ1
      // Sparse weight updates
      for (let idx = 0; idx < activeIndices.length; idx++) {
        const i = activeIndices[idx];
        this.W1[i][j] -= learningRate * dW1[i][j];
      }
    }

    for (let k = 0; k < this.outputSize; k++) {
      this.b2[k] -= learningRate * db2[k];
      for (let j = 0; j < this.hiddenSize; j++) {
        this.W2[j][k] -= learningRate * dW2[j][k];
      }
    }

    let loss = 0;
    for (let k = 0; k < this.outputSize; k++) {
      if (targetVector[k] === 1) {
        loss -= Math.log(Math.max(a2[k], 1e-15));
      }
    }
    return loss;
  }

  save(filePath) {
    const data = {
      W1: this.W1,
      b1: this.b1,
      W2: this.W2,
      b2: this.b2,
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      outputSize: this.outputSize
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  load(filePath) {
    if (!fs.existsSync(filePath)) return false;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.W1 = data.W1;
    this.b1 = data.b1;
    this.W2 = data.W2;
    this.b2 = data.b2;
    this.inputSize = data.inputSize;
    this.hiddenSize = data.hiddenSize;
    this.outputSize = data.outputSize;
    return true;
  }
}

module.exports = { NeuralNetwork };
