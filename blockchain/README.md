# MarketMind Blockchain

This folder contains the smart contract and Hardhat setup for MarketMind's on-chain campaign funding integration.

Quick steps

1. Install dependencies

```bash
cd blockchain
npm install
```

2. Configure deploy environment (create a `.env` in the `blockchain/` folder)

Example `.env` (DO NOT COMMIT private keys):

```
# Sepolia RPC (Alchemy) - TODO: insert your Alchemy Sepolia RPC URL
ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Private key of deployer (for Hardhat deploy) - TODO: insert deployer private key securely
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

3. Deploy to Sepolia

```bash
npx hardhat run --network sepolia scripts/deploy.js
```

4. After deploy

- Copy the deployed contract address into your orchestrator service env as `CONTRACT_ADDRESS`.
- Copy the contract ABI to your orchestrator environment either via `CONTRACT_ABI` (JSON string) or save it to a file and set `CONTRACT_ABI_PATH` to the path.

Notes
- Use Sepolia chainId `11155111` for configuration and Docker env.
- Never commit private keys or RPC secrets. Use a secrets manager for production.
