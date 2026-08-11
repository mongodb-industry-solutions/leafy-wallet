"""Provision the Atlas indexes behind hybrid transaction search.

All three live on `walletTransactionsHistory`, the Atlas-only collection the Trigger in
atlas_trigger_transaction_history.js populates. Offline search uses ObjectBox's own HNSW index
instead, which the device builds itself.

Idempotent. Requires a cluster tier that supports Vector Search (M10+, or Search Nodes/Serverless).

Usage: uv run python scripts/create_vector_index.py
"""

import time

from pymongo import ASCENDING
from pymongo.errors import OperationFailure
from pymongo.operations import SearchIndexModel

from db.mdb import MongoDBConnector
from services.embeddings import EMBEDDING_DIMENSIONS

COLLECTION = "walletTransactionsHistory"
EMBEDDED_FIELD = "noteEmbedding"
VECTOR_INDEX_NAME = "history_noteEmbedding_vector_index"
TEXT_INDEX_NAME = "history_note_text_index"
KEY_INDEX_NAME = "transfer_owner_unique"


def _upsert_search_index(db, index_name: str, definition: dict, index_type: str):
    """Create or update a search index, creating the collection first if Atlas needs it to exist."""
    if COLLECTION not in db.db.list_collection_names():
        db.db.create_collection(COLLECTION)
        print(f"Created empty collection '{COLLECTION}'.")
    collection = db.get_collection(COLLECTION)

    existing = list(collection.list_search_indexes(index_name))
    if existing:
        print(f"Index '{index_name}' exists (status: {existing[0].get('status')}); updating definition.")
        collection.update_search_index(index_name, definition)
    else:
        collection.create_search_index(
            SearchIndexModel(definition=definition, name=index_name, type=index_type)
        )
        print(f"Creating index '{index_name}'...")


def _ensure_vector_index(db):
    """Quantized because history grows without bound; `createdAt` filters a search to a date range."""
    _upsert_search_index(
        db,
        VECTOR_INDEX_NAME,
        {
            "fields": [
                {
                    "type": "vector",
                    "path": EMBEDDED_FIELD,
                    "numDimensions": EMBEDDING_DIMENSIONS,
                    "similarity": "cosine",
                    "quantization": "scalar",
                },
                {"type": "filter", "path": "ownerPartyRef"},
                {"type": "filter", "path": "createdAt"},
            ]
        },
        "vectorSearch",
    )


def _ensure_text_index(db):
    """`ownerPartyRef` is a token so each $rankFusion branch can scope itself before the fusion."""
    _upsert_search_index(
        db,
        TEXT_INDEX_NAME,
        {
            "mappings": {
                "dynamic": False,
                "fields": {
                    "note": {"type": "string"},
                    "ownerPartyRef": {"type": "token"},
                },
            }
        },
        "search",
    )


def _ensure_key_index(db):
    """The pair the Trigger upserts on, so racing invocations cannot duplicate a row."""
    try:
        db.get_collection(COLLECTION).create_index(
            [("leafyPayTransferReference", ASCENDING), ("ownerPartyRef", ASCENDING)],
            name=KEY_INDEX_NAME,
            unique=True,
        )
        print(f"Ensured unique index '{KEY_INDEX_NAME}'.")
    except OperationFailure as exc:
        print(f"Could not create '{KEY_INDEX_NAME}': {exc}")


def _wait_until_queryable(db, index_name: str):
    collection = db.get_collection(COLLECTION)
    for _ in range(60):
        info = list(collection.list_search_indexes(index_name))
        if info and info[0].get("queryable"):
            print(f"Index '{index_name}' is queryable.")
            return
        time.sleep(2)
    raise TimeoutError(f"Index '{index_name}' did not become queryable in time")


def main():
    db = MongoDBConnector()
    print(f"Indexing '{COLLECTION}' at {EMBEDDING_DIMENSIONS} dimensions.")

    _ensure_vector_index(db)
    _ensure_text_index(db)
    _ensure_key_index(db)

    _wait_until_queryable(db, VECTOR_INDEX_NAME)
    _wait_until_queryable(db, TEXT_INDEX_NAME)


if __name__ == "__main__":
    main()
