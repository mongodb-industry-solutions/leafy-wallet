/**
 * leafy-local-store: on-device ObjectBox store + HTTP API for offline wallet
 * transactions and contacts, syncing to Atlas via objectbox-sync-server.
 * Mirrors the voice-car-assistant-v2 reference's search-service pattern
 * (same libraries, same programmatic-model approach).
 */

#define OBX_CPP_FILE

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <chrono>
#include <iostream>
#include <map>
#include <memory>
#include <random>
#include <string>
#include <vector>

#include "objectbox.hpp"
#include "objectbox-sync.hpp"

#include "httplib.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// ─── Entity ──────────────────────────────────────────────────────────────
// Mirrors backend/schemas/wallet_transactions.py's WalletTransactionCreate/Out,
// flattened for ObjectBox (no nested `amount` sub-document).

struct LocalTransaction {
    int64_t id = 0;
    std::string leafyPayTransferReference;
    std::string ownerPartyRef;
    std::string counterpartyArrangementReference;
    double amount = 0;
    std::string currency;
    std::string note;                    // empty = absent
    std::vector<float> noteEmbedding;     // HNSW cosine; width is EMBEDDING_DIMENSIONS, which follows the provider.
    std::string direction;
    std::string leafyPayStatus;
    std::string localSyncStatus;
    int64_t createdAt = 0;                // epoch millis
    int64_t settledAt = 0;                // 0 = absent

    struct _OBX_MetaInfo {
        static constexpr obx_schema_id entityId() { return 1; }

        static void setObjectId(LocalTransaction& object, obx_id newId) { object.id = newId; }

        static void toFlatBuffer(flatbuffers::FlatBufferBuilder& fbb, const LocalTransaction& object) {
            fbb.Clear();
            auto offsetRef = fbb.CreateString(object.leafyPayTransferReference);
            auto offsetOwner = fbb.CreateString(object.ownerPartyRef);
            auto offsetCounterparty = fbb.CreateString(object.counterpartyArrangementReference);
            auto offsetCurrency = fbb.CreateString(object.currency);
            auto offsetNote = fbb.CreateString(object.note);
            auto offsetEmbedding = fbb.CreateVector(object.noteEmbedding);
            auto offsetDirection = fbb.CreateString(object.direction);
            auto offsetLeafyPayStatus = fbb.CreateString(object.leafyPayStatus);
            auto offsetLocalSyncStatus = fbb.CreateString(object.localSyncStatus);

            flatbuffers::uoffset_t fbStart = fbb.StartTable();
            fbb.AddElement(4, object.id);                       // 1: id
            fbb.AddOffset(6, offsetRef);                         // 2: leafyPayTransferReference
            fbb.AddOffset(8, offsetOwner);                       // 3: ownerPartyRef
            fbb.AddOffset(10, offsetCounterparty);               // 4: counterpartyArrangementReference
            fbb.AddElement(12, object.amount);                   // 5: amount
            fbb.AddOffset(14, offsetCurrency);                   // 6: currency
            fbb.AddOffset(16, offsetNote);                       // 7: note
            fbb.AddOffset(18, offsetEmbedding);                  // 8: noteEmbedding
            fbb.AddOffset(20, offsetDirection);                  // 9: direction
            fbb.AddOffset(22, offsetLeafyPayStatus);             // 10: leafyPayStatus
            fbb.AddOffset(24, offsetLocalSyncStatus);            // 11: localSyncStatus
            fbb.AddElement(26, object.createdAt);                // 12: createdAt
            fbb.AddElement(28, object.settledAt);                // 13: settledAt

            flatbuffers::Offset<flatbuffers::Table> offset;
            offset.o = fbb.EndTable(fbStart);
            fbb.Finish(offset);
        }

        static void fromFlatBuffer(const void* data, size_t, LocalTransaction& out) {
            const auto* table = flatbuffers::GetRoot<flatbuffers::Table>(data);
            assert(table);

            auto readString = [&](uint16_t offset, std::string& target) {
                auto* ptr = table->GetPointer<const flatbuffers::String*>(offset);
                target = ptr ? std::string(ptr->c_str(), ptr->size()) : std::string();
            };

            out.id = table->GetField<int64_t>(4, 0);
            readString(6, out.leafyPayTransferReference);
            readString(8, out.ownerPartyRef);
            readString(10, out.counterpartyArrangementReference);
            out.amount = table->GetField<double>(12, 0);
            readString(14, out.currency);
            readString(16, out.note);
            {
                auto* ptr = table->GetPointer<const flatbuffers::Vector<float>*>(18);
                out.noteEmbedding = ptr ? std::vector<float>(ptr->begin(), ptr->end()) : std::vector<float>();
            }
            readString(20, out.direction);
            readString(22, out.leafyPayStatus);
            readString(24, out.localSyncStatus);
            out.createdAt = table->GetField<int64_t>(26, 0);
            out.settledAt = table->GetField<int64_t>(28, 0);
        }

        static LocalTransaction fromFlatBuffer(const void* data, size_t size) {
            LocalTransaction object;
            fromFlatBuffer(data, size, object);
            return object;
        }

        static std::unique_ptr<LocalTransaction> newFromFlatBuffer(const void* data, size_t size) {
            auto object = std::make_unique<LocalTransaction>();
            fromFlatBuffer(data, size, *object);
            return object;
        }
    };
};

// Mirrors backend/schemas/wallet_contacts.py's WalletContactCreate/Out. Every
// field there is required (no nullable timestamps), so this entity has none
// of LocalTransaction's epoch-zero-as-null sentinel concerns.

struct LocalContact {
    int64_t id = 0;
    std::string ownerPartyRef;
    std::string counterpartyArrangementReference;
    std::string counterpartyLabel;
    std::string counterpartyLookupType;
    std::string counterpartyLookupHint;
    int64_t createdAt = 0;   // epoch millis
    int64_t updatedAt = 0;   // epoch millis
    // Blind index of the contact's email; empty for contacts saved by phone.

    struct _OBX_MetaInfo {
        static constexpr obx_schema_id entityId() { return 2; }

        static void setObjectId(LocalContact& object, obx_id newId) { object.id = newId; }

        static void toFlatBuffer(flatbuffers::FlatBufferBuilder& fbb, const LocalContact& object) {
            fbb.Clear();
            auto offsetOwner = fbb.CreateString(object.ownerPartyRef);
            auto offsetCounterparty = fbb.CreateString(object.counterpartyArrangementReference);
            auto offsetLabel = fbb.CreateString(object.counterpartyLabel);
            auto offsetLookupType = fbb.CreateString(object.counterpartyLookupType);
            auto offsetLookupHint = fbb.CreateString(object.counterpartyLookupHint);

            flatbuffers::uoffset_t fbStart = fbb.StartTable();
            fbb.AddElement(4, object.id);                  // 1: id
            fbb.AddOffset(6, offsetOwner);                  // 2: ownerPartyRef
            fbb.AddOffset(8, offsetCounterparty);           // 3: counterpartyArrangementReference
            fbb.AddOffset(10, offsetLabel);                 // 4: counterpartyLabel
            fbb.AddOffset(12, offsetLookupType);            // 5: counterpartyLookupType
            fbb.AddOffset(14, offsetLookupHint);            // 6: counterpartyLookupHint
            fbb.AddElement(16, object.createdAt);           // 7: createdAt
            fbb.AddElement(18, object.updatedAt);           // 8: updatedAt

            flatbuffers::Offset<flatbuffers::Table> offset;
            offset.o = fbb.EndTable(fbStart);
            fbb.Finish(offset);
        }

        static void fromFlatBuffer(const void* data, size_t, LocalContact& out) {
            const auto* table = flatbuffers::GetRoot<flatbuffers::Table>(data);
            assert(table);

            auto readString = [&](uint16_t offset, std::string& target) {
                auto* ptr = table->GetPointer<const flatbuffers::String*>(offset);
                target = ptr ? std::string(ptr->c_str(), ptr->size()) : std::string();
            };

            out.id = table->GetField<int64_t>(4, 0);
            readString(6, out.ownerPartyRef);
            readString(8, out.counterpartyArrangementReference);
            readString(10, out.counterpartyLabel);
            readString(12, out.counterpartyLookupType);
            readString(14, out.counterpartyLookupHint);
            out.createdAt = table->GetField<int64_t>(16, 0);
            out.updatedAt = table->GetField<int64_t>(18, 0);
        }

        static LocalContact fromFlatBuffer(const void* data, size_t size) {
            LocalContact object;
            fromFlatBuffer(data, size, object);
            return object;
        }

        static std::unique_ptr<LocalContact> newFromFlatBuffer(const void* data, size_t size) {
            auto object = std::make_unique<LocalContact>();
            fromFlatBuffer(data, size, *object);
            return object;
        }
    };
};

// A conversation. Messages live in the separate LocalChatMessage entity
// (ObjectBox has no nested/array attributes), linked by chatReference.

struct LocalChat {
    int64_t id = 0;
    std::string title;
    int64_t createdAt = 0;   // epoch millis
    int64_t updatedAt = 0;   // epoch millis
    // Mirrors `id` once it's assigned, but as a *non-PK* field. ObjectBox's
    // Sync Server drops the PK `id` when bridging to Mongo (Mongo assigns its
    // own `_id` instead). Set right after `id` is assigned by the first `put()`.
    int64_t localId = 0;
    std::string ownerPartyRef;
    // Store-independent join key (a uuid), minted by whichever write path
    // creates the chat. The Atlas `_id` and the ObjectBox `id` differ for the
    // same conversation, so this is what LocalChatMessage joins against.
    std::string chatReference;

    struct _OBX_MetaInfo {
        static constexpr obx_schema_id entityId() { return 3; }

        static void setObjectId(LocalChat& object, obx_id newId) { object.id = newId; }

        static void toFlatBuffer(flatbuffers::FlatBufferBuilder& fbb, const LocalChat& object) {
            fbb.Clear();
            auto offsetTitle = fbb.CreateString(object.title);
            auto offsetOwner = fbb.CreateString(object.ownerPartyRef);
            auto offsetChatReference = fbb.CreateString(object.chatReference);

            flatbuffers::uoffset_t fbStart = fbb.StartTable();
            fbb.AddElement(4, object.id);                  // 1: id
            fbb.AddOffset(6, offsetTitle);                  // 2: title
            fbb.AddElement(8, object.createdAt);            // 3: createdAt
            fbb.AddElement(10, object.updatedAt);           // 4: updatedAt
            fbb.AddElement(14, object.localId);             // 6: localId
            fbb.AddOffset(16, offsetOwner);                 // 7: ownerPartyRef
            fbb.AddOffset(18, offsetChatReference);         // 8: chatReference

            flatbuffers::Offset<flatbuffers::Table> offset;
            offset.o = fbb.EndTable(fbStart);
            fbb.Finish(offset);
        }

        static void fromFlatBuffer(const void* data, size_t, LocalChat& out) {
            const auto* table = flatbuffers::GetRoot<flatbuffers::Table>(data);
            assert(table);

            auto readString = [&](uint16_t offset, std::string& target) {
                auto* ptr = table->GetPointer<const flatbuffers::String*>(offset);
                target = ptr ? std::string(ptr->c_str(), ptr->size()) : std::string();
            };

            out.id = table->GetField<int64_t>(4, 0);
            readString(6, out.title);
            out.createdAt = table->GetField<int64_t>(8, 0);
            out.updatedAt = table->GetField<int64_t>(10, 0);
            out.localId = table->GetField<int64_t>(14, 0);
            readString(16, out.ownerPartyRef);
            readString(18, out.chatReference);
        }

        static LocalChat fromFlatBuffer(const void* data, size_t size) {
            LocalChat object;
            fromFlatBuffer(data, size, object);
            return object;
        }

        static std::unique_ptr<LocalChat> newFromFlatBuffer(const void* data, size_t size) {
            auto object = std::make_unique<LocalChat>();
            fromFlatBuffer(data, size, *object);
            return object;
        }
    };
};

// A single message within a LocalChat conversation. `role` mirrors the
// frontend's message shape ("user" | "assistant").

struct LocalChatMessage {
    int64_t id = 0;
    std::string role;
    std::string text;
    int64_t createdAt = 0;   // epoch millis
    std::string chatReference;   // joins to LocalChat::chatReference

    struct _OBX_MetaInfo {
        static constexpr obx_schema_id entityId() { return 4; }

        static void setObjectId(LocalChatMessage& object, obx_id newId) { object.id = newId; }

        static void toFlatBuffer(flatbuffers::FlatBufferBuilder& fbb, const LocalChatMessage& object) {
            fbb.Clear();
            auto offsetRole = fbb.CreateString(object.role);
            auto offsetText = fbb.CreateString(object.text);
            auto offsetChatReference = fbb.CreateString(object.chatReference);

            flatbuffers::uoffset_t fbStart = fbb.StartTable();
            fbb.AddElement(4, object.id);                  // 1: id
            fbb.AddOffset(8, offsetRole);                   // 3: role
            fbb.AddOffset(10, offsetText);                  // 4: text
            fbb.AddElement(12, object.createdAt);           // 5: createdAt
            fbb.AddOffset(16, offsetChatReference);         // 7: chatReference

            flatbuffers::Offset<flatbuffers::Table> offset;
            offset.o = fbb.EndTable(fbStart);
            fbb.Finish(offset);
        }

        static void fromFlatBuffer(const void* data, size_t, LocalChatMessage& out) {
            const auto* table = flatbuffers::GetRoot<flatbuffers::Table>(data);
            assert(table);

            auto readString = [&](uint16_t offset, std::string& target) {
                auto* ptr = table->GetPointer<const flatbuffers::String*>(offset);
                target = ptr ? std::string(ptr->c_str(), ptr->size()) : std::string();
            };

            out.id = table->GetField<int64_t>(4, 0);
            readString(8, out.role);
            readString(10, out.text);
            out.createdAt = table->GetField<int64_t>(12, 0);
            readString(16, out.chatReference);
        }

        static LocalChatMessage fromFlatBuffer(const void* data, size_t size) {
            LocalChatMessage object;
            fromFlatBuffer(data, size, object);
            return object;
        }

        static std::unique_ptr<LocalChatMessage> newFromFlatBuffer(const void* data, size_t size) {
            auto object = std::make_unique<LocalChatMessage>();
            fromFlatBuffer(data, size, *object);
            return object;
        }
    };
};

// Last-known balance per account, purely local - deliberately NOT
// SYNC_ENABLED (see create_obx_model()). A balance is derived/non-authoritative
// data (Leafy Pay owns the real value, re-fetched live whenever online), not a
// source-of-truth record like a transaction or contact, so it doesn't get a
// Sync Server / Atlas copy the way those do. One row per account (a user can
// have more than one), upserted in place by accountReference rather than
// accumulating like an event log.

struct LocalAccountBalance {
    int64_t id = 0;
    std::string ownerPartyRef;
    std::string accountReference;
    std::string label;
    std::string currency;
    double balanceValue = 0;
    std::string maskedIban;   // empty = absent
    bool isDefault = false;
    int64_t lastRefreshedAt = 0;   // epoch millis

    struct _OBX_MetaInfo {
        static constexpr obx_schema_id entityId() { return 5; }

        static void setObjectId(LocalAccountBalance& object, obx_id newId) { object.id = newId; }

        static void toFlatBuffer(flatbuffers::FlatBufferBuilder& fbb, const LocalAccountBalance& object) {
            fbb.Clear();
            auto offsetOwner = fbb.CreateString(object.ownerPartyRef);
            auto offsetAccountRef = fbb.CreateString(object.accountReference);
            auto offsetLabel = fbb.CreateString(object.label);
            auto offsetCurrency = fbb.CreateString(object.currency);
            auto offsetMaskedIban = fbb.CreateString(object.maskedIban);

            flatbuffers::uoffset_t fbStart = fbb.StartTable();
            fbb.AddElement(4, object.id);                        // 1: id
            fbb.AddOffset(6, offsetOwner);                        // 2: ownerPartyRef
            fbb.AddOffset(8, offsetAccountRef);                   // 3: accountReference
            fbb.AddOffset(10, offsetLabel);                       // 4: label
            fbb.AddOffset(12, offsetCurrency);                    // 5: currency
            fbb.AddElement(14, object.balanceValue);              // 6: balanceValue
            fbb.AddOffset(16, offsetMaskedIban);                  // 7: maskedIban
            fbb.AddElement<uint8_t>(18, object.isDefault, false); // 8: isDefault
            fbb.AddElement(20, object.lastRefreshedAt);           // 9: lastRefreshedAt

            flatbuffers::Offset<flatbuffers::Table> offset;
            offset.o = fbb.EndTable(fbStart);
            fbb.Finish(offset);
        }

        static void fromFlatBuffer(const void* data, size_t, LocalAccountBalance& out) {
            const auto* table = flatbuffers::GetRoot<flatbuffers::Table>(data);
            assert(table);

            auto readString = [&](uint16_t offset, std::string& target) {
                auto* ptr = table->GetPointer<const flatbuffers::String*>(offset);
                target = ptr ? std::string(ptr->c_str(), ptr->size()) : std::string();
            };

            out.id = table->GetField<int64_t>(4, 0);
            readString(6, out.ownerPartyRef);
            readString(8, out.accountReference);
            readString(10, out.label);
            readString(12, out.currency);
            out.balanceValue = table->GetField<double>(14, 0);
            readString(16, out.maskedIban);
            out.isDefault = table->GetField<uint8_t>(18, 0) != 0;
            out.lastRefreshedAt = table->GetField<int64_t>(20, 0);
        }

        static LocalAccountBalance fromFlatBuffer(const void* data, size_t size) {
            LocalAccountBalance object;
            fromFlatBuffer(data, size, object);
            return object;
        }

        static std::unique_ptr<LocalAccountBalance> newFromFlatBuffer(const void* data, size_t size) {
            auto object = std::make_unique<LocalAccountBalance>();
            fromFlatBuffer(data, size, *object);
            return object;
        }
    };
};

// Mirrors backend/schemas/wallet_requests.py. Leafy Pay owns requests; this is the offline replica.
// One composed with no connection is stored local_pending and replayed on reconnect, like a send.

struct LocalRequest {
    int64_t id = 0;
    std::string requestReference;
    std::string requesterPartyRef;
    std::string requesterName;
    std::string localSyncStatus;             // synced | local_pending
    std::string payerPartyRef;               // empty until Leafy Pay resolves the payer
    double amount = 0;
    std::string currency;
    std::string note;                        // empty = absent
    std::string status;                      // Leafy Pay's RTP lifecycle status, verbatim
    std::string leafyPayTransferReference;   // empty = absent (set when the payer approves)
    int64_t createdAt = 0;                   // epoch millis
    int64_t resolvedAt = 0;                  // 0 = absent
    std::string payerCounterpartyRef;        // the requester's saved contact for the payer

    struct _OBX_MetaInfo {
        static constexpr obx_schema_id entityId() { return 6; }

        static void setObjectId(LocalRequest& object, obx_id newId) { object.id = newId; }

        static void toFlatBuffer(flatbuffers::FlatBufferBuilder& fbb, const LocalRequest& object) {
            fbb.Clear();
            auto offsetReference = fbb.CreateString(object.requestReference);
            auto offsetRequesterParty = fbb.CreateString(object.requesterPartyRef);
            auto offsetRequesterName = fbb.CreateString(object.requesterName);
            auto offsetLocalSyncStatus = fbb.CreateString(object.localSyncStatus);
            auto offsetPayerParty = fbb.CreateString(object.payerPartyRef);
            auto offsetCurrency = fbb.CreateString(object.currency);
            auto offsetNote = fbb.CreateString(object.note);
            auto offsetStatus = fbb.CreateString(object.status);
            auto offsetTransferRef = fbb.CreateString(object.leafyPayTransferReference);
            auto offsetPayerCounterparty = fbb.CreateString(object.payerCounterpartyRef);

            flatbuffers::uoffset_t fbStart = fbb.StartTable();
            fbb.AddElement(4, object.id);                  // 1: id
            fbb.AddOffset(6, offsetReference);              // 2: requestReference
            fbb.AddOffset(8, offsetRequesterParty);         // 3: requesterPartyRef
            fbb.AddOffset(10, offsetRequesterName);         // 4: requesterName
            fbb.AddOffset(12, offsetLocalSyncStatus);       // 5: localSyncStatus
            fbb.AddOffset(14, offsetPayerParty);            // 6: payerPartyRef
            fbb.AddElement(16, object.amount);              // 7: amount
            fbb.AddOffset(18, offsetCurrency);              // 8: currency
            fbb.AddOffset(20, offsetNote);                  // 9: note
            fbb.AddOffset(22, offsetStatus);                // 10: status
            fbb.AddOffset(24, offsetTransferRef);           // 11: leafyPayTransferReference
            fbb.AddElement(26, object.createdAt);           // 12: createdAt
            fbb.AddElement(28, object.resolvedAt);          // 13: resolvedAt
            fbb.AddOffset(32, offsetPayerCounterparty);     // 15: payerCounterpartyRef

            flatbuffers::Offset<flatbuffers::Table> offset;
            offset.o = fbb.EndTable(fbStart);
            fbb.Finish(offset);
        }

        static void fromFlatBuffer(const void* data, size_t, LocalRequest& out) {
            const auto* table = flatbuffers::GetRoot<flatbuffers::Table>(data);
            assert(table);

            auto readString = [&](uint16_t offset, std::string& target) {
                auto* ptr = table->GetPointer<const flatbuffers::String*>(offset);
                target = ptr ? std::string(ptr->c_str(), ptr->size()) : std::string();
            };

            out.id = table->GetField<int64_t>(4, 0);
            readString(6, out.requestReference);
            readString(8, out.requesterPartyRef);
            readString(10, out.requesterName);
            readString(12, out.localSyncStatus);
            readString(14, out.payerPartyRef);
            out.amount = table->GetField<double>(16, 0);
            readString(18, out.currency);
            readString(20, out.note);
            readString(22, out.status);
            readString(24, out.leafyPayTransferReference);
            out.createdAt = table->GetField<int64_t>(26, 0);
            out.resolvedAt = table->GetField<int64_t>(28, 0);
            readString(32, out.payerCounterpartyRef);
        }

        static LocalRequest fromFlatBuffer(const void* data, size_t size) {
            LocalRequest object;
            fromFlatBuffer(data, size, object);
            return object;
        }

        static std::unique_ptr<LocalRequest> newFromFlatBuffer(const void* data, size_t size) {
            auto object = std::make_unique<LocalRequest>();
            fromFlatBuffer(data, size, *object);
            return object;
        }
    };
};

// Query helpers. The schema itself comes from create_obx_model() below, so only the
// properties a query actually filters on need one here; ids must match that model.
struct LocalTransaction_ {
    static const obx::Property<LocalTransaction, OBXPropertyType_FloatVector> noteEmbedding;
};
const obx::Property<LocalTransaction, OBXPropertyType_FloatVector> LocalTransaction_::noteEmbedding(8);

struct LocalChat_ {
    static const obx::Property<LocalChat, OBXPropertyType_String> chatReference;
};
const obx::Property<LocalChat, OBXPropertyType_String> LocalChat_::chatReference(8);

struct LocalChatMessage_ {
    static const obx::Property<LocalChatMessage, OBXPropertyType_String> chatReference;
};
const obx::Property<LocalChatMessage, OBXPropertyType_String> LocalChatMessage_::chatReference(7);

struct LocalAccountBalance_ {
    static const obx::Property<LocalAccountBalance, OBXPropertyType_String> accountReference;
};
const obx::Property<LocalAccountBalance, OBXPropertyType_String> LocalAccountBalance_::accountReference(3);

// ─── Embedding provider ─────────────────────────────────────────────────
// Ollama on a developer machine, Voyage once deployed, since no Ollama container is
// deployed. The two models have different vector widths, so each environment keeps
// its own Atlas database and its own on-device store.

std::string env_or(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return value ? std::string(value) : fallback;
}

const bool IS_LOCAL = env_or("APP_ENV", "local") == "local";

// ─── Model - must match objectbox-sync-server/objectbox-model.json exactly ─

const int EMBEDDING_DIMENSIONS = IS_LOCAL ? 768 : 1024;

OBX_model* create_obx_model() {
    OBX_model* model = obx_model();

    // Entity name doubles as the target MongoDB collection name in the Sync
    // Server's bridge (confirmed empirically) - this is now pointed at the
    // real walletTransactions collection the FastAPI backend also uses.
    obx_model_entity(model, "walletTransactions", 1, 7001000000000000ULL);
    obx_model_entity_flags(model, OBXEntityFlags_SYNC_ENABLED);

    obx_model_property(model, "id", OBXPropertyType_Long, 1, 7001000000000001ULL);
    obx_model_property_flags(model, OBXPropertyFlags_ID);

    obx_model_property(model, "leafyPayTransferReference", OBXPropertyType_String, 2, 7001000000000002ULL);
    obx_model_property(model, "ownerPartyRef", OBXPropertyType_String, 3, 7001000000000003ULL);
    obx_model_property(model, "counterpartyArrangementReference", OBXPropertyType_String, 4, 7001000000000004ULL);
    obx_model_property(model, "amount", OBXPropertyType_Double, 5, 7001000000000005ULL);
    obx_model_property(model, "currency", OBXPropertyType_String, 6, 7001000000000006ULL);
    obx_model_property(model, "note", OBXPropertyType_String, 7, 7001000000000007ULL);

    obx_model_property(model, "noteEmbedding", OBXPropertyType_FloatVector, 8, 7001000000000008ULL);
    obx_model_property_flags(model, OBXPropertyFlags_INDEXED);
    obx_model_property_index_hnsw_dimensions(model, EMBEDDING_DIMENSIONS);
    obx_model_property_index_hnsw_distance_type(model, OBXVectorDistanceType_Cosine);
    obx_model_property_index_id(model, 1, 7001000000000100ULL);

    obx_model_property(model, "direction", OBXPropertyType_String, 9, 7001000000000009ULL);
    obx_model_property(model, "leafyPayStatus", OBXPropertyType_String, 10, 7001000000000010ULL);
    obx_model_property(model, "localSyncStatus", OBXPropertyType_String, 11, 7001000000000011ULL);
    obx_model_property(model, "createdAt", OBXPropertyType_Date, 12, 7001000000000012ULL);
    obx_model_property(model, "settledAt", OBXPropertyType_Date, 13, 7001000000000013ULL);
    obx_model_entity_last_property_id(model, 14, 7001000000000014ULL);

    // Entity 2: walletContacts - entity name is the target MongoDB collection
    // name, same rule as entity 1 above.
    obx_model_entity(model, "walletContacts", 2, 7002000000000000ULL);
    obx_model_entity_flags(model, OBXEntityFlags_SYNC_ENABLED);

    obx_model_property(model, "id", OBXPropertyType_Long, 1, 7002000000000001ULL);
    obx_model_property_flags(model, OBXPropertyFlags_ID);

    obx_model_property(model, "ownerPartyRef", OBXPropertyType_String, 2, 7002000000000002ULL);
    obx_model_property(model, "counterpartyArrangementReference", OBXPropertyType_String, 3, 7002000000000003ULL);
    obx_model_property(model, "counterpartyLabel", OBXPropertyType_String, 4, 7002000000000004ULL);
    obx_model_property(model, "counterpartyLookupType", OBXPropertyType_String, 5, 7002000000000005ULL);
    obx_model_property(model, "counterpartyLookupHint", OBXPropertyType_String, 6, 7002000000000006ULL);
    obx_model_property(model, "createdAt", OBXPropertyType_Date, 7, 7002000000000007ULL);
    obx_model_property(model, "updatedAt", OBXPropertyType_Date, 8, 7002000000000008ULL);
    obx_model_entity_last_property_id(model, 10, 7002000000000010ULL);

    // Entity 3: chats - a conversation. Entity name is the target MongoDB
    // collection name, same rule as entities 1-2 above.
    obx_model_entity(model, "chats", 3, 7003000000000000ULL);
    obx_model_entity_flags(model, OBXEntityFlags_SYNC_ENABLED);

    obx_model_property(model, "id", OBXPropertyType_Long, 1, 7003000000000001ULL);
    obx_model_property_flags(model, OBXPropertyFlags_ID);

    obx_model_property(model, "title", OBXPropertyType_String, 2, 7003000000000002ULL);
    obx_model_property(model, "createdAt", OBXPropertyType_Date, 3, 7003000000000003ULL);
    obx_model_property(model, "updatedAt", OBXPropertyType_Date, 4, 7003000000000004ULL);
    obx_model_property(model, "localId", OBXPropertyType_Long, 6, 7003000000000006ULL);
    obx_model_property(model, "ownerPartyRef", OBXPropertyType_String, 7, 7003000000000007ULL);
    obx_model_property(model, "chatReference", OBXPropertyType_String, 8, 7003000000000008ULL);
    obx_model_entity_last_property_id(model, 8, 7003000000000008ULL);

    // Entity 4: chatMessages - a single message within a chats conversation,
    // linked by chatReference (ObjectBox has no nested/array attributes).
    obx_model_entity(model, "chatMessages", 4, 7004000000000000ULL);
    obx_model_entity_flags(model, OBXEntityFlags_SYNC_ENABLED);

    obx_model_property(model, "id", OBXPropertyType_Long, 1, 7004000000000001ULL);
    obx_model_property_flags(model, OBXPropertyFlags_ID);

    obx_model_property(model, "role", OBXPropertyType_String, 3, 7004000000000003ULL);
    obx_model_property(model, "text", OBXPropertyType_String, 4, 7004000000000004ULL);
    obx_model_property(model, "createdAt", OBXPropertyType_Date, 5, 7004000000000005ULL);
    obx_model_property(model, "chatReference", OBXPropertyType_String, 7, 7004000000000007ULL);
    obx_model_entity_last_property_id(model, 7, 7004000000000007ULL);

    // Entity 5: LocalAccountBalance - purely local, deliberately no
    // OBXEntityFlags_SYNC_ENABLED and no corresponding entry in
    // objectbox-sync-server/objectbox-model.json (see the struct comment
    // above). The entity name has no MongoDB-collection meaning here since
    // it's never bridged.
    obx_model_entity(model, "LocalAccountBalance", 5, 7005000000000000ULL);

    obx_model_property(model, "id", OBXPropertyType_Long, 1, 7005000000000001ULL);
    obx_model_property_flags(model, OBXPropertyFlags_ID);

    obx_model_property(model, "ownerPartyRef", OBXPropertyType_String, 2, 7005000000000002ULL);
    obx_model_property(model, "accountReference", OBXPropertyType_String, 3, 7005000000000003ULL);
    obx_model_property(model, "label", OBXPropertyType_String, 4, 7005000000000004ULL);
    obx_model_property(model, "currency", OBXPropertyType_String, 5, 7005000000000005ULL);
    obx_model_property(model, "balanceValue", OBXPropertyType_Double, 6, 7005000000000006ULL);
    obx_model_property(model, "maskedIban", OBXPropertyType_String, 7, 7005000000000007ULL);
    obx_model_property(model, "isDefault", OBXPropertyType_Bool, 8, 7005000000000008ULL);
    obx_model_property(model, "lastRefreshedAt", OBXPropertyType_Date, 9, 7005000000000009ULL);
    obx_model_entity_last_property_id(model, 9, 7005000000000009ULL);

    // Entity 6: walletRequests. Id 6 because the local-only entity 5 above still
    // consumes an id here, even though it never reaches the sync server's model.json.
    obx_model_entity(model, "walletRequests", 6, 7006000000000000ULL);
    obx_model_entity_flags(model, OBXEntityFlags_SYNC_ENABLED);

    obx_model_property(model, "id", OBXPropertyType_Long, 1, 7006000000000001ULL);
    obx_model_property_flags(model, OBXPropertyFlags_ID);

    obx_model_property(model, "requestReference", OBXPropertyType_String, 2, 7006000000000002ULL);
    obx_model_property(model, "requesterPartyRef", OBXPropertyType_String, 3, 7006000000000003ULL);
    obx_model_property(model, "requesterName", OBXPropertyType_String, 4, 7006000000000004ULL);
    obx_model_property(model, "localSyncStatus", OBXPropertyType_String, 5, 7006000000000005ULL);
    obx_model_property(model, "payerPartyRef", OBXPropertyType_String, 6, 7006000000000006ULL);
    obx_model_property(model, "amount", OBXPropertyType_Double, 7, 7006000000000007ULL);
    obx_model_property(model, "currency", OBXPropertyType_String, 8, 7006000000000008ULL);
    obx_model_property(model, "note", OBXPropertyType_String, 9, 7006000000000009ULL);
    obx_model_property(model, "status", OBXPropertyType_String, 10, 7006000000000010ULL);
    obx_model_property(model, "leafyPayTransferReference", OBXPropertyType_String, 11, 7006000000000011ULL);
    obx_model_property(model, "createdAt", OBXPropertyType_Date, 12, 7006000000000012ULL);
    obx_model_property(model, "resolvedAt", OBXPropertyType_Date, 13, 7006000000000013ULL);
    obx_model_property(model, "payerCounterpartyRef", OBXPropertyType_String, 15, 7006000000000015ULL);
    obx_model_entity_last_property_id(model, 15, 7006000000000015ULL);

    obx_model_last_entity_id(model, 6, 7006000000000000ULL);
    obx_model_last_index_id(model, 1, 7001000000000100ULL);

    return model;
}

// ─── Embedding client ───────────────────────────────────────────────────
// Re-implements backend/services/embeddings.py's get_embedding() contract in
// C++, since this service can't import the Python module. Same graceful
// degradation: returns an empty vector (not a thrown error) on failure, so an
// unreachable provider doesn't block writing the underlying transaction.

std::vector<float> embed_with_ollama(const std::string& text) {
    static const std::string base_url = env_or("OLLAMA_BASE_URL", "http://ollama:11434");
    static const std::string model_name = env_or("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text");

    httplib::Client client(base_url);
    client.set_connection_timeout(30);
    client.set_read_timeout(30);

    json body = {{"model", model_name}, {"input", text}};
    auto response = client.Post("/api/embed", body.dump(), "application/json");

    if (!response || response->status != 200) {
        std::cerr << "Ollama embedding request failed; continuing without noteEmbedding" << std::endl;
        return {};
    }

    try {
        auto parsed = json::parse(response->body);
        return parsed.at("embeddings").at(0).get<std::vector<float>>();
    } catch (const std::exception& e) {
        std::cerr << "Failed to parse Ollama embedding response: " << e.what() << std::endl;
        return {};
    }
}

std::vector<float> embed_with_voyage(const std::string& text) {
    static const std::string api_key = env_or("VOYAGE_API_KEY", "");
    static const std::string model_name = env_or("VOYAGE_EMBEDDING_MODEL", "voyage-3-large");

    if (api_key.empty()) {
        std::cerr << "VOYAGE_API_KEY is not set; continuing without noteEmbedding" << std::endl;
        return {};
    }

    httplib::Client client("https://ai.mongodb.com");
    client.set_connection_timeout(30);
    client.set_read_timeout(30);

    json body = {{"model", model_name},
                 {"input", json::array({text})},
                 {"input_type", "document"},
                 {"output_dimension", EMBEDDING_DIMENSIONS}};
    httplib::Headers headers = {{"Authorization", "Bearer " + api_key}};
    auto response = client.Post("/v1/embeddings", headers, body.dump(), "application/json");

    if (!response || response->status != 200) {
        std::cerr << "Voyage embedding request failed; continuing without noteEmbedding" << std::endl;
        return {};
    }

    try {
        auto parsed = json::parse(response->body);
        return parsed.at("data").at(0).at("embedding").get<std::vector<float>>();
    } catch (const std::exception& e) {
        std::cerr << "Failed to parse Voyage embedding response: " << e.what() << std::endl;
        return {};
    }
}

std::vector<float> get_embedding(const std::string& text) {
    return IS_LOCAL ? embed_with_ollama(text) : embed_with_voyage(text);
}

// ─── ObjectBox store + sync ─────────────────────────────────────────────

std::shared_ptr<obx::Store> store;
std::unique_ptr<obx::SyncClient> syncClient;

bool init_objectbox(const std::string& db_path, const std::string& sync_url) {
    std::cout << "=== leafy-local-store ===" << std::endl;
    std::cout << "Database: " << db_path << std::endl;

    try {
        OBX_model* model = create_obx_model();
        obx::Options options(model);
        options.directory(db_path.c_str());
        store = std::make_shared<obx::Store>(options);
        std::cout << "Store opened (" << store->box<LocalTransaction>().count() << " transactions, "
                   << store->box<LocalContact>().count() << " contacts, "
                   << store->box<LocalChat>().count() << " chats, "
                   << store->box<LocalChatMessage>().count() << " chat messages, "
                   << store->box<LocalAccountBalance>().count() << " cached accounts, "
                   << store->box<LocalRequest>().count() << " requests)" << std::endl;

        if (!sync_url.empty()) {
            if (obx_has_feature(OBXFeature_Sync)) {
                std::cout << "Connecting to sync server: " << sync_url << std::endl;
                syncClient = std::make_unique<obx::SyncClient>(*store, sync_url, obx::SyncCredentials::none());
                syncClient->start();
                std::cout << "Sync client started" << std::endl;
            } else {
                std::cerr << "Warning: ObjectBox Sync not available in this build" << std::endl;
            }
        }

        return true;
    } catch (const std::exception& e) {
        std::cerr << "Failed to initialize ObjectBox: " << e.what() << std::endl;
        return false;
    }
}

// ─── HTTP API ────────────────────────────────────────────────────────────

int64_t now_epoch_millis() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

// Random (v4) uuid, for callers that don't mint their own reference.
std::string new_uuid() {
    static std::mt19937_64 generator(std::random_device{}());
    static std::uniform_int_distribution<uint32_t> hexDigit(0, 15);
    static const char* HEX = "0123456789abcdef";

    std::string uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    for (char& c : uuid) {
        if (c == 'x') {
            c = HEX[hexDigit(generator)];
        } else if (c == 'y') {
            c = HEX[(hexDigit(generator) & 0x3) | 0x8];
        }
    }
    return uuid;
}

json transaction_to_json(const LocalTransaction& t) {
    return {
        {"id", t.id},
        {"leafyPayTransferReference", t.leafyPayTransferReference},
        {"ownerPartyRef", t.ownerPartyRef},
        {"counterpartyArrangementReference", t.counterpartyArrangementReference},
        {"amount", t.amount},
        {"currency", t.currency},
        {"note", t.note.empty() ? json(nullptr) : json(t.note)},
        {"direction", t.direction},
        {"leafyPayStatus", t.leafyPayStatus},
        {"localSyncStatus", t.localSyncStatus},
        {"createdAt", t.createdAt},
        {"settledAt", t.settledAt == 0 ? json(nullptr) : json(t.settledAt)},
    };
}

json contact_to_json(const LocalContact& c) {
    return {
        {"id", c.id},
        {"ownerPartyRef", c.ownerPartyRef},
        {"counterpartyArrangementReference", c.counterpartyArrangementReference},
        {"counterpartyLabel", c.counterpartyLabel},
        {"counterpartyLookupType", c.counterpartyLookupType},
        {"counterpartyLookupHint", c.counterpartyLookupHint},
        {"createdAt", c.createdAt},
        {"updatedAt", c.updatedAt},
    };
}

json request_to_json(const LocalRequest& r) {
    return {
        {"id", r.id},
        {"requestReference", r.requestReference},
        {"requesterPartyRef", r.requesterPartyRef},
        {"requesterName", r.requesterName},
        {"localSyncStatus", r.localSyncStatus},
        {"payerPartyRef", r.payerPartyRef},
        {"payerCounterpartyRef", r.payerCounterpartyRef},
        {"amount", r.amount},
        {"currency", r.currency},
        {"note", r.note.empty() ? json(nullptr) : json(r.note)},
        {"status", r.status},
        {"leafyPayTransferReference",
         r.leafyPayTransferReference.empty() ? json(nullptr) : json(r.leafyPayTransferReference)},
        {"createdAt", r.createdAt},
        {"resolvedAt", r.resolvedAt == 0 ? json(nullptr) : json(r.resolvedAt)},
    };
}

json chat_to_json(const LocalChat& c) {
    return {
        {"id", c.id},
        {"title", c.title},
        {"ownerPartyRef", c.ownerPartyRef.empty() ? json(nullptr) : json(c.ownerPartyRef)},
        {"chatReference", c.chatReference},
        {"createdAt", c.createdAt},
        {"updatedAt", c.updatedAt},
        {"localId", c.localId},
    };
}

std::unique_ptr<LocalChat> find_chat_by_reference(const std::string& chatReference) {
    auto query = store->box<LocalChat>().query(LocalChat_::chatReference.equals(chatReference)).build();
    auto found = query.find();
    return found.empty() ? nullptr : std::make_unique<LocalChat>(found.front());
}

json chat_message_to_json(const LocalChatMessage& m) {
    return {
        {"id", m.id},
        {"chatReference", m.chatReference},
        {"role", m.role},
        {"text", m.text},
        {"createdAt", m.createdAt},
    };
}

struct SpendingRow {
    double total = 0;
    int64_t count = 0;
    std::string currency;
    int64_t lastAt = 0;
};

// Totals per counterparty, largest first. Mirrors
// backend/services/transactions.py's spending_by_contact() - same rows, same
// order, same rounding; ObjectBox has no aggregation pipeline, so the
// $match/$group/$sort that one hands to Atlas is done by hand here.
json spending_by_contact(const std::string& ownerPartyRef, const std::string& direction) {
    std::map<std::string, SpendingRow> grouped;
    for (const auto& t : store->box<LocalTransaction>().getAll()) {
        if (t->ownerPartyRef != ownerPartyRef || t->direction != direction) continue;

        SpendingRow& row = grouped[t->counterpartyArrangementReference];
        row.total += t->amount;
        row.count += 1;
        if (row.currency.empty()) {
            row.currency = t->currency;
        }
        row.lastAt = std::max(row.lastAt, t->createdAt);
    }

    std::vector<std::pair<std::string, SpendingRow>> rows(grouped.begin(), grouped.end());
    std::sort(rows.begin(), rows.end(), [](const auto& a, const auto& b) {
        return a.second.total > b.second.total;
    });

    json results = json::array();
    for (const auto& [counterparty, row] : rows) {
        results.push_back({
            {"counterpartyArrangementReference", counterparty},
            {"total", std::round(row.total * 100.0) / 100.0},
            {"count", row.count},
            {"currency", row.currency},
            {"lastAt", row.lastAt == 0 ? json(nullptr) : json(row.lastAt)},
        });
    }
    return results;
}

json account_balance_to_json(const LocalAccountBalance& a) {
    return {
        {"id", a.id},
        {"ownerPartyRef", a.ownerPartyRef},
        {"accountReference", a.accountReference},
        {"label", a.label},
        {"currency", a.currency},
        {"balanceValue", a.balanceValue},
        {"maskedIban", a.maskedIban.empty() ? json(nullptr) : json(a.maskedIban)},
        {"isDefault", a.isDefault},
        {"lastRefreshedAt", a.lastRefreshedAt},
    };
}

int main(int argc, char* argv[]) {
    std::string db_path = argc > 1 ? argv[1] : "/app/local-store-db";
    std::string sync_url = argc > 2 ? argv[2] : env_or("SYNC_SERVER_URL", "ws://objectbox-sync-server:9999");
    int port = 8090;

    if (!init_objectbox(db_path, sync_url)) {
        return 1;
    }

    httplib::Server svr;

    // Every handler reports an unexpected failure the same way, so it is registered once here.
    svr.set_exception_handler([](const httplib::Request&, httplib::Response& res, std::exception_ptr ep) {
        res.status = 500;
        try {
            std::rethrow_exception(ep);
        } catch (const std::exception& e) {
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    svr.Get("/local/v1/health", [](const httplib::Request&, httplib::Response& res) {
        json response;
        response["status"] = "healthy";
        response["transaction_count"] = store->box<LocalTransaction>().count();
        response["contact_count"] = store->box<LocalContact>().count();
        response["chat_count"] = store->box<LocalChat>().count();
        response["chat_message_count"] = store->box<LocalChatMessage>().count();
        response["account_count"] = store->box<LocalAccountBalance>().count();
        response["request_count"] = store->box<LocalRequest>().count();
        res.set_content(response.dump(), "application/json");
    });

    svr.Get("/local/v1/transactions", [](const httplib::Request&, httplib::Response& res) {
        auto box = store->box<LocalTransaction>();
        json results = json::array();
        for (const auto& t : box.getAll()) {
            results.push_back(transaction_to_json(*t));
        }
        res.set_content(results.dump(), "application/json");
    });

    // Semantic search over locally-stored transaction notes, entirely offline:
    // embeds `q` via the local Ollama container, then runs ObjectBox's own
    // HNSW nearestNeighbors query against noteEmbedding - no Atlas round
    // trip. Mirrors backend/routers/wallet_transactions.py's
    // GET /wallet-transactions/search, but against the on-device store.
    svr.Get("/local/v1/transactions/search", [](const httplib::Request& req, httplib::Response& res) {
        if (!req.has_param("q")) {
            res.status = 400;
            res.set_content(json{{"error", "Missing required query param: q"}}.dump(), "application/json");
            return;
        }

        std::string q = req.get_param_value("q");
        int limit = 10;
        if (req.has_param("limit")) {
            limit = std::stoi(req.get_param_value("limit"));
        }
        std::string ownerPartyRef = req.has_param("ownerPartyRef")
            ? req.get_param_value("ownerPartyRef")
            : "";

        std::vector<float> queryVector = get_embedding(q);
        if (queryVector.empty()) {
            res.status = 503;
            res.set_content(
                json{{"error", "Semantic search is temporarily unavailable (embedding provider unreachable)"}}.dump(),
                "application/json");
            return;
        }

        auto box = store->box<LocalTransaction>();
        // nearestNeighbors alone can't also filter by ownerPartyRef, so
        // over-fetch and filter client-side when a filter is requested  - 
        // fine at this PoC's local scale (a handful of records).
        int fetchLimit = ownerPartyRef.empty() ? limit : limit * 5;
        auto query = box.query(LocalTransaction_::noteEmbedding.nearestNeighbors(queryVector, fetchLimit)).build();
        // findWithScores() returns `score` as a *distance* (lower = more
        // similar), already sorted nearest-first - the opposite
        // convention from Atlas's $vectorSearch score (higher = better),
        // which backend/routers/wallet_transactions.py's /search uses.
        auto foundWithScores = query.findWithScores();

        json results = json::array();
        for (const auto& [t, score] : foundWithScores) {
            if (!ownerPartyRef.empty() && t.ownerPartyRef != ownerPartyRef) {
                continue;
            }
            json item = transaction_to_json(t);
            item["score"] = score;
            results.push_back(item);
            if (static_cast<int>(results.size()) >= limit) {
                break;
            }
        }
        res.set_content(results.dump(), "application/json");
    });

    // Offline twin of the backend's GET /wallet-transactions/summary: same rows,
    // computed against the on-device store instead of an Atlas pipeline.
    svr.Get("/local/v1/transactions/summary", [](const httplib::Request& req, httplib::Response& res) {
        if (!req.has_param("ownerPartyRef")) {
            res.status = 400;
            res.set_content(json{{"error", "Missing required query param: ownerPartyRef"}}.dump(),
                            "application/json");
            return;
        }

        std::string direction = req.has_param("direction") ? req.get_param_value("direction") : "sent";
        if (direction != "sent" && direction != "received") {
            res.status = 400;
            res.set_content(json{{"error", "direction must be \"sent\" or \"received\""}}.dump(),
                            "application/json");
            return;
        }

        res.set_content(spending_by_contact(req.get_param_value("ownerPartyRef"), direction).dump(),
                        "application/json");
    });

    svr.Post("/local/v1/transactions/send", [](const httplib::Request& req, httplib::Response& res) {
        auto bad_request = [&res](const std::string& msg) {
            res.status = 400;
            res.set_content(json{{"error", msg}}.dump(), "application/json");
        };

        json body;
        try {
            body = json::parse(req.body);
        } catch (const std::exception& e) {
            bad_request(std::string("Invalid JSON body: ") + e.what());
            return;
        }

        for (const char* field : {"leafyPayTransferReference", "ownerPartyRef",
                                   "counterpartyArrangementReference", "amount", "currency", "direction"}) {
            if (!body.contains(field)) {
                bad_request(std::string("Missing required field: ") + field);
                return;
            }
        }

        LocalTransaction t;
        t.leafyPayTransferReference = body.at("leafyPayTransferReference").get<std::string>();
        t.ownerPartyRef = body.at("ownerPartyRef").get<std::string>();
        t.counterpartyArrangementReference = body.at("counterpartyArrangementReference").get<std::string>();
        t.amount = body.at("amount").get<double>();
        t.currency = body.at("currency").get<std::string>();
        t.direction = body.at("direction").get<std::string>();
        t.note = body.value("note", "");
        if (!t.note.empty()) {
            t.noteEmbedding = get_embedding(t.note);
        }
        // This transaction originates from the offline-capable local store,
        // hence local_pending rather than the backend's "synced" default.
        t.leafyPayStatus = "pending";
        t.localSyncStatus = "local_pending";
        t.createdAt = now_epoch_millis();
        t.settledAt = 0;

        auto box = store->box<LocalTransaction>();
        box.put(t);

        res.status = 201;
        res.set_content(transaction_to_json(t).dump(), "application/json");
    });

    // Deletes propagate through ObjectBox Sync like any other write, so this
    // also removes the corresponding document from Atlas once connected  - 
    // primarily here so integration tests can clean up after themselves.
    svr.Delete(R"(/local/v1/transactions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        obx_id id = std::stoll(req.matches[1]);
        auto box = store->box<LocalTransaction>();
        if (!box.remove(id)) {
            res.status = 404;
            res.set_content(json{{"error", "Transaction not found"}}.dump(), "application/json");
            return;
        }
        res.status = 204;
    });

    svr.Get("/local/v1/contacts", [](const httplib::Request&, httplib::Response& res) {
        auto box = store->box<LocalContact>();
        json results = json::array();
        for (const auto& c : box.getAll()) {
            results.push_back(contact_to_json(*c));
        }
        res.set_content(results.dump(), "application/json");
    });

    // Queues a contact add locally; reconciled with Leafy Pay on reconnect
    // (mirrors the architecture plan's §6.2 description of this endpoint).
    svr.Post("/local/v1/contacts", [](const httplib::Request& req, httplib::Response& res) {
        auto bad_request = [&res](const std::string& msg) {
            res.status = 400;
            res.set_content(json{{"error", msg}}.dump(), "application/json");
        };

        json body;
        try {
            body = json::parse(req.body);
        } catch (const std::exception& e) {
            bad_request(std::string("Invalid JSON body: ") + e.what());
            return;
        }

        for (const char* field : {"ownerPartyRef", "counterpartyArrangementReference",
                                   "counterpartyLabel", "counterpartyLookupType", "counterpartyLookupHint"}) {
            if (!body.contains(field)) {
                bad_request(std::string("Missing required field: ") + field);
                return;
            }
        }

        LocalContact c;
        c.ownerPartyRef = body.at("ownerPartyRef").get<std::string>();
        c.counterpartyArrangementReference = body.at("counterpartyArrangementReference").get<std::string>();
        c.counterpartyLabel = body.at("counterpartyLabel").get<std::string>();
        c.counterpartyLookupType = body.at("counterpartyLookupType").get<std::string>();
        c.counterpartyLookupHint = body.at("counterpartyLookupHint").get<std::string>();
        // Explicitly null for phone contacts, so is_null rather than value() (which throws).
        c.createdAt = now_epoch_millis();
        c.updatedAt = c.createdAt;

        auto box = store->box<LocalContact>();
        box.put(c);

        res.status = 201;
        res.set_content(contact_to_json(c).dump(), "application/json");
    });

    // Filtered by ownerPartyRef; no filter returns everything, matching
    // /contacts and /transactions.
    svr.Get("/local/v1/chats", [](const httplib::Request& req, httplib::Response& res) {
        const std::string ownerPartyRef =
            req.has_param("ownerPartyRef") ? req.get_param_value("ownerPartyRef") : "";

        auto box = store->box<LocalChat>();
        json results = json::array();
        for (const auto& c : box.getAll()) {
            if (!ownerPartyRef.empty() && c->ownerPartyRef != ownerPartyRef) continue;
            results.push_back(chat_to_json(*c));
        }
        res.set_content(results.dump(), "application/json");
    });

    svr.Post("/local/v1/chats", [](const httplib::Request& req, httplib::Response& res) {
        json body;
        try {
            body = json::parse(req.body);
        } catch (const std::exception& e) {
            res.status = 400;
            res.set_content(json{{"error", std::string("Invalid JSON body: ") + e.what()}}.dump(), "application/json");
            return;
        }

        LocalChat c;
        c.title = body.value("title", "New chat");
        c.ownerPartyRef = body.value("ownerPartyRef", "");
        c.chatReference = body.value("chatReference", "");
        if (c.chatReference.empty()) {
            c.chatReference = new_uuid();
        }
        c.createdAt = now_epoch_millis();
        c.updatedAt = c.createdAt;

        auto box = store->box<LocalChat>();
        box.put(c);       // assigns c.id
        c.localId = c.id;
        box.put(c);       // persist localId so it's carried into the Atlas sync

        res.status = 201;
        res.set_content(chat_to_json(c).dump(), "application/json");
    });

    svr.Get(R"(/local/v1/chats/([^/]+)/messages)", [](const httplib::Request& req, httplib::Response& res) {
        std::string chatReference = req.matches[1];
        if (!find_chat_by_reference(chatReference)) {
            res.status = 404;
            res.set_content(json{{"error", "Chat not found"}}.dump(), "application/json");
            return;
        }

        auto query = store->box<LocalChatMessage>()
                         .query(LocalChatMessage_::chatReference.equals(chatReference))
                         .build();
        json results = json::array();
        for (const auto& m : query.find()) {
            results.push_back(chat_message_to_json(m));
        }
        res.set_content(results.dump(), "application/json");
    });

    // Bumps the parent LocalChat's updatedAt on every new message (two
    // sequential puts, no explicit transaction - same simplicity level as
    // the rest of this file).
    svr.Post(R"(/local/v1/chats/([^/]+)/messages)", [](const httplib::Request& req, httplib::Response& res) {
        auto bad_request = [&res](const std::string& msg) {
            res.status = 400;
            res.set_content(json{{"error", msg}}.dump(), "application/json");
        };

        std::string chatReference = req.matches[1];

        json body;
        try {
            body = json::parse(req.body);
        } catch (const std::exception& e) {
            bad_request(std::string("Invalid JSON body: ") + e.what());
            return;
        }

        for (const char* field : {"role", "text"}) {
            if (!body.contains(field)) {
                bad_request(std::string("Missing required field: ") + field);
                return;
            }
        }

        std::string role = body.at("role").get<std::string>();
        if (role != "user" && role != "assistant") {
            bad_request("role must be \"user\" or \"assistant\"");
            return;
        }

        auto chat = find_chat_by_reference(chatReference);
        if (!chat) {
            res.status = 404;
            res.set_content(json{{"error", "Chat not found"}}.dump(), "application/json");
            return;
        }

        LocalChatMessage m;
        m.chatReference = chatReference;
        m.role = role;
        m.text = body.at("text").get<std::string>();
        m.createdAt = now_epoch_millis();

        store->box<LocalChatMessage>().put(m);

        chat->updatedAt = m.createdAt;
        store->box<LocalChat>().put(*chat);

        res.status = 201;
        res.set_content(chat_message_to_json(m).dump(), "application/json");
    });

    // Deletes propagate through ObjectBox Sync like any other write, so this
    // also removes the corresponding document from Atlas once connected.
    // Cascades to the chat's messages, mirroring backend/routers/chats.py's
    // delete_chat.
    svr.Delete(R"(/local/v1/chats/([^/]+))", [](const httplib::Request& req, httplib::Response& res) {
        std::string chatReference = req.matches[1];

        auto chat = find_chat_by_reference(chatReference);
        if (!chat) {
            res.status = 404;
            res.set_content(json{{"error", "Chat not found"}}.dump(), "application/json");
            return;
        }
        store->box<LocalChat>().remove(chat->id);

        auto messageBox = store->box<LocalChatMessage>();
        auto query = messageBox.query(LocalChatMessage_::chatReference.equals(chatReference)).build();
        for (const auto& m : query.find()) {
            messageBox.remove(m.id);
        }

        res.status = 204;
    });

    svr.Delete(R"(/local/v1/chats/([^/]+)/messages/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        std::string chatReference = req.matches[1];
        obx_id messageId = std::stoll(req.matches[2]);

        auto messageBox = store->box<LocalChatMessage>();
        auto existing = messageBox.get(messageId);
        if (!existing || existing->chatReference != chatReference) {
            res.status = 404;
            res.set_content(json{{"error", "Chat message not found"}}.dump(), "application/json");
            return;
        }

        messageBox.remove(messageId);
        res.status = 204;
    });

    svr.Delete(R"(/local/v1/contacts/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        obx_id id = std::stoll(req.matches[1]);
        auto box = store->box<LocalContact>();
        if (!box.remove(id)) {
            res.status = 404;
            res.set_content(json{{"error", "Contact not found"}}.dump(), "application/json");
            return;
        }
        res.status = 204;
    });

    // Filtered by payerPartyRef (an inbox) or requesterPartyRef (an outbox), matching /contacts
    // and /transactions. localSyncStatus finds the ones composed offline, for the replay.
    svr.Get("/local/v1/requests", [](const httplib::Request& req, httplib::Response& res) {
        const std::string payerPartyRef =
            req.has_param("payerPartyRef") ? req.get_param_value("payerPartyRef") : "";
        const std::string requesterPartyRef =
            req.has_param("requesterPartyRef") ? req.get_param_value("requesterPartyRef") : "";
        const std::string status = req.has_param("status") ? req.get_param_value("status") : "";
        const std::string localSyncStatus =
            req.has_param("localSyncStatus") ? req.get_param_value("localSyncStatus") : "";

        auto box = store->box<LocalRequest>();
        json results = json::array();
        for (const auto& r : box.getAll()) {
            if (!payerPartyRef.empty() && r->payerPartyRef != payerPartyRef) continue;
            if (!requesterPartyRef.empty() && r->requesterPartyRef != requesterPartyRef) continue;
            if (!status.empty() && r->status != status) continue;
            if (!localSyncStatus.empty() && r->localSyncStatus != localSyncStatus) continue;
            results.push_back(request_to_json(*r));
        }
        res.set_content(results.dump(), "application/json");
    });

    svr.Post("/local/v1/requests", [](const httplib::Request& req, httplib::Response& res) {
        auto bad_request = [&res](const std::string& msg) {
            res.status = 400;
            res.set_content(json{{"error", msg}}.dump(), "application/json");
        };

        json body;
        try {
            body = json::parse(req.body);
        } catch (const std::exception& e) {
            bad_request(std::string("Invalid JSON body: ") + e.what());
            return;
        }

        for (const char* field : {"requestReference", "requesterPartyRef", "requesterName",
                                   "payerCounterpartyRef", "amount"}) {
            if (!body.contains(field)) {
                bad_request(std::string("Missing required field: ") + field);
                return;
            }
        }

        LocalRequest r;
        r.requestReference = body.at("requestReference").get<std::string>();
        r.requesterPartyRef = body.at("requesterPartyRef").get<std::string>();
        r.requesterName = body.at("requesterName").get<std::string>();
        r.payerCounterpartyRef = body.at("payerCounterpartyRef").get<std::string>();
        r.amount = body.at("amount").get<double>();
        r.currency = body.value("currency", "EUR");
        if (body.contains("note") && !body.at("note").is_null()) {
            r.note = body.at("note").get<std::string>();
        }
        // Leafy Pay has not seen it, so no payer is resolved yet. Enters at Leafy Pay's own
        // opening status; the replay creates the real request and drops this stand-in.
        r.status = "created";
        r.localSyncStatus = "local_pending";
        r.createdAt = now_epoch_millis();

        auto box = store->box<LocalRequest>();
        box.put(r);

        res.status = 201;
        res.set_content(request_to_json(r).dump(), "application/json");
    });

    // How the replay retires a stand-in once Leafy Pay has the real request. Resolving one
    // (pay/decline/cancel) is Leafy Pay's call and never happens here.
    svr.Delete(R"(/local/v1/requests/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        obx_id id = std::stoll(req.matches[1]);
        auto box = store->box<LocalRequest>();
        if (!box.remove(id)) {
            res.status = 404;
            res.set_content(json{{"error", "Request not found"}}.dump(), "application/json");
            return;
        }
        res.status = 204;
    });

    svr.Get("/local/v1/accounts", [](const httplib::Request&, httplib::Response& res) {
        auto box = store->box<LocalAccountBalance>();
        json results = json::array();
        for (const auto& a : box.getAll()) {
            results.push_back(account_balance_to_json(*a));
        }
        res.set_content(results.dump(), "application/json");
    });

    // Upsert, not insert-only: a balance is a cache meant to be refreshed in
    // place (e.g. every time the home tab loads while online), not an
    // accumulating event log like /transactions/send or /contacts.
    svr.Put(R"(/local/v1/accounts/([^/]+))", [](const httplib::Request& req, httplib::Response& res) {
        auto bad_request = [&res](const std::string& msg) {
            res.status = 400;
            res.set_content(json{{"error", msg}}.dump(), "application/json");
        };

        std::string accountReference = req.matches[1];

        json body;
        try {
            body = json::parse(req.body);
        } catch (const std::exception& e) {
            bad_request(std::string("Invalid JSON body: ") + e.what());
            return;
        }

        for (const char* field : {"ownerPartyRef", "label", "currency", "balanceValue"}) {
            if (!body.contains(field)) {
                bad_request(std::string("Missing required field: ") + field);
                return;
            }
        }

        auto box = store->box<LocalAccountBalance>();
        auto query = box.query(LocalAccountBalance_::accountReference.equals(accountReference)).build();
        auto existing = query.find();

        LocalAccountBalance a = existing.empty() ? LocalAccountBalance() : existing.front();
        a.accountReference = accountReference;
        a.ownerPartyRef = body.at("ownerPartyRef").get<std::string>();
        a.label = body.at("label").get<std::string>();
        a.currency = body.at("currency").get<std::string>();
        a.balanceValue = body.at("balanceValue").get<double>();
        a.maskedIban = body.value("maskedIban", "");
        a.isDefault = body.value("isDefault", false);
        a.lastRefreshedAt = now_epoch_millis();

        box.put(a);

        res.status = existing.empty() ? 201 : 200;
        res.set_content(account_balance_to_json(a).dump(), "application/json");
    });

    svr.Delete(R"(/local/v1/accounts/([^/]+))", [](const httplib::Request& req, httplib::Response& res) {
        std::string accountReference = req.matches[1];
        auto box = store->box<LocalAccountBalance>();
        auto query = box.query(LocalAccountBalance_::accountReference.equals(accountReference)).build();
        auto existing = query.find();

        if (existing.empty()) {
            res.status = 404;
            res.set_content(json{{"error", "Account not found"}}.dump(), "application/json");
            return;
        }

        box.remove(existing.front().id);
        res.status = 204;
    });

    std::cout << "Starting HTTP server on 0.0.0.0:" << port << "..." << std::endl;
    svr.listen("0.0.0.0", port);

    return 0;
}
