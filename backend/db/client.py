from functools import lru_cache

from db.mdb import MongoDBConnector


@lru_cache
def get_db() -> MongoDBConnector:
    return MongoDBConnector()
