from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Leafy Pay's request lifecycle, stored verbatim: this is a replica, so a status it does not
# recognize would mean the wallet invented one. `lib/wallet/requests.js` collapses these for the UI.
RequestStatus = Literal[
    "draft",
    "created",
    "validated",
    "presented",
    "delivered",
    "viewed",
    "accepted",
    "rejected",
    "cancelled",
    "expired",
    "payment_initiated",
    "payment_processing",
    "payment_settled",
    "payment_failed",
    "reversed",
    "disputed",
]

# `local_pending` marks a request composed with no connection: it exists here and on the phone but
# not yet in Leafy Pay, and the app replays it on reconnect.
LocalSyncStatus = Literal["synced", "local_pending"]


class WalletRequestUpsert(BaseModel):
    """Inbound payload for POST /wallet-requests.

    Leafy Pay owns requests; this is the offline replica. Writes are upserts keyed by
    `requestReference` so re-reading a request converges instead of duplicating it.
    """

    requestReference: str
    requesterPartyRef: str
    requesterName: str
    payerPartyRef: str = ""
    payerCounterpartyRef: str = ""
    amount: float = Field(gt=0)
    currency: str = "EUR"
    note: str | None = None
    status: RequestStatus
    localSyncStatus: LocalSyncStatus = "synced"
    leafyPayTransferReference: str | None = None
    createdAt: datetime | None = None
    resolvedAt: datetime | None = None


class WalletRequestOut(BaseModel):
    """Outbound shape: the full stored replica document."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    requestReference: str
    requesterPartyRef: str
    requesterName: str
    payerPartyRef: str
    payerCounterpartyRef: str
    amount: float
    currency: str
    note: str | None = None
    status: RequestStatus
    localSyncStatus: LocalSyncStatus
    leafyPayTransferReference: str | None = None
    createdAt: datetime
    resolvedAt: datetime | None = None
