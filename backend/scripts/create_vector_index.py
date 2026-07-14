"""Provision the Atlas Vector Search index backing GET /wallet-transactions/search.

Idempotent: safe to re-run. Requires an Atlas cluster tier that supports
Vector Search (M10+ dedicated, or Search Nodes/Serverless).

Usage: uv run python scripts/create_vector_index.py
"""

import asyncio
import time

from pymongo.operations import SearchIndexModel

from db.mdb import MongoDBConnector
from services.ollama import get_embedding

COLLECTION = "walletTransactions"
INDEX_NAME = "noteEmbedding_vector_index"


def _embedding_dimensions() -> int:
    """Derive the vector size from a live embedding call instead of a magic
    number, so the index always matches whatever OLLAMA_EMBEDDING_MODEL is
    actually configured (a hard-coded value would silently drift if the
    model changes).
    """
    vector = asyncio.run(get_embedding("dimension probe"))
    if vector is None:
        raise RuntimeError(
            "Could not reach Ollama to determine embedding dimensions; "
            "make sure Ollama is running and OLLAMA_EMBEDDING_MODEL is pulled."
        )
    return len(vector)


def main():
    db = MongoDBConnector()
    collection = db.get_collection(COLLECTION)

    index_definition = {
        "fields": [
            {
                "type": "vector",
                "path": "noteEmbedding",
                "numDimensions": _embedding_dimensions(),
                "similarity": "cosine",
            },
            {"type": "filter", "path": "ownerPartyRef"},
        ]
    }

    existing = list(collection.list_search_indexes(INDEX_NAME))
    if existing:
        print(f"Index '{INDEX_NAME}' already exists (status: {existing[0].get('status')}); "
              "updating definition in case it changed.")
        collection.update_search_index(INDEX_NAME, index_definition)
    else:
        model = SearchIndexModel(definition=index_definition, name=INDEX_NAME, type="vectorSearch")
        collection.create_search_index(model)
        print(f"Creating index '{INDEX_NAME}'...")

    for _ in range(60):
        info = list(collection.list_search_indexes(INDEX_NAME))
        if info and info[0].get("queryable"):
            print("Index is queryable.")
            return
        time.sleep(2)
    raise TimeoutError(f"Index '{INDEX_NAME}' did not become queryable in time")


if __name__ == "__main__":
    main()
