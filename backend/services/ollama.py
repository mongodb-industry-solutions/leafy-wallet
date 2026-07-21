import logging
import os

import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")


async def get_embedding(text: str) -> list[float] | None:
    """Get an embedding vector for `text` from a local Ollama instance.

    Returns None instead of raising if Ollama is unreachable, since the
    embedding only feeds semantic search and shouldn't block writing the
    underlying transaction.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/embed",
                json={"model": OLLAMA_EMBEDDING_MODEL, "input": text},
            )
            response.raise_for_status()
            return response.json()["embeddings"][0]
    except httpx.HTTPError:
        logging.warning("Ollama embedding request failed; continuing without noteEmbedding")
        return None
