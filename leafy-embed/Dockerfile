FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# CPU-only torch
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch>=2.6,<3"

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

ENV HF_HOME=/app/hf-cache

ARG MODEL_ID=voyageai/voyage-4-nano
ARG MODEL_REVISION=67fabc9bef010dabc5f6024aa1b1b6b93410426f

RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('${MODEL_ID}', revision='${MODEL_REVISION}')"

ENV EMBEDDING_MODEL_ID=${MODEL_ID}
ENV EMBEDDING_MODEL_REVISION=${MODEL_REVISION}

# With the snapshot already cached, refuse any further network calls to Hugging Face.
ENV HF_HUB_OFFLINE=1

COPY main.py ./

RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8091

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=120s \
    CMD curl -fsS http://localhost:8091/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8091"]
