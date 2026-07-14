from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
