"""Serve voyage-4-nano behind Voyage's own /v1/embeddings contract."""

import os

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_ID = os.getenv("EMBEDDING_MODEL_ID", "voyageai/voyage-4-nano")

MODEL_REVISION = os.getenv("EMBEDDING_MODEL_REVISION", "67fabc9bef010dabc5f6024aa1b1b6b93410426f")

EMBEDDING_DIMENSIONS = 1024

app = FastAPI(title="leafy-embed")

model = SentenceTransformer(MODEL_ID, revision=MODEL_REVISION, trust_remote_code=True)


class EmbeddingsRequest(BaseModel):
    input: list[str]
    input_type: str = "document"


@app.get("/health")
def health():
    """Report readiness. The model loads at import, so a served response means it is loaded."""
    return {"status": "ok", "model": MODEL_ID, "revision": MODEL_REVISION}


@app.post("/v1/embeddings")
def create_embeddings(request: EmbeddingsRequest):
    """Embed one or more strings, shaped like the hosted Voyage response."""
    vectors = model.encode(request.input, prompt_name=request.input_type, convert_to_numpy=True)

    # The model normalizes its full 2048-wide output, so a truncated prefix needs renormalizing.
    truncated = vectors[:, :EMBEDDING_DIMENSIONS]
    normalized = truncated / np.linalg.norm(truncated, axis=1, keepdims=True)

    return {
        "object": "list",
        "model": MODEL_ID,
        "data": [
            {"object": "embedding", "index": index, "embedding": vector.tolist()}
            for index, vector in enumerate(normalized)
        ],
    }
