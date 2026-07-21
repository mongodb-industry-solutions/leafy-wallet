import logging
import os

import httpx

# Ollama on a developer machine, Voyage once deployed. Deployments run no Ollama container, and the
# two models have different vector widths, so each environment keeps its own Atlas database.
APP_ENV = os.getenv("APP_ENV", "local")
IS_LOCAL = APP_ENV == "local"

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
VOYAGE_EMBEDDING_MODEL = os.getenv("VOYAGE_EMBEDDING_MODEL", "voyage-4-lite")
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY", "")

# Vector width of the active provider. Must match the ObjectBox HNSW index and the Atlas index.
EMBEDDING_DIMENSIONS = 768 if IS_LOCAL else 1024


async def _embed_with_ollama(client: httpx.AsyncClient, text: str) -> list[float]:
    response = await client.post(
        f"{OLLAMA_BASE_URL}/api/embed",
        json={"model": OLLAMA_EMBEDDING_MODEL, "input": text},
    )
    response.raise_for_status()
    return response.json()["embeddings"][0]


async def _embed_with_voyage(client: httpx.AsyncClient, text: str) -> list[float]:
    response = await client.post(
        VOYAGE_URL,
        headers={"Authorization": f"Bearer {VOYAGE_API_KEY}"},
        json={
            "model": VOYAGE_EMBEDDING_MODEL,
            "input": [text],
            "input_type": "document",
            "output_dimension": EMBEDDING_DIMENSIONS,
        },
    )
    response.raise_for_status()
    return response.json()["data"][0]["embedding"]


async def get_embedding(text: str) -> list[float] | None:
    """Get an embedding vector for `text` from the environment's embedding provider.

    Returns None instead of raising if the provider is unreachable, since the
    embedding only feeds semantic search and shouldn't block writing the
    underlying transaction.
    """
    if not IS_LOCAL and not VOYAGE_API_KEY:
        logging.warning("VOYAGE_API_KEY is not set; continuing without noteEmbedding")
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if IS_LOCAL:
                return await _embed_with_ollama(client, text)
            return await _embed_with_voyage(client, text)
    except (httpx.HTTPError, KeyError, IndexError):
        logging.warning("Embedding request failed; continuing without noteEmbedding")
        return None
