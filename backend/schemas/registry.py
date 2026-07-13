from schemas.wallet_contacts import WalletContactOut
from schemas.wallet_transactions import WalletTransactionOut

# Maps each Mongo collection to its canonical `Out` schema: the shape of the
# document as actually stored, not the narrower Create/Update input schemas.
SCHEMA_REGISTRY: dict[str, type] = {
    "walletContacts": WalletContactOut,
    "walletTransactions": WalletTransactionOut,
}


def get_schema(collection_name: str) -> type:
    """Return the canonical Pydantic schema for a Mongo collection."""
    try:
        return SCHEMA_REGISTRY[collection_name]
    except KeyError:
        raise ValueError(f"No schema registered for collection '{collection_name}'")
