from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv

from mcp_server.server import mcp
from routers.wallet_contacts import router as wallet_contacts_router
from routers.wallet_requests import router as wallet_requests_router
from routers.wallet_transactions import router as wallet_transactions_router

load_dotenv()

# FastMCP already serves at "/mcp", so point it at "/" to avoid mounting into /mcp/mcp.
mcp.settings.streamable_http_path = "/"

# Mounted sub-apps never receive lifespan events, hence the explicit run() below. This call
# also lazily creates mcp.session_manager, so it has to happen first.
mcp_app = mcp.streamable_http_app()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with mcp.session_manager.run():
        yield


app = FastAPI(
    title="Leafy Wallet API",
    description="Backend API for Leafy Wallet",
    version="0.1.0",
    lifespan=lifespan,
)

# Open CORS so browser-based external MCP clients can reach the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wallet_contacts_router, prefix="/api/v1")
app.include_router(wallet_requests_router, prefix="/api/v1")
app.include_router(wallet_transactions_router, prefix="/api/v1")
app.mount("/mcp", mcp_app)

@app.get("/")
async def read_root():
    return {"message":"Server is running"}
