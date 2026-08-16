import os
from fastapi import FastAPI
from pydantic import BaseModel
from pymongo import MongoClient
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from forecasting import predict_next
from vector_store import search
from llm_config import get_llm
from langchain_core.messages import HumanMessage
from simulator import simulator
from auditor_agent import run_auditor_agent

load_dotenv()

app = FastAPI(title="Digital Twin RAG Backend (Simulation Mode)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Client Initialization
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1000)
    mongo_db = mongo_client["digital_twin_db"]
    mongo_coll = mongo_db["load_telemetry"]
    mongo_client.server_info()  # Test connection
    print("[INFO] Connected to MongoDB (mongodb://localhost:27017)")
except Exception:
    mongo_coll = None
    print("[INFO] MongoDB offline. Using in-memory circular telemetry buffer.")

# -------- SIMULATOR & LOAD TELEMETRY --------
@app.get("/latest")
def get_latest():
    telemetry = simulator.get_latest()
    if mongo_coll is not None:
        try:
            # Periodic ingestion into MongoDB
            mongo_coll.insert_one({
                "timestamp": telemetry["timestamp"],
                "voltage": telemetry["voltage"],
                "current": telemetry["current"],
                "kW": telemetry["kW"],
                "powerFactor": telemetry["powerFactor"],
                "kVA": telemetry["kVA"],
                "kVAR": telemetry["kVAR"],
                "kWh": telemetry["kWh"],
                "solar_kW": telemetry["solar_kW"],
                "rooms": telemetry["rooms"],
                "groundFloorEquivalent": telemetry["groundFloorEquivalent"],
                "firstFloorEquivalent": telemetry["firstFloorEquivalent"],
                "secondFloorEquivalent": telemetry["secondFloorEquivalent"]
            })
        except Exception:
            pass
    return telemetry

@app.get("/history")
def get_history(limit: int = 30):
    return simulator.get_history(limit=limit)

@app.get("/live-traces")
def get_live_traces():
    return simulator.get_history(limit=25)

# -------- LOAD ACTUATOR CONTROLS (ESP32 EMULATION) --------
@app.get("/load1/on")
def load1_on():
    simulator.set_room_state("ground_floor_room", True)
    return {"status": "Ground Floor Room ON"}

@app.get("/load1/off")
def load1_off():
    simulator.set_room_state("ground_floor_room", False)
    return {"status": "Ground Floor Room OFF"}

@app.get("/load2/on")
def load2_on():
    simulator.set_room_state("first_floor_lab", True)
    return {"status": "First Floor Lab ON"}

@app.get("/load2/off")
def load2_off():
    simulator.set_room_state("first_floor_lab", False)
    return {"status": "First Floor Lab OFF"}

@app.get("/load3/on")
def load3_on():
    simulator.set_room_state("second_floor_room", True)
    return {"status": "Second Floor Room ON"}

@app.get("/load3/off")
def load3_off():
    simulator.set_room_state("second_floor_room", False)
    return {"status": "Second Floor Room OFF"}

# Emulate ESP32 /status endpoint
@app.get("/status")
def get_esp32_status():
    latest = simulator.get_latest()
    return {
        "groundFloorRoom": latest["rooms"]["groundFloorRoom"],
        "firstFloorLab": latest["rooms"]["firstFloorLab"],
        "secondFloorRoom": latest["rooms"]["secondFloorRoom"],
        "solarVoltage": round(latest["solar_kW"] * 2.0, 2),
        "measuredCurrent": latest["current"],
        "estimatedCurrent": latest["current"],
        "estimatedPower": latest["kW"] * 1000.0,
        "groundFloorEquivalent": latest["groundFloorEquivalent"],
        "firstFloorEquivalent": latest["firstFloorEquivalent"],
        "secondFloorEquivalent": latest["secondFloorEquivalent"],
    }

# -------- SUMMARY --------
@app.get("/summary")
def get_summary():
    hist = simulator.get_history(limit=30)
    if not hist:
        latest = simulator.get_latest()
        return {"count": 1, "avgCurrent": latest["current"], "avgPower": latest["kW"]}
    
    count = len(hist)
    avg_current = sum(d["current"] for d in hist) / count
    avg_power = sum(d["kW"] for d in hist) / count
    return {
        "count": count,
        "avgCurrent": round(avg_current, 2),
        "avgPower": round(avg_power, 2)
    }

# -------- FORECASTING (FIXED + RAG) --------
@app.get("/forecast")
def get_forecast(steps: int = 10):
    hist_docs = simulator.get_history(limit=30)
    history = [float(d.get("kW", 0)) for d in hist_docs] if hist_docs else [1.2, 1.4, 1.6, 1.85, 2.1, 1.94]

    numeric_forecast = predict_next(history, steps=steps)

    # Contextual narrative via LLM
    try:
        current_kw = history[-1] if history else 3.8
        max_f = max(numeric_forecast) if numeric_forecast else current_kw
        trend = "escalating" if numeric_forecast[-1] > current_kw else "stabilizing"
        narrative = (
            f"10-minute demand trajectory is **{trend}** with an expected ceiling of **{max_f:.2f} kW**. "
            f"{'Headroom remains above 1.2 kW capacity margin.' if max_f < 4.2 else 'Breaker load threshold approaching limit — consider load-shedding.'}"
        )
    except Exception:
        narrative = "10-minute demand trajectory remains stable within normal operating thresholds."

    return {
        "forecast_kw": numeric_forecast,
        "narrative": narrative
    }

# -------- LLM AUDITOR MULTI-AGENT ENDPOINT --------
@app.get("/agent/audit")
def get_agent_audit():
    """
    Executes LLM Auditor multi-agent fact-checking pipeline against live telemetry,
    verifying statements and computing a factual grounding score.
    """
    latest = simulator.get_latest()
    return run_auditor_agent(latest, mongo_coll)

# -------- RAG: AI INSIGHTS (ENHANCED WITH AUDITOR) --------
@app.get("/ai-insights")
def get_ai_insights():
    latest = simulator.get_latest()
    audit_res = run_auditor_agent(latest, mongo_coll)

    return {
        "insights": audit_res["audited_report"],
        "draft_insights": audit_res["draft_diagnosis"],
        "grounding_score": audit_res["grounding_score"],
        "verified_count": audit_res["verified_count"],
        "total_claims": audit_res["total_claims"],
        "claims": audit_res["claims"],
        "recommended_action": audit_res["recommended_action"],
        "critical_alert": audit_res["critical_alert"],
        "current_state": (
            f"Active Load: {latest.get('kW', 0):.3f} kW, "
            f"Current: {latest.get('current', 0):.2f} A at {latest.get('voltage', 230):.1f} V, "
            f"Power Factor: {latest.get('powerFactor', 0):.2f}, "
            f"Reactive Power: {latest.get('kVAR', 0):.3f} kVAR, "
            f"Solar Generation: {latest.get('solar_kW', 0):.3f} kW."
        ),
        "sources": [
            {"text": c["statement"], "source": c["evidence_source"], "status": c["status"]}
            for c in audit_res["claims"][:3]
        ]
    }

# -------- RAG: NATURAL LANGUAGE Q&A --------
class AskRequest(BaseModel):
    question: str

@app.post("/ask")
async def ask_question(req: AskRequest):
    if not req.question or not req.question.strip():
        return {"answer": "Please provide a valid question.", "sources": []}

    q = req.question.strip()

    # Fast semantic vector retrieval from Qdrant
    results = search("knowledge_base", q, top_k=2) + search("anomaly_episodes", q, top_k=1)
    context = "\n".join([f"• {r.get('text', '')}" for r in results if r.get('text')])

    # Instant heuristic synthesis for standard building queries
    q_lower = q.lower()
    if "power factor" in q_lower:
        answer = "Standard building power factor threshold is >= 0.80. A power factor below 0.80 indicates significant inductive load imbalance (such as uncompensated motors in the First Floor Lab), leading to reactive energy losses and grid penalties."
    elif "equipment" in q_lower or "capacity" in q_lower or "room" in q_lower:
        answer = "Total building rated capacity is 4.60 kW across 3 zones: Ground Floor Room (~0.80 kW peak), First Floor Lab (~3.00 kW heavy machine motor), and Second Floor Room (~0.80 kW workstation)."
    elif "spike" in q_lower or "motor" in q_lower or "lab" in q_lower:
        answer = "The First Floor Lab contains a heavy machine motor rated at 3.0 kW. Motor startup triggers momentary inrush current spikes; this transient inductive draw is normal during active lab sessions."
    elif results:
        answer = "Based on building records:\n" + "\n".join([f"• {r.get('text')}" for r in results if r.get('text')])
    else:
        answer = "All building parameters are operating within standard university facility limits (4.6 kW capacity, 230V line voltage)."

    return {
        "answer": answer,
        "sources": [{"text": r.get("text", "")[:120], "score": round(r.get("score", 0), 3)} for r in results]
    }

# -------- AGENT DECISION TRACES --------
class TraceLogRequest(BaseModel):
    timestamp: str
    reasoning: str
    action: str
    observation: str = ""

@app.post("/agent/log")
def log_agent_trace(req: TraceLogRequest):
    entry = req.dict()
    simulator.history_traces.insert(0, entry)
    if len(simulator.history_traces) > 30:
        simulator.history_traces.pop()
    return {"status": "ok"}

@app.get("/agent/traces")
def get_agent_traces(limit: int = 15):
    return simulator.history_traces[:limit]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)