from db.utils import with_str_id

COLLECTION = "chatMessages"


def list_chat_messages(
    db, chat_reference: str | None = None, chat_id: str | None = None
) -> list[dict]:
    """A conversation's messages, oldest first.

    Ascending order is the reading order of a conversation. Both keys reach
    the same messages: `chat_reference` is the join key shared with the
    offline store, `chat_id` the parent's Atlas `_id`.
    """
    query = {}
    if chat_reference:
        query["chatReference"] = chat_reference
    if chat_id:
        query["chatId"] = chat_id
    pipeline = [
        {"$match": query},
        {"$sort": {"createdAt": 1}},
        # Legacy documents may still carry a textEmbedding from the removed
        # chat-search feature; never return it.
        {"$project": {"textEmbedding": 0}},
    ]
    return [with_str_id(doc) for doc in db.aggregate(COLLECTION, pipeline)]
