import logging
import os

import httpx

EMBEDDINGS_URL = os.getenv("EMBEDDINGS_URL", "http://localhost:8091")
EMBEDDING_MODEL = os.getenv("VOYAGE_EMBEDDING_MODEL", "voyage-4-large")

EMBEDDING_DIMENSIONS = 1024


async def get_embedding(text: str, input_type: str = "document") -> list[float] | None:
    """Get an embedding vector for `text` from the environment's embedding provider.

    Pass input_type="query" for search queries; Voyage embeds queries and stored text
    asymmetrically. Returns None rather than raising when the provider is unreachable, so a
    failed embedding doesn't block writing the underlying transaction.
    """
    api_key = os.getenv("VOYAGE_API_KEY", "")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{EMBEDDINGS_URL}/v1/embeddings",
                headers=headers,
                json={
                    "model": EMBEDDING_MODEL,
                    "input": [text],
                    "input_type": input_type,
                    "output_dimension": EMBEDDING_DIMENSIONS,
                },
            )
            response.raise_for_status()
            return response.json()["data"][0]["embedding"]
    except (httpx.HTTPError, KeyError, IndexError):
        logging.warning("Embedding request failed; continuing without noteEmbedding")
        return None
