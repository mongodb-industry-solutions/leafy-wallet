"""Provision the Atlas Vector Search index backing GET /wallet-transactions/search.

Idempotent: safe to re-run. Requires an Atlas cluster tier that supports
Vector Search (M10+ dedicated, or Search Nodes/Serverless).

Usage: uv run python scripts/create_vector_index.py
"""

import asyncio
import time

from pymongo.operations import SearchIndexModel

from db.mdb import MongoDBConnector
from services.embeddings import get_embedding

# (collection, index name, embedded field). The index filters on
# `ownerPartyRef` so a search can be scoped to a single user.
INDEX_SPECS = [
    ("walletTransactions", "noteEmbedding_vector_index", "noteEmbedding"),
]


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


def _ensure_index(db, collection_name: str, index_name: str, path: str, dimensions: int):
    """Create `index_name` on `collection_name`, or update it if it exists."""
    collection = db.get_collection(collection_name)
    index_definition = {
        "fields": [
            {
                "type": "vector",
                "path": path,
                "numDimensions": dimensions,
                "similarity": "cosine",
            },
            {"type": "filter", "path": "ownerPartyRef"},
        ]
    }

    existing = list(collection.list_search_indexes(index_name))
    if existing:
        print(f"Index '{index_name}' already exists (status: {existing[0].get('status')}); "
              "updating definition in case it changed.")
        collection.update_search_index(index_name, index_definition)
    else:
        model = SearchIndexModel(definition=index_definition, name=index_name, type="vectorSearch")
        collection.create_search_index(model)
        print(f"Creating index '{index_name}'...")


def _wait_until_queryable(db, collection_name: str, index_name: str):
    collection = db.get_collection(collection_name)
    for _ in range(60):
        info = list(collection.list_search_indexes(index_name))
        if info and info[0].get("queryable"):
            print(f"Index '{index_name}' is queryable.")
            return
        time.sleep(2)
    raise TimeoutError(f"Index '{index_name}' did not become queryable in time")


def main():
    db = MongoDBConnector()
    dimensions = _embedding_dimensions()

    for collection_name, index_name, path in INDEX_SPECS:
        _ensure_index(db, collection_name, index_name, path, dimensions)
    # Waiting only after every index is requested lets Atlas build them in parallel.
    for collection_name, index_name, _ in INDEX_SPECS:
        _wait_until_queryable(db, collection_name, index_name)


if __name__ == "__main__":
    main()
