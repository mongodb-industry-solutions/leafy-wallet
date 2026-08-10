"""Provision the Atlas Vector Search indexes backing transaction search.

Covers `walletTransactions` and `walletTransactionsHistory`, the latter
populated by the Trigger in atlas_trigger_transaction_history.js.

Usage: uv run python scripts/create_vector_index.py
"""

import time

from pymongo import ASCENDING
from pymongo.errors import OperationFailure
from pymongo.operations import SearchIndexModel

from db.mdb import MongoDBConnector
from services.embeddings import EMBEDDING_DIMENSIONS

COLLECTION = "walletTransactions"
INDEX_NAME = "noteEmbedding_vector_index"
EMBEDDED_FIELD = "noteEmbedding"

HISTORY_COLLECTION = "walletTransactionsHistory"
HISTORY_INDEX_NAME = "history_noteEmbedding_vector_index"
HISTORY_KEY_INDEX_NAME = "transfer_owner_unique"


def _ensure_index(
    db,
    collection_name: str,
    index_name: str,
    path: str,
    dimensions: int,
    extra_filters: tuple[str, ...] = (),
    quantization: str | None = None,
):
    """Create `index_name` on `collection_name`, or update it if it exists."""
    if collection_name not in db.db.list_collection_names():
        db.db.create_collection(collection_name)
        print(f"Created empty collection '{collection_name}'.")
    collection = db.get_collection(collection_name)
    vector_field = {
        "type": "vector",
        "path": path,
        "numDimensions": dimensions,
        "similarity": "cosine",
    }
    if quantization:
        vector_field["quantization"] = quantization
    index_definition = {
        "fields": [
            vector_field,
            {"type": "filter", "path": "ownerPartyRef"},
            *({"type": "filter", "path": field} for field in extra_filters),
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


def _ensure_history_key_index(db):
    """Enforce the pair the Trigger upserts on, so racing invocations can't duplicate a row."""
    collection = db.get_collection(HISTORY_COLLECTION)
    try:
        collection.create_index(
            [("leafyPayTransferReference", ASCENDING), ("ownerPartyRef", ASCENDING)],
            name=HISTORY_KEY_INDEX_NAME,
            unique=True,
        )
        print(f"Ensured unique index '{HISTORY_KEY_INDEX_NAME}' on '{HISTORY_COLLECTION}'.")
    except OperationFailure as exc:
        print(f"Could not create '{HISTORY_KEY_INDEX_NAME}': {exc}")


def main():
    db = MongoDBConnector()
    print(f"Indexing at {EMBEDDING_DIMENSIONS} dimensions.")

    _ensure_index(db, COLLECTION, INDEX_NAME, EMBEDDED_FIELD, EMBEDDING_DIMENSIONS)

    _ensure_index(
        db,
        HISTORY_COLLECTION,
        HISTORY_INDEX_NAME,
        EMBEDDED_FIELD,
        EMBEDDING_DIMENSIONS,
        extra_filters=("createdAt",),
        quantization="scalar",
    )
    _ensure_history_key_index(db)

    _wait_until_queryable(db, COLLECTION, INDEX_NAME)
    _wait_until_queryable(db, HISTORY_COLLECTION, HISTORY_INDEX_NAME)


if __name__ == "__main__":
    main()
