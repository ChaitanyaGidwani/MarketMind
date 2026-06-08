from __future__ import annotations

import json
import os
from typing import Any

from web3 import Web3
from web3.exceptions import ContractLogicError


ALCHEMY_RPC_URL = os.getenv("ALCHEMY_RPC_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
CONTRACT_ABI = os.getenv("CONTRACT_ABI")
CONTRACT_ABI_PATH = os.getenv("CONTRACT_ABI_PATH")
ORCHESTRATOR_PRIVATE_KEY = os.getenv("ORCHESTRATOR_PRIVATE_KEY")
CHAIN_ID = int(os.getenv("CHAIN_ID" or 11155111))


if not ALCHEMY_RPC_URL:
    # runtime will raise if not configured; keep soft here
    pass


def _init_client() -> Web3:
    provider = Web3.HTTPProvider(ALCHEMY_RPC_URL) if ALCHEMY_RPC_URL else None
    w3 = Web3(provider)
    return w3


def _load_contract(w3: Web3):
    if not CONTRACT_ADDRESS:
        raise RuntimeError("Missing CONTRACT_ADDRESS env variable")

    abi = None
    if CONTRACT_ABI:
        try:
            abi = json.loads(CONTRACT_ABI)
        except Exception as exc:  # pragma: no cover - runtime guard
            raise RuntimeError("Invalid CONTRACT_ABI JSON") from exc
    elif CONTRACT_ABI_PATH:
        if not os.path.isabs(CONTRACT_ABI_PATH):
            # allow relative paths from repo root
            base = os.getcwd()
            path = os.path.join(base, CONTRACT_ABI_PATH)
        else:
            path = CONTRACT_ABI_PATH
        if not os.path.exists(path):
            raise RuntimeError(f"CONTRACT_ABI_PATH not found: {path}")
        with open(path, "r", encoding="utf-8") as fh:
            abi = json.load(fh)

    if abi is None:
        raise RuntimeError("Missing contract ABI: set CONTRACT_ABI or CONTRACT_ABI_PATH env variable")

    return w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=abi)


def get_campaign_budget(campaign_id: int) -> int:
    """Return budget in wei for the campaign id."""
    w3 = _init_client()
    contract = _load_contract(w3)
    try:
        return int(contract.functions.getBudget(campaign_id).call())
    except ContractLogicError:
        return 0


def is_campaign_funded(campaign_id: int) -> bool:
    w3 = _init_client()
    contract = _load_contract(w3)
    try:
        budget = int(contract.functions.getBudget(campaign_id).call())
        return budget > 0
    except Exception:
        return False


def settle_campaign(campaign_id: int, roi_score: int) -> dict[str, Any]:
    """Send transaction to settle campaign on-chain. Returns tx hash info."""
    if not ORCHESTRATOR_PRIVATE_KEY:
        raise RuntimeError("ORCHESTRATOR_PRIVATE_KEY not set. TODO: insert orchestrator wallet private key in env (use a secure secret manager).")
    w3 = _init_client()
    contract = _load_contract(w3)

    acct = w3.eth.account.from_key(ORCHESTRATOR_PRIVATE_KEY)
    nonce = w3.eth.get_transaction_count(acct.address)
    tx = contract.functions.settleCampaign(campaign_id, roi_score).build_transaction({
        "from": acct.address,
        "nonce": nonce,
        "chainId": CHAIN_ID,
        "gas": 300000,
    })
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return {"tx_hash": tx_hash.hex(), "receipt": dict(receipt)}
