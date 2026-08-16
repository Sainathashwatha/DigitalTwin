"""
Continuous MongoDB -> Qdrant Ingestion Pipeline & Knowledge Seeder.
Run alongside subscriber.py: python ingestor.py
"""
import os
import time
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from vector_store import init_collections, upsert

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "digital_twin")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "load_data")
SOLAR_COLLECTION = os.getenv("SOLAR_COLLECTION", "solar_data")

mongo_client = MongoClient(MONGO_URI)
db = mongo_client[DB_NAME]
load_col = db[COLLECTION_NAME]
solar_col = db[SOLAR_COLLECTION]

def chunk_load_doc(doc: dict) -> str:
    """Convert a MongoDB electrical load reading document into a natural-language chunk."""
    ts = doc.get("timestamp")
    if isinstance(ts, datetime):
        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S UTC")
    else:
        ts_str = str(ts)

    return (
        f"At {ts_str}, building electrical load was {doc.get('kW', 0):.3f} kW "
        f"(current: {doc.get('current', 0):.3f} A, voltage: {doc.get('voltage', 230)} V, "
        f"power factor: {doc.get('powerFactor', 0):.2f}, "
        f"reactive power: {doc.get('kVAR', 0):.3f} kVAR, "
        f"apparent power: {doc.get('kVA', 0):.3f} kVA, "
        f"energy consumed: {doc.get('kWh', 0):.5f} kWh)."
    )

def chunk_solar_doc(doc: dict) -> str:
    """Convert a MongoDB solar document into a natural-language chunk."""
    ts = doc.get("timestamp")
    if isinstance(ts, datetime):
        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S UTC")
    else:
        ts_str = str(ts)

    return (
        f"At {ts_str}, rooftop solar output was {doc.get('kW', 0):.3f} kW "
        f"({doc.get('kWh', 0):.5f} kWh produced in this interval)."
    )

def seed_knowledge_base():
    """Seed foundational electrical rules, zone profiles, and operational standards."""
    rules = [
        ("Power factor below 0.8 indicates significant capacitive or inductive load imbalance. "
         "Common cause: inductive motors running under light load, leading to higher reactive losses and grid strain."),
        ("kVAR exceeding 60% of active kW means reactive power consumption is abnormally high, risking utility penalties."),
        ("Solar output dropping more than 30% within a 10-minute window indicates cloud transient shading, panel degradation, or connection issues."),
        ("Ground Floor Room profile: Contains 1 desktop apparatus, 1 ceiling fan, 1 wall display. Rated peak load: ~0.80 kW."),
        ("First Floor Lab profile: Contains 1 heavy machine motor, 2 desktops, 2 ceiling fans. Rated peak load: ~3.00 kW. "
         "Motor startup triggers momentary inrush current spikes; this transient is normal."),
        ("Second Floor Room profile: Contains 1 desktop workstation, workbench tools, 1 ceiling fan. Rated peak load: ~0.80 kW."),
        ("Off-peak utility hours in standard Indian tariff schedules are 22:00 to 06:00 IST. High consumption during off-peak is cost-optimal."),
        ("Peak tariff hours are typically 18:00 to 22:00 IST. Non-essential loads should be shedding or shifted during this period."),
        ("Total building rated capacity is approximately 4.60 kW across all three physical electrical zones."),
    ]
    for rule in rules:
        upsert("knowledge_base", rule, {"type": "domain_rule", "source": "system_rules"})
    print("✅ Knowledge base successfully seeded in Qdrant.")

def ingest_loop():
    """Continuous polling loop to stream unindexed MongoDB docs into Qdrant."""
    last_load_id = None
    last_solar_id = None

    print("🚀 Continuous Ingestor pipeline started...")
    mongo_warned = False

    while True:
        try:
            # 1. Ingest Load readings
            query = {"_id": {"$gt": last_load_id}} if last_load_id else {}
            new_loads = list(load_col.find(query).sort("_id", 1).limit(50))
            for doc in new_loads:
                text = chunk_load_doc(doc)
                upsert("load_readings", text, {
                    "mongo_id": str(doc["_id"]),
                    "timestamp": str(doc.get("timestamp")),
                    "kW": doc.get("kW"),
                    "type": "load_reading",
                })
                last_load_id = doc["_id"]

            # 2. Ingest Solar readings
            query = {"_id": {"$gt": last_solar_id}} if last_solar_id else {}
            new_solar = list(solar_col.find(query).sort("_id", 1).limit(50))
            for doc in new_solar:
                text = chunk_solar_doc(doc)
                upsert("solar_readings", text, {
                    "mongo_id": str(doc["_id"]),
                    "timestamp": str(doc.get("timestamp")),
                    "kW": doc.get("kW"),
                    "type": "solar_reading",
                })
                last_solar_id = doc["_id"]

            if new_loads or new_solar:
                print(f"📦 [Ingestor] Indexed {len(new_loads)} load + {len(new_solar)} solar documents into Qdrant.")
            
            mongo_warned = False

        except Exception as e:
            if not mongo_warned:
                print(f"ℹ️ [Ingestor] Waiting for MongoDB connection at {MONGO_URI} (Configure MONGO_URI in .env when ready)...")
                mongo_warned = True

        time.sleep(10)

if __name__ == "__main__":
    init_collections()
    seed_knowledge_base()
    ingest_loop()

