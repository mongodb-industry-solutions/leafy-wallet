from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreate(BaseModel):
    """Inbound payload for POST /chat-messages.

    `chatReference` is the join key to the parent chat and works from both
    write paths; `chatId` carries the parent's Atlas `_id`.

    `textEmbedding` is absent on purpose: it's generated server-side by
    Ollama from `text` (see services/ollama.py), never supplied by the
    client — same convention as `WalletTransactionCreate.noteEmbedding`.
    `ownerPartyRef` is absent too: it's copied from the parent chat so a
    message can never be scoped to a different owner than its conversation.

    Excludes `_id`/`createdAt`: server-generated. No `Update` schema exists
    for this resource — messages are immutable once sent.
    """

    chatId: str
    chatReference: str
    role: Literal["user", "assistant"]
    text: str


class ChatMessageOut(BaseModel):
    """Outbound shape returned to the client.

    Omits the raw `textEmbedding` vector: it's not useful to callers and
    needlessly bloats a conversation's message list, same reasoning as
    `WalletTransactionSearchResult`.

    `chatId`/`chatReference`/`ownerPartyRef` are optional here but required
    in `ChatMessageCreate`: messages also reach this collection through
    ObjectBox Sync from leafy-local-store, which doesn't populate them all,
    and a stricter shape would turn reading one of those into a 500.
    `chatId` is a plain string on this write path; the offline store keys it
    by the chat's int64 `localId`.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    chatId: str | None = None
    chatReference: str | None = None
    ownerPartyRef: str | None = None
    role: Literal["user", "assistant"]
    text: str
    createdAt: datetime


class ChatMessageSearchResult(BaseModel):
    """Outbound shape for GET /chat-messages/search: a message plus its
    vector-search relevance `score`. Same optional-field reasoning as
    `ChatMessageOut`.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    chatId: str | None = None
    chatReference: str | None = None
    ownerPartyRef: str | None = None
    role: Literal["user", "assistant"]
    text: str
    createdAt: datetime
    score: float
