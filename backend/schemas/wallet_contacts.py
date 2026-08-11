from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WalletContactOut(BaseModel):
    """Outbound shape returned to the client: the full stored document."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    ownerPartyRef: str
    counterpartyArrangementReference: str
    counterpartyLabel: str
    counterpartyLookupType: Literal["phone", "email"]
    counterpartyLookupHint: str
    createdAt: datetime
    updatedAt: datetime
