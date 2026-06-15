#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR/blockchain"

# Start Hardhat node in background
echo "Starting hardhat node..."
npx hardhat node > /tmp/hardhat_node.log 2>&1 &
HH_PID=$!

echo "Waiting for hardhat node to start..."
sleep 3

# Deploy contract locally
echo "Deploying contract..."
npx hardhat run scripts/deploy.js --network localhost

echo "Starting docker-compose..."
cd ..
docker-compose up --build -d

echo "Backend services should now be running. Blockchain is integrated via .env"
echo "Hardhat PID: $HH_PID"
