from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _none_if_epoch_zero(value):
    """leafy-local-store writes an "absent" settledAt as epoch-zero (there's
    no other way to represent "unset" for a fixed-width timestamp property),
    which the Sync Server's MongoDB bridge then stores as a literal
    1970-01-01 rather than an omitted field. Without this, reading such a
    transaction back here would show a fake settlement time instead of None.
    Handles both raw ints (older synced documents, before the field was a
    proper ObjectBox Date type) and real datetimes (current documents).
    """
    if value == 0:
        return None
    if isinstance(value, datetime) and value == _EPOCH:
        return None
    return value


class WalletTransactionCreate(BaseModel):
    """Inbound payload for POST /wallet-transactions.

    `amount`/`currency` are flat (not a nested `amount: {value, currency}`
    sub-document) to match the shape ObjectBox's MongoDB Sync Server bridge
    writes when a transaction originates offline via leafy-local-store  - 
    that connector has no way to produce nested fields, so the canonical
    Atlas schema was flattened to match it rather than special-casing one
    write path.

    `noteEmbedding` is absent on purpose: it's generated server-side by
    the embedding provider from `note` (see services/embeddings.py), never supplied by the
    client. `_id`/`settledAt` are also server-managed, same reasoning as
    WalletContactCreate.

    `createdAt` is optional rather than server-managed: a payment adopted from
    Leafy Pay happened before this row was written, and stamping it with the
    write time would sort it wrongly offline (the device reads this field,
    while online reads Leafy Pay's own). Omit it for a payment made here and
    now, which is what the default covers.
    """

    leafyPayTransferReference: str
    ownerPartyRef: str
    counterpartyArrangementReference: str
    amount: float
    currency: str
    note: str | None = Field(default=None, max_length=140)
    direction: Literal["sent", "received"]
    leafyPayStatus: Literal["pending", "settled", "failed", "exception"] = "pending"
    localSyncStatus: Literal["local_pending", "synced"] = "synced"
    createdAt: datetime | None = None


class WalletTransactionUpdate(BaseModel):
    """Inbound payload for PATCH /wallet-transactions/{id}.

    Covers only what legitimately changes after creation: the status transition and
    its settlement time. Identifying fields (`ownerPartyRef`, `amount`, `direction`,
    ...) are immutable and therefore not offered here.
    """

    leafyPayStatus: Literal["pending", "settled", "failed", "exception"] | None = None
    settledAt: datetime | None = None


class WalletTransactionOut(BaseModel):
    """Outbound shape returned to the client: the full stored document,
    including the server-managed fields that never appear in `Create`/`Update`.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    leafyPayTransferReference: str
    ownerPartyRef: str
    counterpartyArrangementReference: str
    amount: float
    currency: str
    note: str | None = None
    noteEmbedding: list[float] | None = None
    # Width of the stored vector (0 when there is none). The list route projects the vector itself
    # away, so this is how a caller can tell an embedded row from an un-embedded one.
    noteEmbeddingDims: int = 0
    direction: Literal["sent", "received"]
    leafyPayStatus: Literal["pending", "settled", "failed", "exception"]
    localSyncStatus: Literal["local_pending", "synced"]
    createdAt: datetime
    settledAt: datetime | None = None

    _validate_settled_at = field_validator("settledAt", mode="before")(_none_if_epoch_zero)


class SpendingByContact(BaseModel):
    """Outbound shape for GET /wallet-transactions/summary: one row per counterparty.

    Carries the arrangement reference rather than a name - Atlas holds the alias, and the caller
    already resolves those for every other view.
    """

    counterpartyArrangementReference: str
    total: float
    count: int
    currency: str
    lastAt: datetime | None = None


class WalletTransactionSearchResult(WalletTransactionOut):
    """Outbound shape for GET /wallet-transactions/search.

    The stored document plus the vector-search relevance `score`. The search
    pipeline projects `noteEmbedding` away (not useful to callers, and it
    needlessly bloats a results list), so it serializes as null here.
    """

    score: float
