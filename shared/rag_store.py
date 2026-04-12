from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

import chromadb

_REPO_ROOT = Path(__file__).resolve().parents[1]
_RAG_DIR = _REPO_ROOT / "data" / "rag"
_COLLECTION_NAME = "campaign_results"
_EMBED_DIM = 256
_COLLECTION_LOCK = Lock()

_RAG_DIR.mkdir(parents=True, exist_ok=True)
_client = chromadb.PersistentClient(path=str(_RAG_DIR))
_collection = _client.get_or_create_collection(name=_COLLECTION_NAME)


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _embed_text(text: str) -> list[float]:
    vector = [0.0] * _EMBED_DIM
    tokens = _tokenize(text)
    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % _EMBED_DIM
        weight = 1.0 + (digest[4] / 255.0)
        vector[index] += weight

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def _safe_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _build_document(campaign_id: str, agent_id: str, content: str, performance_score: float) -> str:
    return _safe_json(
        {
            "campaign_id": campaign_id,
            "agent_id": agent_id,
            "content": content,
            "performance_score": performance_score,
        }
    )


def store_campaign_result(campaign_id: str, agent_id: str, content: Any, performance_score: float) -> None:
    content_text = content if isinstance(content, str) else _safe_json(content)
    metadata = {
        "campaign_id": campaign_id,
        "agent_id": agent_id,
        "performance_score": float(performance_score),
        "created_at": datetime.utcnow().isoformat(),
    }
    document = _build_document(campaign_id, agent_id, content_text, float(performance_score))
    embedding = _embed_text(f"{agent_id} {content_text}")
    record_id = f"{campaign_id}:{agent_id}"

    with _COLLECTION_LOCK:
        _collection.upsert(
            ids=[record_id],
            documents=[document],
            embeddings=[embedding],
            metadatas=[metadata],
        )


def retrieve_relevant(agent_id: str, query: str, top_k: int = 3) -> list[dict[str, Any]]:
    embedding = _embed_text(f"{agent_id} {query}")
    with _COLLECTION_LOCK:
        results = _collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            where={"agent_id": agent_id},
        )

    documents = (results or {}).get("documents", [[]])
    metadatas = (results or {}).get("metadatas", [[]])
    distances = (results or {}).get("distances", [[]])
    output: list[dict[str, Any]] = []

    for index, document in enumerate(documents[0] if documents else []):
        metadata = metadatas[0][index] if metadatas and metadatas[0] else {}
        distance = distances[0][index] if distances and distances[0] else None
        try:
            parsed_document = json.loads(document)
        except Exception:
            parsed_document = {"content": document}
        output.append(
            {
                "campaign_id": metadata.get("campaign_id", parsed_document.get("campaign_id")),
                "agent_id": metadata.get("agent_id", agent_id),
                "content": parsed_document.get("content", document),
                "performance_score": metadata.get("performance_score", parsed_document.get("performance_score", 0.0)),
                "distance": distance,
            }
        )

    return output
