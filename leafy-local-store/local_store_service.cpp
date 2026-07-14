/**
 * leafy-local-store: on-device ObjectBox store + HTTP API for offline wallet
 * transactions, syncing to Atlas via objectbox-sync-server. Mirrors the
 * voice-car-assistant-v2 reference's search-service pattern (same libraries,
 * same programmatic-model approach), scoped to a single entity for this
 * first pass: LocalTransaction.
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
    static const obx::Property<LocalTransaction, OBXPropertyType_Long> createdAt;
    static const obx::Property<LocalTransaction, OBXPropertyType_Long> settledAt;
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
const obx::Property<LocalTransaction, OBXPropertyType_Long> LocalTransaction_::createdAt(12);
const obx::Property<LocalTransaction, OBXPropertyType_Long> LocalTransaction_::settledAt(13);
const obx::Property<LocalTransaction, OBXPropertyType_Long> LocalTransaction_::syncClock(14);

// ─── Model — must match objectbox-sync-server/objectbox-model.json exactly ─

constexpr int EMBEDDING_DIMENSIONS = 768;

OBX_model* create_obx_model() {
    OBX_model* model = obx_model();

    // Entity name doubles as the target MongoDB collection name in the Sync
    // Server's bridge (confirmed empirically) — "syncTest" here is a
    // deliberately separate collection for this PoC, not walletTransactions.
    obx_model_entity(model, "syncTest", 1, 7001000000000000ULL);
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
    obx_model_property(model, "createdAt", OBXPropertyType_Long, 12, 7001000000000012ULL);
    obx_model_property(model, "settledAt", OBXPropertyType_Long, 13, 7001000000000013ULL);
    obx_model_property(model, "syncClock", OBXPropertyType_Long, 14, 7001000000000014ULL);
    obx_model_entity_last_property_id(model, 14, 7001000000000014ULL);

    obx_model_last_entity_id(model, 1, 7001000000000000ULL);
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
        std::cout << "Store opened (" << store->box<LocalTransaction>().count() << " transactions)" << std::endl;

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

    std::cout << "Starting HTTP server on 0.0.0.0:" << port << "..." << std::endl;
    svr.listen("0.0.0.0", port);

    return 0;
}
