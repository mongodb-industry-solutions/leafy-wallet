from mcp.server.fastmcp import FastMCP

from db.client import get_db
from services import contacts as contacts_service
from services import requests as requests_service
from services import transactions as transactions_service

# Read-only over Atlas. Balances and transfers live in Leafy Pay, which this service holds no
# credentials for — a tool that "sends money" here could only write a record, not move any.
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


@mcp.tool(name="get_spending_by_contact")
def _get_spending_by_contact_tool(owner_party_ref: str, direction: str = "sent") -> list[dict]:
    """Total amount the user sent to (or received from) each contact, largest first.

    Use for aggregate questions like "where did my money go", "who do I send the most money to",
    or "how much have I sent Luis in total". Returns the totals already computed — prefer it over
    listing transactions and adding them up. Pass direction="received" for money coming in.
    """
    db = get_db()
    rows = transactions_service.spending_by_contact(db, owner_party_ref, direction)
    labels = {
        c["counterpartyArrangementReference"]: c["counterpartyLabel"]
        for c in contacts_service.list_contacts(db, owner_party_ref)
    }
    for row in rows:
        row["contact"] = labels.get(row["counterpartyArrangementReference"], "Leafy Pay user")
    return rows


@mcp.tool(name="list_transactions")
def _list_transactions_tool(
    owner_party_ref: str, direction: str | None = None, limit: int = 50
) -> list[dict]:
    """List the user's transactions, newest first, optionally filtered by direction.

    Use when the question is about recent activity rather than meaning ("what did I do last week",
    "show my payments"). For questions about what a payment was *for*, use search_transactions.
    """
    return transactions_service.list_transactions(get_db(), owner_party_ref, direction, limit=limit)


@mcp.tool(name="get_requests")
def _get_requests_tool(owner_party_ref: str, status: str | None = None) -> list[dict]:
    """List payment requests the user has raised, optionally filtered by status.

    Use for questions like "who owes me money" or "what have I asked people to pay".
    Statuses: pending, paid, declined, cancelled.
    """
    return requests_service.list_requests_for_requester(get_db(), owner_party_ref, status)
