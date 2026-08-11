/**
 * Atlas Database Trigger on walletTransactions: insert, update and replace, Full Document on.
 * Paste as the function body; the Atlas UI is otherwise the only copy of it. Edit the service name to match your Atlas cluster.
 */

exports = async function (changeEvent) {
  const doc = changeEvent.fullDocument;
  if (!doc) return;

  const reference = doc.leafyPayTransferReference;
  const owner = doc.ownerPartyRef;
  if (!reference || !owner) return;

  // An offline send's stand-in reference is discarded by the reconnect replay.
  if (reference.startsWith("local-")) return;

  const history = context.services
    .get("IST-Shared")
    .db("leafy-wallet")
    .collection("walletTransactionsHistory");

  // ObjectBox Sync re-inserts a device-created object under a new id, so _id is not stable.
  const { _id, ...fields } = doc;

  // Both fields: a transfer between two users yields one row per side, sharing a reference.
  await history.updateOne(
    { leafyPayTransferReference: reference, ownerPartyRef: owner },
    { $set: { ...fields, historyUpdatedAt: new Date() } },
    { upsert: true }
  );
};
