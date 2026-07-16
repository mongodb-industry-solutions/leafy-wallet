from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RequestStatus = Literal["pending", "paid", "declined", "cancelled"]


class WalletRequestCreate(BaseModel):
    """Inbound payload for POST /wallet-requests.

    Requester and target are identified by `*Digest`, a keyed HMAC of the normalized email
    derived in the frontend (`lib/wallet/digest.js`). The raw email never reaches this service.

    Excludes `requestReference`/`status`/`createdAt`: server-generated, so a client can neither
    spoof a reference nor create an already-paid request.
    """

    requesterPartyRef: str
    requesterName: str
    requesterDigest: str
    targetDigest: str
    amount: float = Field(gt=0)
    currency: str = "EUR"
    note: str | None = None


class WalletRequestUpdate(BaseModel):
    """Inbound payload for PATCH /wallet-requests/{id}.

    Only the resolution is mutable: amount, target, and requester are fixed at creation. The
    router stamps `resolvedAt` when `status` moves to a terminal value.
    """

    status: RequestStatus | None = None
    leafyPayTransferReference: str | None = None


class WalletRequestOut(BaseModel):
    """Outbound shape: the full stored document, including the server-managed fields."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    requestReference: str
    requesterPartyRef: str
    requesterName: str
    requesterDigest: str
    targetDigest: str
    amount: float
    currency: str
    note: str | None = None
    status: RequestStatus
    leafyPayTransferReference: str | None = None
    createdAt: datetime
    resolvedAt: datetime | None = None
