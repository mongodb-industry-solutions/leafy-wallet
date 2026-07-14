"""Provision the Atlas Vector Search index backing GET /wallet-transactions/search.

Idempotent: safe to re-run. Requires an Atlas cluster tier that supports
Vector Search (M10+ dedicated, or Search Nodes/Serverless).

Usage: uv run python scripts/create_vector_index.py
"""

import time

from pymongo.operations import SearchIndexModel

from db.mdb import MongoDBConnector

COLLECTION = "walletTransactions"
INDEX_NAME = "noteEmbedding_vector_index"
INDEX_DEFINITION = {
    "fields": [
        {
            "type": "vector",
            "path": "noteEmbedding",
            "numDimensions": 768,
            "similarity": "cosine",
        },
        {"type": "filter", "path": "ownerPartyRef"},
    ]
}


def main():
    db = MongoDBConnector()
    collection = db.get_collection(COLLECTION)

    existing = list(collection.list_search_indexes(INDEX_NAME))
    if existing:
        print(f"Index '{INDEX_NAME}' already exists (status: {existing[0].get('status')}); "
              "updating definition in case it changed.")
        collection.update_search_index(INDEX_NAME, INDEX_DEFINITION)
    else:
        model = SearchIndexModel(definition=INDEX_DEFINITION, name=INDEX_NAME, type="vectorSearch")
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
