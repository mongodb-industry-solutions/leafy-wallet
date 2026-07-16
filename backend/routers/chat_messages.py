from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import parse_object_id, with_str_id
from schemas.chat_messages import ChatMessageCreate, ChatMessageOut

COLLECTION = "chatMessages"
CHATS_COLLECTION = "chats"

router = APIRouter(prefix="/chat-messages", tags=["chat-messages"])


@router.post("", response_model=ChatMessageOut, status_code=201)
async def create_chat_message(payload: ChatMessageCreate, db: MongoDBConnector = Depends(get_db)):
    if not db.find(CHATS_COLLECTION, {"_id": parse_object_id(payload.chatId)}):
        raise HTTPException(status_code=404, detail="Chat not found")

    doc = {**payload.model_dump(), "createdAt": datetime.now(timezone.utc)}
    doc["_id"] = db.insert_one(COLLECTION, doc)
    return with_str_id(doc)


@router.get("", response_model=list[ChatMessageOut])
async def list_chat_messages(chatId: str | None = None, db: MongoDBConnector = Depends(get_db)):
    query = {"chatId": chatId} if chatId else {}
    return [with_str_id(doc) for doc in db.find(COLLECTION, query)]


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
