# leafy-local-store: C++ ObjectBox service with Sync
FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY local_store_service.cpp CMakeLists.txt ./

RUN cmake -DCMAKE_BUILD_TYPE=Release . && \
    cmake --build . --parallel $(nproc)

# Runtime stage
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libssl3 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/local_store_service /app/
COPY --from=builder /build/_deps/objectbox-sync-download-src/lib/libobjectbox.so /usr/local/lib/

RUN ldconfig

RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && mkdir -p /app/local-store-db \
    && chown -R appuser:appuser /app

VOLUME ["/app/local-store-db"]

USER appuser

EXPOSE 8090

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost:8090/local/v1/health || exit 1

CMD ["./local_store_service", "/app/local-store-db"]
