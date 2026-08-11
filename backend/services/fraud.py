"""Velocity signals over transaction history, the analysis the device cannot do itself."""

from db.utils import with_str_id

COLLECTION = "walletTransactionsHistory"

# A burst of sends in a short span is the classic card-testing and account-takeover shape. Three is
# low for real use; it keeps the demo reachable by hand.
WINDOW_SECONDS = 600
BURST_THRESHOLD = 3


def transaction_velocity(
    db,
    owner_party_ref: str,
    window_seconds: int = WINDOW_SECONDS,
    threshold: int = BURST_THRESHOLD,
) -> list[dict]:
    """Sends whose preceding window holds at least `threshold` of them, newest first.

    `createdAt` is the clock rather than `settledAt`, which is epoch-zero on rows that never settled
    and would bucket them into 1970. Partitioning by owner keeps a window from spanning two users.
    """
    pipeline = [
        {"$match": {"ownerPartyRef": owner_party_ref, "direction": "sent"}},
        {
            "$setWindowFields": {
                "partitionBy": "$ownerPartyRef",
                "sortBy": {"createdAt": 1},
                "output": {
                    "sendsInWindow": {
                        "$count": {},
                        "window": {"range": [-window_seconds, 0], "unit": "second"},
                    },
                    "valueInWindow": {
                        "$sum": "$amount",
                        "window": {"range": [-window_seconds, 0], "unit": "second"},
                    },
                },
            }
        },
        {"$match": {"sendsInWindow": {"$gte": threshold}}},
        {"$sort": {"createdAt": -1}},
        {"$project": {"noteEmbedding": 0}},
    ]
    return [with_str_id(doc) for doc in db.aggregate(COLLECTION, pipeline)]
