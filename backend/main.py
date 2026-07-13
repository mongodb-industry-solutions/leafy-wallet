from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv

from routers.wallet_contacts import router as wallet_contacts_router
from routers.wallet_transactions import router as wallet_transactions_router

load_dotenv()

app = FastAPI(
    title="Leafy Wallet API",
    description="Backend API for Leafy Wallet",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wallet_contacts_router, prefix="/api/v1")
app.include_router(wallet_transactions_router, prefix="/api/v1")

@app.get("/")
async def read_root(request: Request):
    return {"message":"Server is running"}