from db.utils import with_str_id

COLLECTION = "walletRequests"


def list_requests_for_requester(
    db, requester_party_ref: str, status: str | None = None
) -> list[dict]:
    """Payment requests a user has raised (their outbox), newest first.

    Only the outbox: an inbox lookup is keyed by `targetDigest`, which is derived from the
    session email and never reaches this service.
    """
    query = {"requesterPartyRef": requester_party_ref}
    if status:
        query["status"] = status
    rows = [with_str_id(doc) for doc in db.find(COLLECTION, query)]
    rows.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return rows
