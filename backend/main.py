from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv

from mcp_server.server import mcp
from routers.chat_messages import router as chat_messages_router
from routers.chats import router as chats_router
from routers.wallet_contacts import router as wallet_contacts_router
from routers.wallet_requests import router as wallet_requests_router
from routers.wallet_transactions import router as wallet_transactions_router

load_dotenv()

# FastMCP's streamable_http_app() registers its own internal route at
# "/mcp" by default - mounting that whole app at app.mount("/mcp", ...) would
# double up into /mcp/mcp. Point its internal path at "/" so the mount below
# lands on exactly /mcp.
mcp.settings.streamable_http_path = "/"

# Mounting FastMCP's ASGI app doesn't automatically run its own `lifespan`
# (uvicorn only sends lifespan events to the outermost app, not to mounted
# sub-apps) - without this, the MCP session manager never starts and every
# request to /mcp would fail. Calling streamable_http_app() also lazily
# creates `mcp.session_manager`, so it must happen before referencing it here.
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wallet_contacts_router, prefix="/api/v1")
app.include_router(wallet_requests_router, prefix="/api/v1")
app.include_router(wallet_transactions_router, prefix="/api/v1")
app.include_router(chats_router, prefix="/api/v1")
app.include_router(chat_messages_router, prefix="/api/v1")
app.mount("/mcp", mcp_app)

@app.get("/")
async def read_root():
    return {"message":"Server is running"}
