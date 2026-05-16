#!/usr/bin/env bash
# AfterLink Communication Protocol - Installation Script
# Run: bash install.sh

set -e

echo "============================================"
echo " AfterLink Communication Protocol"
echo " Installation Script"
echo "============================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    echo "Please install Node.js 20+ from https://nodejs.org/"
    echo ""
    echo "Or use nvm:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    echo "  nvm install 20"
    exit 1
fi

echo "[OK] Node.js found: $(node --version)"
echo ""

# Check Node.js version
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "[ERROR] Node.js 20+ is required. Found: $(node --version)"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "[INFO] pnpm not found. Installing pnpm..."
    npm install -g pnpm
fi

echo "[OK] pnpm found: $(pnpm --version)"
echo ""

# Install dependencies
echo "[INFO] Installing dependencies..."
pnpm install
echo ""

echo "[OK] Dependencies installed successfully."
echo ""

# Run tests
echo "[INFO] Running tests..."
cd packages/core
npx vitest run
cd ../..
echo ""

echo "============================================"
echo " Installation Complete!"
echo "============================================"
echo ""
echo " Quick Start:"
echo "   1. Run demo showcase:"
echo "      cd examples/demo-runner && node index.js"
echo ""
echo "   2. Run chat demo:"
echo "      cd examples/demo-chat"
echo "      node server.js    # Terminal 1"
echo "      node client.js    # Terminal 2"
echo ""
echo "   3. Run stock dashboard:"
echo "      cd examples/demo-dashboard"
echo "      node server.js    # Terminal 1"
echo "      node client.js    # Terminal 2"
echo ""
echo "   4. Run microservice demo:"
echo "      cd examples/demo-microservice"
echo "      node server.js    # Terminal 1"
echo "      node client.js    # Terminal 2"
echo ""
echo " Documentation: See README.md"
echo " GitHub: https://github.com/AJAYMYTH/AfterLink"
echo "============================================"
echo ""
