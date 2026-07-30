from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import parse_object_id, with_str_id
from schemas.chats import ChatCreate, ChatOut

COLLECTION = "chats"
MESSAGES_COLLECTION = "chatMessages"

router = APIRouter(prefix="/chats", tags=["chats"])


@router.post("", response_model=ChatOut, status_code=201)
async def create_chat(payload: ChatCreate, db: MongoDBConnector = Depends(get_db)):
    now = datetime.now(timezone.utc)
    doc = {
        **payload.model_dump(),
        "chatReference": str(uuid4()),
        "createdAt": now,
        "updatedAt": now,
    }
    doc["_id"] = db.insert_one(COLLECTION, doc)
    return with_str_id(doc)


@router.get("", response_model=list[ChatOut])
async def list_chats(ownerPartyRef: str | None = None, db: MongoDBConnector = Depends(get_db)):
    query = {"ownerPartyRef": ownerPartyRef} if ownerPartyRef else {}
    return [with_str_id(doc) for doc in db.find(COLLECTION, query)]


@router.delete("/{chat_id}", status_code=204)
async def delete_chat(chat_id: str, db: MongoDBConnector = Depends(get_db)):
    deleted = db.find_one_and_delete(COLLECTION, {"_id": parse_object_id(chat_id)})
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Cascade: a chat's messages have no meaning without their parent. Matches
    # on either join key, since a message may carry only one of the two.
    message_filters = [{"chatId": chat_id}]
    chat_reference = deleted.get("chatReference")
    if chat_reference:
        message_filters.append({"chatReference": chat_reference})
    db.delete_many(MESSAGES_COLLECTION, {"$or": message_filters})
