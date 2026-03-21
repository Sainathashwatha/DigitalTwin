from fastapi import FastAPI
from pymongo import MongoClient
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mongo_client = MongoClient(os.getenv("MONGO_URI"))
db = mongo_client[os.getenv("DB_NAME")]

load_collection = db[os.getenv("COLLECTION_NAME")]
solar_collection = db[os.getenv("SOLAR_COLLECTION")]

# -------- LOAD --------
@app.get("/latest")
def get_latest():
    data = load_collection.find_one(sort=[("timestamp", -1)])
    if data:
        data["_id"] = str(data["_id"])
    return data

@app.get("/history")
def get_history(limit: int = 50):
    docs = list(load_collection.find().sort("timestamp", -1).limit(limit))
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs

# -------- SOLAR --------
@app.get("/solar")
def get_solar(limit: int = 50):
    docs = list(solar_collection.find().sort("timestamp", -1).limit(limit))
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs

# -------- SUMMARY --------
@app.get("/summary")
def get_summary():
    docs = list(load_collection.find().sort("timestamp", -1).limit(100))

    if not docs:
        return {"count": 0, "avgCurrent": 0, "avgPower": 0}

    count = len(docs)
    avg_current = sum(d.get("current", 0) for d in docs) / count
    avg_power = sum(d.get("kW", 0) for d in docs) / count

    return {
        "count": count,
        "avgCurrent": round(avg_current, 3),
        "avgPower": round(avg_power, 3)
    }

from forecasting import predict_next

@app.get("/forecast")
def forecast():
    return predict_next()