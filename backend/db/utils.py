from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException


def parse_object_id(id_str: str) -> ObjectId:
    """Parse a path-param string into a Mongo ObjectId, or 404 if malformed."""
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Not found")


def with_str_id(doc: dict) -> dict:
    """Convert the Mongo ObjectId in a document's `_id` to a plain string."""
    doc["_id"] = str(doc["_id"])
    return doc
