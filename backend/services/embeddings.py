import logging
import os

import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
VOYAGE_EMBEDDING_MODEL = os.getenv("VOYAGE_EMBEDDING_MODEL", "voyage-3-large")

LOCAL_DIMENSIONS = 768
VOYAGE_DIMENSIONS = 1024


def is_local() -> bool:
    """Ollama on a developer machine, Voyage once deployed, where no Ollama container runs."""
    return os.getenv("APP_ENV", "local") == "local"


def embedding_dimensions() -> int:
    """Vector width of the active provider. Must match the ObjectBox and Atlas vector indexes."""
    return LOCAL_DIMENSIONS if is_local() else VOYAGE_DIMENSIONS


async def _embed_with_ollama(client: httpx.AsyncClient, text: str) -> list[float]:
    response = await client.post(
        f"{OLLAMA_BASE_URL}/api/embed",
        json={"model": OLLAMA_EMBEDDING_MODEL, "input": text},
    )
    response.raise_for_status()
    return response.json()["embeddings"][0]


async def _embed_with_voyage(client: httpx.AsyncClient, text: str) -> list[float] | None:
    api_key = os.getenv("VOYAGE_API_KEY", "")
    if not api_key:
        logging.warning("VOYAGE_API_KEY is not set; continuing without noteEmbedding")
        return None
    response = await client.post(
        VOYAGE_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": VOYAGE_EMBEDDING_MODEL,
            "input": [text],
            "input_type": "document",
            "output_dimension": embedding_dimensions(),
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
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if is_local():
                return await _embed_with_ollama(client, text)
            return await _embed_with_voyage(client, text)
    except (httpx.HTTPError, KeyError, IndexError):
        logging.warning("Embedding request failed; continuing without noteEmbedding")
        return None
