from mcp.server.fastmcp import FastMCP

from db.client import get_db
from services import contacts as contacts_service
from services import transactions as transactions_service

mcp = FastMCP("leafy-wallet")


@mcp.tool(name="search_transactions")
async def _search_transactions_tool(q: str, owner_party_ref: str, limit: int = 10) -> list[dict]:
    """Semantically search the user's past transactions by meaning, not exact text match.

    Use for spending questions like "how much did I spend on restaurants" or
    "find the coffee shop payment" — this searches transaction notes by meaning,
    so it doesn't need the exact words used in the note.
    """
    return await transactions_service.search_transactions(get_db(), q, owner_party_ref, limit)


@mcp.tool(name="get_contacts")
def _get_contacts_tool(owner_party_ref: str, q: str | None = None) -> list[dict]:
    """Look up the user's saved contacts (beneficiaries), optionally filtered by name.

    Use for questions like "what's Maria's contact info" or "who are my contacts".
    Omit `q` to list every saved contact.
    """
    return contacts_service.list_contacts(get_db(), owner_party_ref, q)
