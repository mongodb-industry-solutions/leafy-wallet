"""End-to-end tests for the actual ObjectBox <-> Atlas sync bridge, run against
a real running stack (docker compose up -d leafy-embed objectbox-sync-server
leafy-local-store) with a reachable Atlas cluster. Local-only, not part of CI
 -  same reasoning as test_leafy_local_store.py/test_leafy_local_store_chats.py:
deploying the whole ObjectBox Sync Server + Atlas combo in CI isn't worth it
for this PoC, and skips cleanly if either side isn't reachable.

Every other test_leafy_local_store_*.py file only exercises the local HTTP
surface in isolation (write via leafy-local-store, read back via
leafy-local-store) - none of them actually prove the Sync Server bridge is
moving data to/from Atlas. That's the one thing these tests check, for every
entity that's meant to sync: walletContacts, walletTransactions, chats,
chatMessages, walletRequests. Plus one regression check the other way: LocalAccountBalance is
deliberately NOT sync-enabled (see local_store_service.cpp), so it must never
show up in Atlas no matter how long we wait.

Sync is asynchronous in both directions (ObjectBox -> Sync Server -> Atlas is
a push over the sync websocket; Atlas -> Sync Server -> ObjectBox is a Mongo
change stream), so every assertion here polls with a timeout instead of
checking immediately. 20s/0.5s was picked empirically - in practice syncing
one small document lands in well under 5s, but this leaves headroom for a
slower CI-less local machine without making a real failure take forever to
surface.
"""

import time
import uuid
from datetime import datetime, timezone

import httpx
import pytest

from db.client import get_db

LOCAL_BASE = "http://localhost:8090"
SYNC_TIMEOUT_S = 45  # generous: propagation is normally sub-second, but the full suite loads Atlas
SYNC_POLL_INTERVAL_S = 0.5


@pytest.fixture(scope="module", autouse=True)
def _require_local_store_and_atlas():
    try:
        response = httpx.get(f"{LOCAL_BASE}/local/v1/health", timeout=2.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        pytest.skip(f"leafy-local-store not reachable at {LOCAL_BASE}: {exc}")

    db = get_db()
    try:
        db.client.admin.command("ping")
    except Exception as exc:
        pytest.skip(f"MongoDB Atlas not reachable, skipping sync tests: {exc}")


@pytest.fixture
def db():
    return get_db()


def _unique(prefix):
    return f"{prefix}-{uuid.uuid4()}"


def _wait_until(predicate, description):
    """Poll `predicate` (a zero-arg callable returning a truthy match or
    None/False) until it succeeds or SYNC_TIMEOUT_S elapses. Returns whatever
    `predicate` returned. A timeout here means the sync bridge didn't do its
    job in time - that's the actual failure mode these tests exist to catch,
    not just test flakiness to paper over.
    """
    deadline = time.monotonic() + SYNC_TIMEOUT_S
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(SYNC_POLL_INTERVAL_S)
    pytest.fail(f"Timed out after {SYNC_TIMEOUT_S}s waiting for: {description}")


# ─── walletContacts ─────────────────────────────────────────────────────────


def test_contact_created_via_objectbox_syncs_to_atlas(db):
    ref = _unique("sync-contact-ob")
    created = httpx.post(
        f"{LOCAL_BASE}/local/v1/contacts",
        json={
            "ownerPartyRef": "sync-test-owner",
            "counterpartyArrangementReference": ref,
            "counterpartyLabel": "Sync Test Contact",
            "counterpartyLookupType": "email",
            "counterpartyLookupHint": "s***@example.com",
        },
    )
    assert created.status_code == 201
    local_id = created.json()["id"]

    try:
        atlas_doc = _wait_until(
            lambda: db.find("walletContacts", {"counterpartyArrangementReference": ref}),
            f"walletContacts document with counterpartyArrangementReference={ref}",
        )
        assert atlas_doc[0]["counterpartyLabel"] == "Sync Test Contact"
    finally:
        httpx.delete(f"{LOCAL_BASE}/local/v1/contacts/{local_id}")
        # Belt-and-suspenders: the delete above should also propagate through
        # Sync, but don't depend on that timing for cleanup correctness.
        db.delete_many("walletContacts", {"counterpartyArrangementReference": ref})


def test_contact_created_via_atlas_syncs_to_objectbox(db):
    ref = _unique("sync-contact-atlas")
    now = datetime.now(timezone.utc)
    db.insert_one(
        "walletContacts",
        {
            "ownerPartyRef": "sync-test-owner",
            "counterpartyArrangementReference": ref,
            "counterpartyLabel": "Atlas Origin Contact",
            "counterpartyLookupType": "email",
            "counterpartyLookupHint": "a***@example.com",
            "createdAt": now,
            "updatedAt": now,
        },
    )

    try:
        local_doc = _wait_until(
            lambda: next(
                (
                    c
                    for c in httpx.get(f"{LOCAL_BASE}/local/v1/contacts").json()
                    if c["counterpartyArrangementReference"] == ref
                ),
                None,
            ),
            f"local contact with counterpartyArrangementReference={ref}",
        )
        assert local_doc["counterpartyLabel"] == "Atlas Origin Contact"
    finally:
        db.delete_many("walletContacts", {"counterpartyArrangementReference": ref})
        if local_doc := next(
            (
                c
                for c in httpx.get(f"{LOCAL_BASE}/local/v1/contacts").json()
                if c["counterpartyArrangementReference"] == ref
            ),
            None,
        ):
            httpx.delete(f"{LOCAL_BASE}/local/v1/contacts/{local_doc['id']}")


# ─── walletTransactions ─────────────────────────────────────────────────────


def test_transaction_created_via_objectbox_syncs_to_atlas(db):
    ref = _unique("sync-tx-ob")
    created = httpx.post(
        f"{LOCAL_BASE}/local/v1/transactions/send",
        json={
            "leafyPayTransferReference": ref,
            "ownerPartyRef": "sync-test-owner",
            "counterpartyArrangementReference": "sync-test-counterparty",
            "amount": 12.34,
            "currency": "EUR",
            "direction": "sent",
            # No `note` on purpose: this test is about the sync bridge, not
            # the embedding path (covered elsewhere).
        },
    )
    assert created.status_code == 201
    local_id = created.json()["id"]

    try:
        atlas_doc = _wait_until(
            lambda: db.find("walletTransactions", {"leafyPayTransferReference": ref}),
            f"walletTransactions document with leafyPayTransferReference={ref}",
        )
        assert atlas_doc[0]["amount"] == 12.34
        assert atlas_doc[0]["currency"] == "EUR"
    finally:
        httpx.delete(f"{LOCAL_BASE}/local/v1/transactions/{local_id}")
        db.delete_many("walletTransactions", {"leafyPayTransferReference": ref})


def test_transaction_created_via_atlas_syncs_to_objectbox(db):
    ref = _unique("sync-tx-atlas")
    db.insert_one(
        "walletTransactions",
        {
            "leafyPayTransferReference": ref,
            "ownerPartyRef": "sync-test-owner",
            "counterpartyArrangementReference": "sync-test-counterparty",
            "amount": 56.78,
            "currency": "USD",
            "note": None,
            "noteEmbedding": None,
            "direction": "received",
            "leafyPayStatus": "settled",
            "localSyncStatus": "synced",
            "createdAt": datetime.now(timezone.utc),
            "settledAt": None,
        },
    )

    try:
        local_doc = _wait_until(
            lambda: next(
                (
                    t
                    for t in httpx.get(f"{LOCAL_BASE}/local/v1/transactions").json()
                    if t["leafyPayTransferReference"] == ref
                ),
                None,
            ),
            f"local transaction with leafyPayTransferReference={ref}",
        )
        assert local_doc["amount"] == 56.78
        assert local_doc["direction"] == "received"
    finally:
        db.delete_many("walletTransactions", {"leafyPayTransferReference": ref})
        if local_doc := next(
            (
                t
                for t in httpx.get(f"{LOCAL_BASE}/local/v1/transactions").json()
                if t["leafyPayTransferReference"] == ref
            ),
            None,
        ):
            httpx.delete(f"{LOCAL_BASE}/local/v1/transactions/{local_doc['id']}")


# ─── chats ──────────────────────────────────────────────────────────────────


def test_chat_created_via_objectbox_syncs_to_atlas(db):
    title = _unique("sync-chat-ob")
    created = httpx.post(f"{LOCAL_BASE}/local/v1/chats", json={"title": title})
    assert created.status_code == 201
    local_id = created.json()["id"]
    chat_reference = created.json()["chatReference"]

    try:
        # POST /local/v1/chats does two sequential ObjectBox puts (create,
        # then set localId once the id is known - see local_store_service.cpp)
        # so the Sync Server pushes two change events for this one document.
        # Polling for mere presence would flakily catch the first push, where
        # localId is still its 0 default; poll for the field's *final* value
        # instead, which is the guarantee actually worth testing here.
        atlas_doc = _wait_until(
            lambda: db.find("chats", {"title": title, "localId": local_id}),
            f"chats document with title={title} and localId={local_id}",
        )
        # localId is the field that exists specifically so this row is
        # joinable from Atlas - see backend/README.md's "Sync-related fields".
        assert atlas_doc[0]["localId"] == local_id
        # chatReference is what chatMessages join against, in either store.
        assert atlas_doc[0]["chatReference"] == chat_reference
    finally:
        httpx.delete(f"{LOCAL_BASE}/local/v1/chats/{chat_reference}")
        db.delete_many("chats", {"title": title})


def test_chat_created_via_atlas_syncs_to_objectbox(db):
    title = _unique("sync-chat-atlas")
    now = datetime.now(timezone.utc)
    # Deliberately no `localId` here: this document originates from the
    # FastAPI write path (backend/routers/chats.py), which never sets it  - 
    # only the ObjectBox->Atlas direction does. The reverse sync must still
    # work without it.
    db.insert_one("chats", {"title": title, "createdAt": now, "updatedAt": now})

    try:
        local_doc = _wait_until(
            lambda: next(
                (c for c in httpx.get(f"{LOCAL_BASE}/local/v1/chats").json() if c["title"] == title),
                None,
            ),
            f"local chat with title={title}",
        )
        assert local_doc["title"] == title
    finally:
        db.delete_many("chats", {"title": title})
        if local_doc := next(
            (c for c in httpx.get(f"{LOCAL_BASE}/local/v1/chats").json() if c["title"] == title),
            None,
        ):
            httpx.delete(f"{LOCAL_BASE}/local/v1/chats/{local_doc['chatReference']}")


# ─── chatMessages ───────────────────────────────────────────────────────────


def test_chat_message_created_via_objectbox_syncs_to_atlas(db):
    chat_title = _unique("sync-chat-for-message-ob")
    chat_reference = httpx.post(
        f"{LOCAL_BASE}/local/v1/chats", json={"title": chat_title}
    ).json()["chatReference"]
    text = _unique("sync-message-ob")

    try:
        created = httpx.post(
            f"{LOCAL_BASE}/local/v1/chats/{chat_reference}/messages",
            json={"role": "user", "text": text},
        )
        assert created.status_code == 201

        atlas_doc = _wait_until(
            lambda: db.find("chatMessages", {"text": text}),
            f"chatMessages document with text={text}",
        )
        assert atlas_doc[0]["chatReference"] == chat_reference
        assert atlas_doc[0]["role"] == "user"
    finally:
        # Cascades to the message locally; Atlas cleanup is still explicit
        # since the cascade's sync-back timing isn't something to depend on.
        httpx.delete(f"{LOCAL_BASE}/local/v1/chats/{chat_reference}")
        db.delete_many("chatMessages", {"text": text})
        db.delete_many("chats", {"title": chat_title})


def test_chat_message_created_via_atlas_syncs_to_objectbox(db):
    """A message written Atlas-side is readable offline, joined by chatReference.

    The Atlas and ObjectBox copies of a chat carry different primary keys, so
    chatReference - the same string in both stores - is the only key that
    makes a message written by one path visible to the other.
    """
    chat_reference = httpx.post(
        f"{LOCAL_BASE}/local/v1/chats", json={"title": _unique("sync-chat-for-message-atlas")}
    ).json()["chatReference"]
    text = _unique("sync-message-atlas")

    try:
        db.insert_one(
            "chatMessages",
            {
                "chatReference": chat_reference,
                "role": "assistant",
                "text": text,
                "createdAt": datetime.now(timezone.utc),
            },
        )

        local_doc = _wait_until(
            lambda: next(
                (
                    m
                    for m in httpx.get(
                        f"{LOCAL_BASE}/local/v1/chats/{chat_reference}/messages"
                    ).json()
                    if m["text"] == text
                ),
                None,
            ),
            f"local chat message with text={text}",
        )
        assert local_doc["role"] == "assistant"
    finally:
        db.delete_many("chatMessages", {"text": text})
        httpx.delete(f"{LOCAL_BASE}/local/v1/chats/{chat_reference}")


# ─── walletRequests ─────────────────────────────────────────────────────────


def test_request_composed_offline_syncs_to_atlas(db):
    ref = _unique("sync-request-ob")
    created = httpx.post(
        f"{LOCAL_BASE}/local/v1/requests",
        json={
            "requestReference": ref,
            "requesterPartyRef": "sync-test-requester",
            "requesterName": "Sync Test Requester",
            "payerCounterpartyRef": "sync-test-arrangement",
            "amount": 25.5,
            "currency": "EUR",
            # No `note`: this is about the sync bridge, not the embedding path.
        },
    )
    assert created.status_code == 201
    local_id = created.json()["id"]

    try:
        atlas_doc = _wait_until(
            lambda: db.find("walletRequests", {"requestReference": ref}),
            f"walletRequests document with requestReference={ref}",
        )
        assert atlas_doc[0]["amount"] == 25.5
        assert atlas_doc[0]["localSyncStatus"] == "local_pending"
    finally:
        httpx.delete(f"{LOCAL_BASE}/local/v1/requests/{local_id}")
        db.delete_many("walletRequests", {"requestReference": ref})


def test_incoming_request_written_to_atlas_reaches_the_offline_inbox(db):
    """The leg the notification bell depends on when the connection drops.

    The device's inbox filters on payerPartyRef, so that field surviving the trip is what decides
    whether a request someone else raised is still visible offline.
    """
    ref = _unique("sync-request-atlas")
    payer = _unique("sync-test-payer")
    db.insert_one(
        "walletRequests",
        {
            "requestReference": ref,
            "requesterPartyRef": "sync-test-requester",
            "requesterName": "Atlas Origin Requester",
            "payerPartyRef": payer,
            "payerCounterpartyRef": "",
            "amount": 40.0,
            "currency": "EUR",
            "note": None,
            "status": "presented",
            "localSyncStatus": "synced",
            "leafyPayTransferReference": None,
            "createdAt": datetime.now(timezone.utc),
            "resolvedAt": None,
        },
    )

    local_doc = None
    try:
        local_doc = _wait_until(
            lambda: next(
                (
                    r
                    for r in httpx.get(
                        f"{LOCAL_BASE}/local/v1/requests", params={"payerPartyRef": payer}
                    ).json()
                    if r["requestReference"] == ref
                ),
                None,
            ),
            f"local request with requestReference={ref} in the inbox of payerPartyRef={payer}",
        )
        assert local_doc["amount"] == 40.0
        assert local_doc["status"] == "presented"
        assert local_doc["requesterName"] == "Atlas Origin Requester"
    finally:
        db.delete_many("walletRequests", {"requestReference": ref})
        if local_doc:
            httpx.delete(f"{LOCAL_BASE}/local/v1/requests/{local_doc['id']}")


# ─── LocalAccountBalance (regression: must NEVER sync) ─────────────────────


def test_account_balance_never_syncs_to_atlas(db):
    ref = _unique("sync-account-must-not-sync")
    created = httpx.put(
        f"{LOCAL_BASE}/local/v1/accounts/{ref}",
        json={"ownerPartyRef": "sync-test-owner", "label": "No Sync Account", "currency": "EUR", "balanceValue": 1.0},
    )
    assert created.status_code == 201

    try:
        # There's no "success" predicate to poll for here - the whole point
        # is that nothing ever shows up. Sleep the same duration the other
        # tests poll for, then assert absence once, rather than polling for a
        # positive that should never happen.
        time.sleep(SYNC_TIMEOUT_S)
        assert db.find("LocalAccountBalance", {"accountReference": ref}) == []
    finally:
        httpx.delete(f"{LOCAL_BASE}/local/v1/accounts/{ref}")
