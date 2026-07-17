from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import with_str_id
from schemas.chat_messages import ChatMessageCreate, ChatMessageOut
from services.chat_messages import list_chat_messages as list_chat_messages_service

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
