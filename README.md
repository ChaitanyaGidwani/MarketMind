# MarketMind

Multi-agent AI marketing platform for orchestrated campaign planning and execution with on-chain funding and settlement via Solidity smart contracts.

## Stack
- **Backend:** Python 3.12 + FastAPI + Pydantic v2 + SQLAlchemy + httpx
- **Frontend:** React + Vite + Tailwind + Chart.js
- **Blockchain:** Solidity 0.8.20 + Hardhat + Ethers.js v5 + OpenZeppelin
- **Communication:** A2A-style JSON-RPC over HTTP + SSE stream
- **Data:** SQLite + Docker Compose
- **Network:** Local Hardhat node (31337) or Sepolia testnet (11155111)

## Quickstart (Local Development)

### Prerequisites
- Node.js 18+ with npm
- Python 3.9+
- Docker Desktop running
- Virtual environment activated: `source .venv/bin/activate`

### Setup & Run
1. Copy `.env.example` to `.env` (or run the automated script below)
2. **Automated local deployment:**
   ```bash
   ./start_local.sh
   ```
   This will:
   - Start a local Hardhat blockchain node (port 8545)
   - Deploy the `CampaignBudget` contract
   - Launch all backend services via Docker Compose
   - Update your `.env` with contract address and credentials

3. Open dashboard at `http://localhost:5173`

### Manual Setup
```bash
# Terminal 1: Start blockchain
cd blockchain && npx hardhat node

# Terminal 2: Deploy contract
cd blockchain && npx hardhat run scripts/deploy.js --network localhost

# Terminal 3: Start backend services
docker compose up --build

# Terminal 4: Start frontend (optional, for UI)
cd frontend && npm run dev
```

## Services

### Backend API Services
- **`a2a_hub` (8000):** JSON-RPC gateway, agent card registry, SSE broadcaster
- **`orchestrator` (8001):** Campaign orchestration with on-chain funding gates, bid scoring, task dispatch, budget re-negotiation (max 3 rounds), and on-chain settlement
- **`content_agent` (8002):** Copy and email draft generation (Groq Llama 3.3 or fallback)
- **`ad_agent` (8003):** Google/Meta sandbox ad outputs (mock)
- **`email_agent` (8004):** Drip sequence + Resend dispatch (or mock)
- **`seo_agent` (8005):** Keyword and metadata generation
- **`analytics_agent` (8006):** ROI metrics and renegotiation signal

### Frontend
- **`frontend` (5173):** Campaign wizard, SSE monitor, ROI chart

### Blockchain (Solidity Smart Contract)
- **`CampaignBudget.sol`:** Manages campaign funding (`fundCampaign`), settlement (`settleCampaign`), and refunds (`withdrawUnspent`)
  - Deployed locally to `0x5FbDB2315678afecb367f032d93F642f64180aa3` (after running `start_local.sh`)
  - Events: `CampaignFunded`, `CampaignSettled`

## Campaign Flow & On-Chain Integration

### Execution Flow
1. **Frontend** sends `campaign.start` with goal, budget, audience, and funding proof.
2. **Orchestrator** checks on-chain: `is_campaign_funded(campaign_id)` must return `true`.
   - If funding is not found, campaign start is rejected with error code 40201.
3. **Orchestrator** requests `capability.bid` from each execution agent in parallel.
4. **Orchestrator** scores bids using ROI predictions, allocates budget, and dispatches tasks.
5. **Agents** execute in parallel (max 3 rounds of re-negotiation based on analytics).
6. **Analytics Agent** computes ROI and signals whether to continue or settle.
7. **Campaign Completes:** Orchestrator triggers on-chain settlement.
   - Calls `settleCampaign(campaign_id, roi_score)` with final ROI score.
   - Transaction hash is recorded in campaign history.
8. **Settlement Events:** `CampaignSettled` is emitted on-chain.
9. **Refunds (Optional):** Owner can call `withdrawUnspent(campaign_id, recipient_address)` to refund unused funds.

### Blockchain Details
- **Network:** Hardhat (local, chain ID 31337) or Sepolia (testnet, chain ID 11155111)
- **Contract:** `CampaignBudget.sol` at address stored in `.env` as `CONTRACT_ADDRESS`
- **Signer:** `ORCHESTRATOR_PRIVATE_KEY` (must own the contract or be approved)
- **RPC Provider:** `ALCHEMY_RPC_URL` (local: `http://127.0.0.1:8545`, testnet: Alchemy Sepolia RPC)

## Testing

### Smart Contract Tests
```bash
cd blockchain
npx hardhat test  # Run all unit tests for CampaignBudget
```
Tests cover:
- ✅ Funding with ETH value validation
- ✅ Zero-value revert
- ✅ Multiple funder accumulation
- ✅ Owner-only settlement + double-settlement revert
- ✅ Withdraw refunds + owner-only checks
- ✅ Budget state management

### Local Smoke Test (Full E2E Transaction Flow)
```bash
cd blockchain
npx hardhat run scripts/smoke-local.js
```
Validates:
- ✅ Contract deployment on local network
- ✅ Fund campaign transaction
- ✅ Settle campaign transaction with ROI score
- ✅ Withdraw unspent funds transaction
- ✅ Budget state resets correctly

## Environment Variables

### Backend API & Services
```dotenv
A2A_HUB_URL=http://a2a_hub:8000
ORCHESTRATOR_URL=http://orchestrator:8001
CONTENT_AGENT_URL=http://content_agent:8002
AD_AGENT_URL=http://ad_agent:8003
EMAIL_AGENT_URL=http://email_agent:8004
SEO_AGENT_URL=http://seo_agent:8005
ANALYTICS_AGENT_URL=http://analytics_agent:8006

DATABASE_URL=sqlite+aiosqlite:///./data/marketmind.db
CORS_ORIGINS=*
USE_MOCK=false  # Set true to bypass external APIs
```

### External APIs
```dotenv
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_TO_EMAIL=marketing@yourcompany.com
```

### Blockchain / Web3
```dotenv
# Local (Hardhat)
ALCHEMY_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337

# Or Sepolia Testnet
ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
CHAIN_ID=11155111

# Contract & Keys (KEEP SECRET)
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
CONTRACT_ABI_PATH=blockchain/artifacts/contracts/CampaignBudget.sol/CampaignBudget.json
ORCHESTRATOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Constraints Implemented

- `USE_MOCK=true` short-circuits external APIs.
- Inter-service URLs are read from environment variables.
- Open CORS enabled on all APIs.
- Single running campaign at a time.
- On-chain funding gate: campaigns cannot start without sufficient budget funded on-chain.
- Owner-only settlement: only `ORCHESTRATOR_PRIVATE_KEY` can call `settleCampaign()`.
- Budget guards: max 3 re-negotiation rounds, 110% spend guard.
- Authentication is currently disabled in local development mode.

## Deployment

### Local Testing (Recommended First Step)
Run the automated startup script to validate the full stack locally:
```bash
./start_local.sh
```
This boots:
- Hardhat blockchain (port 8545) with 20 test accounts (10,000 ETH each)
- `CampaignBudget` contract deployment
- 7 backend microservices via Docker Compose
- `.env` is auto-populated with contract address and Hardhat account keys

### Production Deployment to Sepolia Testnet
1. **Prepare Sepolia RPC & Account:**
   ```bash
   # Get a free Alchemy RPC URL for Sepolia
   export ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-KEY
   
   # Export your wallet private key (ensure it has testnet ETH for gas)
   export ORCHESTRATOR_PRIVATE_KEY=0x...
   ```

2. **Deploy Contract:**
   ```bash
   cd blockchain
   npx hardhat run scripts/deploy.js --network sepolia
   ```
   Copy the printed contract address.

3. **Update `.env` for Production:**
   ```dotenv
   ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-KEY
   CONTRACT_ADDRESS=0x...  # From step 2
   ORCHESTRATOR_PRIVATE_KEY=0x...
   CHAIN_ID=11155111
   ```

4. **Deploy Backend to Cloud:**
   - **Option A (Render):** Push to GitHub, connect Render, set env vars, deploy `docker-compose.yml` via Blueprint
   - **Option B (AWS/ECS):** Push image to ECR, create ECS service, mount `.env` via Secrets Manager
   - **Option C (DigitalOcean):** Deploy single droplet with Docker, run `docker compose up`

5. **Verify Deployment:**
   ```bash
   # Check orchestrator health
   curl http://YOUR-BACKEND-URL:8001/health
   
   # Verify blockchain connection
   curl http://YOUR-BACKEND-URL:8001/rpc -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"contract.get_budget","params":{"campaign_id":1},"id":1}'
   ```

### Security Checklist for Production
- ✅ Store `ORCHESTRATOR_PRIVATE_KEY` in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- ✅ Use environment-specific `.env` files (never commit real keys)
- ✅ Enable HTTPS on all endpoints
- ✅ Restrict CORS origins to your frontend domain
- ✅ Add API rate limiting
- ✅ Monitor transaction failures and gas costs
- ✅ Set up automated backups for SQLite database
- ✅ Use a managed RPC provider (Alchemy, Infura) with rate limits
- ✅ Implement request signing and nonce management for replay protection

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to localhost:8545" | Ensure Hardhat node is running in a separate terminal: `cd blockchain && npx hardhat node` |
| "CONTRACT_ADDRESS not found in env" | Run `./start_local.sh` or manually set `CONTRACT_ADDRESS` in `.env` after deploy |
| "ORCHESTRATOR_PRIVATE_KEY not set" | Copy a private key from Hardhat accounts output to `.env` |
| Docker build fails | Ensure Python 3.12 is available in Docker Desktop; rebuild: `docker compose down && docker compose up --build` |
| Blockchain tx rejected: "Already settled" | Contract prevents double settlement; use a new `campaign_id` |
| Frontend won't connect to backend | Check that `A2A_HUB_URL` in `.env` matches your backend service URL |

## Project Structure
```
Market-Mind/
├── blockchain/                # Solidity contracts & tests
│   ├── contracts/CampaignBudget.sol
│   ├── test/CampaignBudget.test.js
│   ├── scripts/deploy.js
│   ├── scripts/smoke-local.js
│   └── hardhat.config.js
├── services/                  # Python microservices
│   ├── a2a_hub/
│   ├── orchestrator/          # ← Campaign orchestration + blockchain gate
│   │   ├── blockchain.py      # ← Web3 integration
│   │   └── app/main.py
│   ├── content_agent/
│   ├── ad_agent/
│   ├── email_agent/
│   ├── seo_agent/
│   └── analytics_agent/
├── shared/                    # Shared schemas & validators
│   ├── schemas.py
│   ├── validator.py
│   └── output_store.py
├── frontend/                  # React + Vite UI
├── docker-compose.yml         # Multi-service orchestration
├── Dockerfile.backend         # Python 3.12 backend image
├── requirements.txt
├── .env.example
└── start_local.sh             # Automated local startup

```