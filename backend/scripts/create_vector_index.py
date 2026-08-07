"""Provision the Atlas Vector Search index backing GET /wallet-transactions/search.

Idempotent: safe to re-run. Requires an Atlas cluster tier that supports
Vector Search (M10+ dedicated, or Search Nodes/Serverless).

Usage: uv run python scripts/create_vector_index.py
"""

import time

from pymongo.operations import SearchIndexModel

from db.mdb import MongoDBConnector
from services.embeddings import EMBEDDING_DIMENSIONS

# The index filters on `ownerPartyRef` so a search can be scoped to a single user.
COLLECTION = "walletTransactions"
INDEX_NAME = "noteEmbedding_vector_index"
EMBEDDED_FIELD = "noteEmbedding"


def _ensure_index(db, collection_name: str, index_name: str, path: str, dimensions: int):
    """Create `index_name` on `collection_name`, or update it if it exists."""
    # Atlas refuses to index a collection that does not exist yet, which is the normal state of a
    # freshly provisioned environment database.
    if collection_name not in db.db.list_collection_names():
        db.db.create_collection(collection_name)
        print(f"Created empty collection '{collection_name}'.")
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
    print(f"Indexing at {EMBEDDING_DIMENSIONS} dimensions.")

    _ensure_index(db, COLLECTION, INDEX_NAME, EMBEDDED_FIELD, EMBEDDING_DIMENSIONS)
    _wait_until_queryable(db, COLLECTION, INDEX_NAME)


if __name__ == "__main__":
    main()
