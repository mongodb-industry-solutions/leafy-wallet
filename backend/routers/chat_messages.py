from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import parse_object_id, with_str_id
from schemas.chat_messages import ChatMessageCreate, ChatMessageOut, ChatMessageSearchResult
from services.chat_messages import list_chat_messages as list_chat_messages_service
from services.chat_messages import search_chat_messages as search_chat_messages_service
from services.ollama import get_embedding
from services.transactions import SemanticSearchUnavailable

COLLECTION = "chatMessages"
CHATS_COLLECTION = "chats"

router = APIRouter(prefix="/chat-messages", tags=["chat-messages"])


@router.post("", response_model=ChatMessageOut, status_code=201)
async def create_chat_message(payload: ChatMessageCreate, db: MongoDBConnector = Depends(get_db)):
    parent = db.find(CHATS_COLLECTION, {"chatReference": payload.chatReference})
    if not parent:
        raise HTTPException(status_code=404, detail="Chat not found")

    doc = {
        **payload.model_dump(),
        # Copied from the parent so a message is never scoped to a different
        # owner than its conversation. Absent on chats synced in from
        # leafy-local-store, which has no owner to attribute them to.
        "ownerPartyRef": parent[0].get("ownerPartyRef"),
        "textEmbedding": await get_embedding(payload.text),
        "createdAt": datetime.now(timezone.utc),
    }
    doc["_id"] = db.insert_one(COLLECTION, doc)
    return with_str_id(doc)


@router.get("", response_model=list[ChatMessageOut])
async def list_chat_messages(
    chatReference: str | None = None,
    chatId: str | None = None,
    db: MongoDBConnector = Depends(get_db),
):
    return list_chat_messages_service(db, chatReference, chatId)


@router.get("/search", response_model=list[ChatMessageSearchResult])
async def search_chat_messages(
    q: str,
    ownerPartyRef: str | None = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: MongoDBConnector = Depends(get_db),
):
    """Semantic search over chat message text via Atlas Vector Search.

    Requires the `textEmbedding_vector_index` index (see
    scripts/create_vector_index.py) to already exist on `chatMessages`.
    """
    try:
        return await search_chat_messages_service(db, q, ownerPartyRef, limit)
    except SemanticSearchUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/{message_id}", response_model=ChatMessageOut)
async def get_chat_message(message_id: str, db: MongoDBConnector = Depends(get_db)):
    results = db.find(COLLECTION, {"_id": parse_object_id(message_id)})
    if not results:
        raise HTTPException(status_code=404, detail="Chat message not found")
    return with_str_id(results[0])


@router.delete("/{message_id}", status_code=204)
async def delete_chat_message(message_id: str, db: MongoDBConnector = Depends(get_db)):
    deleted = db.delete_one(COLLECTION, {"_id": parse_object_id(message_id)})
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat message not found")
