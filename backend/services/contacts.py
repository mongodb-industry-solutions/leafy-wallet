import re

from db.utils import with_str_id

COLLECTION = "walletContacts"


def list_contacts(db, owner_party_ref: str | None = None, q: str | None = None) -> list[dict]:
    """List (optionally filtered) contacts.

    Shared by `routers/wallet_contacts.py`'s `GET` route and the `get_contacts`
    MCP tool - one query, two callers. `q` case-insensitively substring-matches
    `counterpartyLabel`.
    """
    query = {}
    if owner_party_ref:
        query["ownerPartyRef"] = owner_party_ref
    if q:
        query["counterpartyLabel"] = {"$regex": re.escape(q), "$options": "i"}
    return [with_str_id(doc) for doc in db.find(COLLECTION, query)]
