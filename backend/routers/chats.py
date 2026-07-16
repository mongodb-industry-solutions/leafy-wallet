from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import parse_object_id, with_str_id
from schemas.chats import ChatCreate, ChatOut, ChatUpdate

COLLECTION = "chats"
MESSAGES_COLLECTION = "chatMessages"

router = APIRouter(prefix="/chats", tags=["chats"])


@router.post("", response_model=ChatOut, status_code=201)
async def create_chat(payload: ChatCreate, db: MongoDBConnector = Depends(get_db)):
    now = datetime.now(timezone.utc)
    doc = {**payload.model_dump(), "createdAt": now, "updatedAt": now}
    doc["_id"] = db.insert_one(COLLECTION, doc)
    return with_str_id(doc)


@router.get("", response_model=list[ChatOut])
async def list_chats(db: MongoDBConnector = Depends(get_db)):
    return [with_str_id(doc) for doc in db.find(COLLECTION, {})]


@router.get("/{chat_id}", response_model=ChatOut)
async def get_chat(chat_id: str, db: MongoDBConnector = Depends(get_db)):
    results = db.find(COLLECTION, {"_id": parse_object_id(chat_id)})
    if not results:
        raise HTTPException(status_code=404, detail="Chat not found")
    return with_str_id(results[0])


@router.patch("/{chat_id}", response_model=ChatOut)
async def update_chat(chat_id: str, payload: ChatUpdate, db: MongoDBConnector = Depends(get_db)):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    object_id = parse_object_id(chat_id)
    existing = db.find(COLLECTION, {"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Chat not found")

    updates["updatedAt"] = datetime.now(timezone.utc)
    db.update_one(COLLECTION, {"_id": object_id}, {"$set": updates})
    return with_str_id(db.find(COLLECTION, {"_id": object_id})[0])


@router.delete("/{chat_id}", status_code=204)
async def delete_chat(chat_id: str, db: MongoDBConnector = Depends(get_db)):
    deleted = db.delete_one(COLLECTION, {"_id": parse_object_id(chat_id)})
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")
    # Cascade: a chat's messages have no meaning without their parent.
    db.delete_many(MESSAGES_COLLECTION, {"chatId": chat_id})
