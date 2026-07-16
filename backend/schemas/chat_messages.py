from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreate(BaseModel):
    """Inbound payload for POST /chat-messages.

    Excludes `_id`/`createdAt`: server-generated. No `Update` schema exists
    for this resource — messages are immutable once sent.
    """

    chatId: str
    role: Literal["user", "assistant"]
    text: str


class ChatMessageOut(BaseModel):
    """Outbound shape returned to the client: the full stored document."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    chatId: str
    role: Literal["user", "assistant"]
    text: str
    createdAt: datetime
