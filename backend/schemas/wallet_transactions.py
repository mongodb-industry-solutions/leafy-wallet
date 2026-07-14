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
    writes when a transaction originates offline via leafy-local-store —
    that connector has no way to produce nested fields, so the canonical
    Atlas schema was flattened to match it rather than special-casing one
    write path.

    `noteEmbedding` is absent on purpose: it's generated server-side by
    Ollama from `note` (see services/ollama.py), never supplied by the
    client. `_id`/`createdAt`/`settledAt` are also server-managed, same
    reasoning as WalletContactCreate.
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


class WalletTransactionUpdate(BaseModel):
    """Inbound payload for PATCH /wallet-transactions/{id}.

    Covers only fields that legitimately change after creation (status
    transitions, settlement time, a later-computed embedding). Identifying
    fields (`ownerPartyRef`, `amount`, `direction`, ...) are immutable and
    therefore not offered here, mirroring WalletContactUpdate.
    """

    leafyPayStatus: Literal["pending", "settled", "failed", "exception"] | None = None
    localSyncStatus: Literal["local_pending", "synced"] | None = None
    settledAt: datetime | None = None
    noteEmbedding: list[float] | None = None


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
    direction: Literal["sent", "received"]
    leafyPayStatus: Literal["pending", "settled", "failed", "exception"]
    localSyncStatus: Literal["local_pending", "synced"]
    createdAt: datetime
    settledAt: datetime | None = None

    _validate_settled_at = field_validator("settledAt", mode="before")(_none_if_epoch_zero)


class WalletTransactionSearchResult(BaseModel):
    """Outbound shape for GET /wallet-transactions/search.

    Same core fields as `WalletTransactionOut`, but omits the raw
    `noteEmbedding` vector (not useful to callers, and needlessly bloats
    a results list) and adds the vector-search relevance `score`.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    leafyPayTransferReference: str
    ownerPartyRef: str
    counterpartyArrangementReference: str
    amount: float
    currency: str
    note: str | None = None
    direction: Literal["sent", "received"]
    leafyPayStatus: Literal["pending", "settled", "failed", "exception"]
    localSyncStatus: Literal["local_pending", "synced"]
    createdAt: datetime
    settledAt: datetime | None = None
    score: float

    _validate_settled_at = field_validator("settledAt", mode="before")(_none_if_epoch_zero)
