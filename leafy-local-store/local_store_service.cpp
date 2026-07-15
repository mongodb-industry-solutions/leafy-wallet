/**
 * leafy-local-store: on-device ObjectBox store + HTTP API for offline wallet
 * transactions and contacts, syncing to Atlas via objectbox-sync-server.
 * Mirrors the voice-car-assistant-v2 reference's search-service pattern
 * (same libraries, same programmatic-model approach).
 */

#define OBX_CPP_FILE

#include <cstdlib>
#include <chrono>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "objectbox.hpp"
#include "objectbox-sync.hpp"

#include "httplib.h"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// ─── Entity ──────────────────────────────────────────────────────────────
// Mirrors backend/schemas/wallet_transactions.py's WalletTransactionCreate/Out,
// flattened for ObjectBox (no nested `amount` sub-document — see the plan's
// "known open question" on how this bridges to Atlas's nested shape).

struct LocalTransaction {
    int64_t id = 0;
    std::string leafyPayTransferReference;
    std::string ownerPartyRef;
    std::string counterpartyArrangementReference;
    double amount = 0;
    std::string currency;
    std::string note;                    // empty = absent
    std::vector<float> noteEmbedding;     // 768 dims, HNSW cosine — matches nomic-embed-text
    std::string direction;
    std::string leafyPayStatus;
    std::string localSyncStatus;
    int64_t createdAt = 0;                // epoch millis
    int64_t settledAt = 0;                // 0 = absent
    int64_t syncClock = 0;                // set by the Sync Server

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
            fbb.AddElement(30, object.syncClock);                // 14: syncClock

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
            out.syncClock = table->GetField<int64_t>(30, 0);
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
    int64_t syncClock = 0;   // set by the Sync Server

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
            fbb.AddElement(20, object.syncClock);           // 9: syncClock

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
            out.syncClock = table->GetField<int64_t>(20, 0);
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
// (ObjectBox has no nested/array attributes), linked by chatId.

struct LocalChat {
    int64_t id = 0;
    std::string title;
    int64_t createdAt = 0;   // epoch millis
    int64_t updatedAt = 0;   // epoch millis
    int64_t syncClock = 0;   // set by the Sync Server
    // Mirrors `id` once it's assigned, but as a *non-PK* field. ObjectBox's
    // Sync Server drops the PK `id` when bridging to Mongo (Mongo assigns its
    // own `_id` instead), so without this, LocalChatMessage.chatId (which
    // does sync through as a plain field) has nothing to join against once
    // synced. Set right after `id` is assigned by the first `put()`.
    int64_t localId = 0;

    struct _OBX_MetaInfo {
        static constexpr obx_schema_id entityId() { return 3; }

        static void setObjectId(LocalChat& object, obx_id newId) { object.id = newId; }

        static void toFlatBuffer(flatbuffers::FlatBufferBuilder& fbb, const LocalChat& object) {
            fbb.Clear();
            auto offsetTitle = fbb.CreateString(object.title);

            flatbuffers::uoffset_t fbStart = fbb.StartTable();
            fbb.AddElement(4, object.id);                  // 1: id
            fbb.AddOffset(6, offsetTitle);                  // 2: title
            fbb.AddElement(8, object.createdAt);            // 3: createdAt
            fbb.AddElement(10, object.updatedAt);           // 4: updatedAt
            fbb.AddElement(12, object.syncClock);           // 5: syncClock
            fbb.AddElement(14, object.localId);             // 6: localId

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
            out.syncClock = table->GetField<int64_t>(12, 0);
            out.localId = table->GetField<int64_t>(14, 0);
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
    int64_t chatId = 0;
    std::string role;
    std::string text;
    int64_t createdAt = 0;   // epoch millis
    int64_t syncClock = 0;   // set by the Sync Server

    struct _OBX_MetaInfo {
        static constexpr obx_schema_id entityId() { return 4; }

        static void setObjectId(LocalChatMessage& object, obx_id newId) { object.id = newId; }

        static void toFlatBuffer(flatbuffers::FlatBufferBuilder& fbb, const LocalChatMessage& object) {
            fbb.Clear();
            auto offsetRole = fbb.CreateString(object.role);
            auto offsetText = fbb.CreateString(object.text);

            flatbuffers::uoffset_t fbStart = fbb.StartTable();
            fbb.AddElement(4, object.id);                  // 1: id
            fbb.AddElement(6, object.chatId);               // 2: chatId
            fbb.AddOffset(8, offsetRole);                   // 3: role
            fbb.AddOffset(10, offsetText);                  // 4: text
            fbb.AddElement(12, object.createdAt);           // 5: createdAt
            fbb.AddElement(14, object.syncClock);           // 6: syncClock

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
            out.chatId = table->GetField<int64_t>(6, 0);
            readString(8, out.role);
            readString(10, out.text);
            out.createdAt = table->GetField<int64_t>(12, 0);
            out.syncClock = table->GetField<int64_t>(14, 0);
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

struct LocalContact_ {
    static const obx::Property<LocalContact, OBXPropertyType_Long> id;
    static const obx::Property<LocalContact, OBXPropertyType_String> ownerPartyRef;
    static const obx::Property<LocalContact, OBXPropertyType_String> counterpartyArrangementReference;
    static const obx::Property<LocalContact, OBXPropertyType_String> counterpartyLabel;
    static const obx::Property<LocalContact, OBXPropertyType_String> counterpartyLookupType;
    static const obx::Property<LocalContact, OBXPropertyType_String> counterpartyLookupHint;
    // Date (not Long): the Sync Server's MongoDB bridge maps Date to a real
    // BSON ISODate; Long would map to a plain Int64.
    static const obx::Property<LocalContact, OBXPropertyType_Date> createdAt;
    static const obx::Property<LocalContact, OBXPropertyType_Date> updatedAt;
    static const obx::Property<LocalContact, OBXPropertyType_Long> syncClock;
};

const obx::Property<LocalContact, OBXPropertyType_Long> LocalContact_::id(1);
const obx::Property<LocalContact, OBXPropertyType_String> LocalContact_::ownerPartyRef(2);
const obx::Property<LocalContact, OBXPropertyType_String> LocalContact_::counterpartyArrangementReference(3);
const obx::Property<LocalContact, OBXPropertyType_String> LocalContact_::counterpartyLabel(4);
const obx::Property<LocalContact, OBXPropertyType_String> LocalContact_::counterpartyLookupType(5);
const obx::Property<LocalContact, OBXPropertyType_String> LocalContact_::counterpartyLookupHint(6);
const obx::Property<LocalContact, OBXPropertyType_Date> LocalContact_::createdAt(7);
const obx::Property<LocalContact, OBXPropertyType_Date> LocalContact_::updatedAt(8);
const obx::Property<LocalContact, OBXPropertyType_Long> LocalContact_::syncClock(9);

struct LocalTransaction_ {
    static const obx::Property<LocalTransaction, OBXPropertyType_Long> id;
    static const obx::Property<LocalTransaction, OBXPropertyType_String> leafyPayTransferReference;
    static const obx::Property<LocalTransaction, OBXPropertyType_String> ownerPartyRef;
    static const obx::Property<LocalTransaction, OBXPropertyType_String> counterpartyArrangementReference;
    static const obx::Property<LocalTransaction, OBXPropertyType_Double> amount;
    static const obx::Property<LocalTransaction, OBXPropertyType_String> currency;
    static const obx::Property<LocalTransaction, OBXPropertyType_String> note;
    static const obx::Property<LocalTransaction, OBXPropertyType_FloatVector> noteEmbedding;
    static const obx::Property<LocalTransaction, OBXPropertyType_String> direction;
    static const obx::Property<LocalTransaction, OBXPropertyType_String> leafyPayStatus;
    static const obx::Property<LocalTransaction, OBXPropertyType_String> localSyncStatus;
    // Date (not Long): the Sync Server's MongoDB bridge maps Date to a real
    // BSON ISODate; Long would map to a plain Int64.
    static const obx::Property<LocalTransaction, OBXPropertyType_Date> createdAt;
    static const obx::Property<LocalTransaction, OBXPropertyType_Date> settledAt;
    static const obx::Property<LocalTransaction, OBXPropertyType_Long> syncClock;
};

const obx::Property<LocalTransaction, OBXPropertyType_Long> LocalTransaction_::id(1);
const obx::Property<LocalTransaction, OBXPropertyType_String> LocalTransaction_::leafyPayTransferReference(2);
const obx::Property<LocalTransaction, OBXPropertyType_String> LocalTransaction_::ownerPartyRef(3);
const obx::Property<LocalTransaction, OBXPropertyType_String> LocalTransaction_::counterpartyArrangementReference(4);
const obx::Property<LocalTransaction, OBXPropertyType_Double> LocalTransaction_::amount(5);
const obx::Property<LocalTransaction, OBXPropertyType_String> LocalTransaction_::currency(6);
const obx::Property<LocalTransaction, OBXPropertyType_String> LocalTransaction_::note(7);
const obx::Property<LocalTransaction, OBXPropertyType_FloatVector> LocalTransaction_::noteEmbedding(8);
const obx::Property<LocalTransaction, OBXPropertyType_String> LocalTransaction_::direction(9);
const obx::Property<LocalTransaction, OBXPropertyType_String> LocalTransaction_::leafyPayStatus(10);
const obx::Property<LocalTransaction, OBXPropertyType_String> LocalTransaction_::localSyncStatus(11);
const obx::Property<LocalTransaction, OBXPropertyType_Date> LocalTransaction_::createdAt(12);
const obx::Property<LocalTransaction, OBXPropertyType_Date> LocalTransaction_::settledAt(13);
const obx::Property<LocalTransaction, OBXPropertyType_Long> LocalTransaction_::syncClock(14);

struct LocalChat_ {
    static const obx::Property<LocalChat, OBXPropertyType_Long> id;
    static const obx::Property<LocalChat, OBXPropertyType_String> title;
    static const obx::Property<LocalChat, OBXPropertyType_Date> createdAt;
    static const obx::Property<LocalChat, OBXPropertyType_Date> updatedAt;
    static const obx::Property<LocalChat, OBXPropertyType_Long> syncClock;
    static const obx::Property<LocalChat, OBXPropertyType_Long> localId;
};

const obx::Property<LocalChat, OBXPropertyType_Long> LocalChat_::id(1);
const obx::Property<LocalChat, OBXPropertyType_String> LocalChat_::title(2);
const obx::Property<LocalChat, OBXPropertyType_Date> LocalChat_::createdAt(3);
const obx::Property<LocalChat, OBXPropertyType_Date> LocalChat_::updatedAt(4);
const obx::Property<LocalChat, OBXPropertyType_Long> LocalChat_::syncClock(5);
const obx::Property<LocalChat, OBXPropertyType_Long> LocalChat_::localId(6);

struct LocalChatMessage_ {
    static const obx::Property<LocalChatMessage, OBXPropertyType_Long> id;
    static const obx::Property<LocalChatMessage, OBXPropertyType_Long> chatId;
    static const obx::Property<LocalChatMessage, OBXPropertyType_String> role;
    static const obx::Property<LocalChatMessage, OBXPropertyType_String> text;
    static const obx::Property<LocalChatMessage, OBXPropertyType_Date> createdAt;
    static const obx::Property<LocalChatMessage, OBXPropertyType_Long> syncClock;
};

const obx::Property<LocalChatMessage, OBXPropertyType_Long> LocalChatMessage_::id(1);
const obx::Property<LocalChatMessage, OBXPropertyType_Long> LocalChatMessage_::chatId(2);
const obx::Property<LocalChatMessage, OBXPropertyType_String> LocalChatMessage_::role(3);
const obx::Property<LocalChatMessage, OBXPropertyType_String> LocalChatMessage_::text(4);
const obx::Property<LocalChatMessage, OBXPropertyType_Date> LocalChatMessage_::createdAt(5);
const obx::Property<LocalChatMessage, OBXPropertyType_Long> LocalChatMessage_::syncClock(6);

// ─── Model — must match objectbox-sync-server/objectbox-model.json exactly ─

constexpr int EMBEDDING_DIMENSIONS = 768;

OBX_model* create_obx_model() {
    OBX_model* model = obx_model();

    // Entity name doubles as the target MongoDB collection name in the Sync
    // Server's bridge (confirmed empirically) — this is now pointed at the
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
    obx_model_property(model, "syncClock", OBXPropertyType_Long, 14, 7001000000000014ULL);
    obx_model_entity_last_property_id(model, 14, 7001000000000014ULL);

    // Entity 2: walletContacts — entity name is the target MongoDB collection
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
    obx_model_property(model, "syncClock", OBXPropertyType_Long, 9, 7002000000000009ULL);
    obx_model_entity_last_property_id(model, 9, 7002000000000009ULL);

    // Entity 3: chats — a conversation. Entity name is the target MongoDB
    // collection name, same rule as entities 1-2 above.
    obx_model_entity(model, "chats", 3, 7003000000000000ULL);
    obx_model_entity_flags(model, OBXEntityFlags_SYNC_ENABLED);

    obx_model_property(model, "id", OBXPropertyType_Long, 1, 7003000000000001ULL);
    obx_model_property_flags(model, OBXPropertyFlags_ID);

    obx_model_property(model, "title", OBXPropertyType_String, 2, 7003000000000002ULL);
    obx_model_property(model, "createdAt", OBXPropertyType_Date, 3, 7003000000000003ULL);
    obx_model_property(model, "updatedAt", OBXPropertyType_Date, 4, 7003000000000004ULL);
    obx_model_property(model, "syncClock", OBXPropertyType_Long, 5, 7003000000000005ULL);
    obx_model_property(model, "localId", OBXPropertyType_Long, 6, 7003000000000006ULL);
    obx_model_entity_last_property_id(model, 6, 7003000000000006ULL);

    // Entity 4: chatMessages — a single message within a chats conversation,
    // linked by chatId (ObjectBox has no nested/array attributes).
    obx_model_entity(model, "chatMessages", 4, 7004000000000000ULL);
    obx_model_entity_flags(model, OBXEntityFlags_SYNC_ENABLED);

    obx_model_property(model, "id", OBXPropertyType_Long, 1, 7004000000000001ULL);
    obx_model_property_flags(model, OBXPropertyFlags_ID);

    obx_model_property(model, "chatId", OBXPropertyType_Long, 2, 7004000000000002ULL);
    obx_model_property(model, "role", OBXPropertyType_String, 3, 7004000000000003ULL);
    obx_model_property(model, "text", OBXPropertyType_String, 4, 7004000000000004ULL);
    obx_model_property(model, "createdAt", OBXPropertyType_Date, 5, 7004000000000005ULL);
    obx_model_property(model, "syncClock", OBXPropertyType_Long, 6, 7004000000000006ULL);
    obx_model_entity_last_property_id(model, 6, 7004000000000006ULL);

    obx_model_last_entity_id(model, 4, 7004000000000000ULL);
    obx_model_last_index_id(model, 1, 7001000000000100ULL);

    return model;
}

// ─── Ollama embedding client ────────────────────────────────────────────
// Re-implements backend/services/ollama.py's get_embedding() contract in
// C++, since this service can't import the Python module. Same graceful
// degradation: returns an empty vector (not a thrown error) on failure, so
// a down Ollama doesn't block writing the underlying transaction.

std::string env_or(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return value ? std::string(value) : fallback;
}

std::vector<float> get_embedding(const std::string& text) {
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
                   << store->box<LocalChatMessage>().count() << " chat messages)" << std::endl;

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

json transaction_to_json(const LocalTransaction& t) {
    return {
        {"id", t.id},
        {"leafyPayTransferReference", t.leafyPayTransferReference},
        {"ownerPartyRef", t.ownerPartyRef},
        {"counterpartyArrangementReference", t.counterpartyArrangementReference},
        {"amount", t.amount},
        {"currency", t.currency},
        {"note", t.note.empty() ? json(nullptr) : json(t.note)},
        {"hasEmbedding", !t.noteEmbedding.empty()},
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

json chat_to_json(const LocalChat& c) {
    return {
        {"id", c.id},
        {"title", c.title},
        {"createdAt", c.createdAt},
        {"updatedAt", c.updatedAt},
        {"localId", c.localId},
    };
}

json chat_message_to_json(const LocalChatMessage& m) {
    return {
        {"id", m.id},
        {"chatId", m.chatId},
        {"role", m.role},
        {"text", m.text},
        {"createdAt", m.createdAt},
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

    svr.Get("/local/v1/health", [](const httplib::Request&, httplib::Response& res) {
        try {
            json response;
            response["status"] = "healthy";
            response["transaction_count"] = store->box<LocalTransaction>().count();
            response["contact_count"] = store->box<LocalContact>().count();
            response["chat_count"] = store->box<LocalChat>().count();
            response["chat_message_count"] = store->box<LocalChatMessage>().count();
            res.set_content(response.dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"status", "error"}, {"error", e.what()}}.dump(), "application/json");
        }
    });

    svr.Get("/local/v1/transactions", [](const httplib::Request&, httplib::Response& res) {
        try {
            auto box = store->box<LocalTransaction>();
            json results = json::array();
            for (const auto& t : box.getAll()) {
                results.push_back(transaction_to_json(*t));
            }
            res.set_content(results.dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // Semantic search over locally-stored transaction notes, entirely offline:
    // embeds `q` via the local Ollama container, then runs ObjectBox's own
    // HNSW nearestNeighbors query against noteEmbedding — no Atlas round
    // trip. Mirrors backend/routers/wallet_transactions.py's
    // GET /wallet-transactions/search, but against the on-device store.
    svr.Get("/local/v1/transactions/search", [](const httplib::Request& req, httplib::Response& res) {
        if (!req.has_param("q")) {
            res.status = 400;
            res.set_content(json{{"error", "Missing required query param: q"}}.dump(), "application/json");
            return;
        }

        try {
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
                    json{{"error", "Semantic search is temporarily unavailable (Ollama unreachable)"}}.dump(),
                    "application/json");
                return;
            }

            auto box = store->box<LocalTransaction>();
            // nearestNeighbors alone can't also filter by ownerPartyRef, so
            // over-fetch and filter client-side when a filter is requested —
            // fine at this PoC's local scale (a handful of records).
            int fetchLimit = ownerPartyRef.empty() ? limit : limit * 5;
            auto query = box.query(LocalTransaction_::noteEmbedding.nearestNeighbors(queryVector, fetchLimit)).build();
            // findWithScores() returns `score` as a *distance* (lower = more
            // similar), already sorted nearest-first — the opposite
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
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
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

        try {
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
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // Deletes propagate through ObjectBox Sync like any other write, so this
    // also removes the corresponding document from Atlas once connected —
    // primarily here so integration tests can clean up after themselves.
    svr.Delete(R"(/local/v1/transactions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        try {
            obx_id id = std::stoll(req.matches[1]);
            auto box = store->box<LocalTransaction>();
            if (!box.remove(id)) {
                res.status = 404;
                res.set_content(json{{"error", "Transaction not found"}}.dump(), "application/json");
                return;
            }
            res.status = 204;
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    svr.Get("/local/v1/contacts", [](const httplib::Request&, httplib::Response& res) {
        try {
            auto box = store->box<LocalContact>();
            json results = json::array();
            for (const auto& c : box.getAll()) {
                results.push_back(contact_to_json(*c));
            }
            res.set_content(results.dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
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

        try {
            LocalContact c;
            c.ownerPartyRef = body.at("ownerPartyRef").get<std::string>();
            c.counterpartyArrangementReference = body.at("counterpartyArrangementReference").get<std::string>();
            c.counterpartyLabel = body.at("counterpartyLabel").get<std::string>();
            c.counterpartyLookupType = body.at("counterpartyLookupType").get<std::string>();
            c.counterpartyLookupHint = body.at("counterpartyLookupHint").get<std::string>();
            c.createdAt = now_epoch_millis();
            c.updatedAt = c.createdAt;

            auto box = store->box<LocalContact>();
            box.put(c);

            res.status = 201;
            res.set_content(contact_to_json(c).dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    svr.Get("/local/v1/chats", [](const httplib::Request&, httplib::Response& res) {
        try {
            auto box = store->box<LocalChat>();
            json results = json::array();
            for (const auto& c : box.getAll()) {
                results.push_back(chat_to_json(*c));
            }
            res.set_content(results.dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
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

        try {
            LocalChat c;
            c.title = body.value("title", "New chat");
            c.createdAt = now_epoch_millis();
            c.updatedAt = c.createdAt;

            auto box = store->box<LocalChat>();
            box.put(c);       // assigns c.id
            c.localId = c.id;
            box.put(c);       // persist localId so it's carried into the Atlas sync

            res.status = 201;
            res.set_content(chat_to_json(c).dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    svr.Get(R"(/local/v1/chats/(\d+)/messages)", [](const httplib::Request& req, httplib::Response& res) {
        try {
            int64_t chatId = std::stoll(req.matches[1]);
            if (!store->box<LocalChat>().get(chatId)) {
                res.status = 404;
                res.set_content(json{{"error", "Chat not found"}}.dump(), "application/json");
                return;
            }

            auto query = store->box<LocalChatMessage>().query(LocalChatMessage_::chatId.equals(chatId)).build();
            json results = json::array();
            for (const auto& m : query.find()) {
                results.push_back(chat_message_to_json(m));
            }
            res.set_content(results.dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // Bumps the parent LocalChat's updatedAt on every new message (two
    // sequential puts, no explicit transaction — same simplicity level as
    // the rest of this file).
    svr.Post(R"(/local/v1/chats/(\d+)/messages)", [](const httplib::Request& req, httplib::Response& res) {
        auto bad_request = [&res](const std::string& msg) {
            res.status = 400;
            res.set_content(json{{"error", msg}}.dump(), "application/json");
        };

        int64_t chatId = std::stoll(req.matches[1]);

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

        try {
            auto chatBox = store->box<LocalChat>();
            auto chat = chatBox.get(chatId);
            if (!chat) {
                res.status = 404;
                res.set_content(json{{"error", "Chat not found"}}.dump(), "application/json");
                return;
            }

            LocalChatMessage m;
            m.chatId = chatId;
            m.role = role;
            m.text = body.at("text").get<std::string>();
            m.createdAt = now_epoch_millis();

            store->box<LocalChatMessage>().put(m);

            chat->updatedAt = m.createdAt;
            chatBox.put(*chat);

            res.status = 201;
            res.set_content(chat_message_to_json(m).dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // Deletes propagate through ObjectBox Sync like any other write, so this
    // also removes the corresponding document from Atlas once connected.
    // Cascades to the chat's messages, mirroring backend/routers/chats.py's
    // delete_chat.
    svr.Delete(R"(/local/v1/chats/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        try {
            obx_id chatId = std::stoll(req.matches[1]);

            auto chatBox = store->box<LocalChat>();
            if (!chatBox.remove(chatId)) {
                res.status = 404;
                res.set_content(json{{"error", "Chat not found"}}.dump(), "application/json");
                return;
            }

            auto messageBox = store->box<LocalChatMessage>();
            auto query = messageBox.query(LocalChatMessage_::chatId.equals(chatId)).build();
            for (const auto& m : query.find()) {
                messageBox.remove(m.id);
            }

            res.status = 204;
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    svr.Delete(R"(/local/v1/chats/(\d+)/messages/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        try {
            obx_id chatId = std::stoll(req.matches[1]);
            obx_id messageId = std::stoll(req.matches[2]);

            auto messageBox = store->box<LocalChatMessage>();
            auto existing = messageBox.get(messageId);
            if (!existing || existing->chatId != chatId) {
                res.status = 404;
                res.set_content(json{{"error", "Chat message not found"}}.dump(), "application/json");
                return;
            }

            messageBox.remove(messageId);
    svr.Delete(R"(/local/v1/contacts/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        try {
            obx_id id = std::stoll(req.matches[1]);
            auto box = store->box<LocalContact>();
            if (!box.remove(id)) {
                res.status = 404;
                res.set_content(json{{"error", "Contact not found"}}.dump(), "application/json");
                return;
            }
            res.status = 204;
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    std::cout << "Starting HTTP server on 0.0.0.0:" << port << "..." << std::endl;
    svr.listen("0.0.0.0", port);

    return 0;
}
