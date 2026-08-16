"""
Advanced Historical Ingestion Script with Sliding-Window Temporal Chunking.
Reads `LoadData_export.json`, clusters time-series readings into 3-point temporal windows,
computes rate-of-change deltas, and stores normalized embeddings in Qdrant.
Run as: python seed_from_json.py
"""
import os
import json
from datetime import datetime
from vector_store import init_collections, upsert

JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "LoadData_export.json")

def parse_iso_date(ts_obj):
    if isinstance(ts_obj, dict) and "$date" in ts_obj:
        return ts_obj["$date"]
    return str(ts_obj)

def seed_historical_data():
    print(f"[INGEST] Reading historical dataset from: {JSON_PATH}")
    if not os.path.exists(JSON_PATH):
        print(f"[ERROR] File not found: {JSON_PATH}")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"[INGEST] Processing {len(data)} raw telemetry points into sliding-window temporal chunks...")
    init_collections()

    # 1. High-Precision Domain Knowledge Rules
    rules = [
        ("Power factor below 0.80 represents severe inductive load lag. "
         "Common root cause: heavy machinery or induction motors running below nominal rating, causing high reactive current (kVAR) and utility penalties."),
        ("Reactive loss alert: When kVAR exceeds 50% of active kW, the system risks voltage instability and overheating on neutral conductors."),
        ("Ground Floor Room profile: Equipped with 1 desktop computing apparatus, 1 ceiling fan, 1 wall display. Rated peak continuous load: 0.80 kW (3.5 A)."),
        ("First Floor Lab profile: Equipped with 1 heavy machine 3.0 kW motor, 2 engineering workstations, 2 fans. "
         "Motor startup creates momentary inrush spikes up to 18 A with transient power factor dips to ~0.71 before nominal stabilization."),
        ("Second Floor Room profile: Contains 1 workstation cluster, electrical test benches, 1 ceiling fan. Rated peak load: 0.80 kW (3.5 A)."),
        ("Substation Safety Limit: Total building capacity is strictly rated at 4.60 kW (20.0 A @ 230 V). Exceeding 4.20 kW requires immediate automated load shedding."),
        ("Tariff Optimization: Peak commercial grid tariff operates between 18:00 and 22:00 IST. Heavy motor operations should be scheduled during off-peak windows (22:00 - 06:00 IST)."),
        ("Solar PV Generation Synergy: 2.4 kW rooftop solar array delivers peak output between 10:30 and 14:30 IST, offsetting up to 65% of daytime base load."),
    ]
    for rule in rules:
        upsert("knowledge_base", rule, {"type": "domain_rule", "source": "engineering_standards"})
    print("[SUCCESS] Indexed high-precision domain rules.")

    # 2. Sliding-Window Temporal Chunking (Window size = 3, Step = 2)
    window_size = 3
    step = 2
    temporal_chunks_count = 0
    anomaly_count = 0

    for i in range(0, len(data) - window_size + 1, step):
        window = data[i : i + window_size]
        t_start = parse_iso_date(window[0].get("timestamp"))
        t_end = parse_iso_date(window[-1].get("timestamp"))

        kw_vals = [float(p.get("kW", 0.0)) for p in window]
        cur_vals = [float(p.get("current", 0.0)) for p in window]
        pf_vals = [float(p.get("powerFactor", 1.0)) for p in window]
        kvar_vals = [float(p.get("kVAR", 0.0)) for p in window]

        avg_kw = sum(kw_vals) / len(kw_vals)
        delta_kw = kw_vals[-1] - kw_vals[0]
        avg_pf = sum(pf_vals) / len(pf_vals)
        min_pf = min(pf_vals)
        max_cur = max(cur_vals)
        avg_kvar = sum(kvar_vals) / len(kvar_vals)

        trend_desc = "steady"
        if delta_kw > 0.6:
            trend_desc = f"rapidly ramping up (+{delta_kw:.2f} kW surge)"
        elif delta_kw < -0.6:
            trend_desc = f"load shedding/ramping down ({delta_kw:.2f} kW drop)"

        temporal_narrative = (
            f"Temporal window from {t_start} to {t_end}: Building active power averaged {avg_kw:.2f} kW ({trend_desc}), "
            f"peaking at {max_cur:.1f} A current draw. Average power factor was {avg_pf:.2f} (minimum {min_pf:.2f}) "
            f"with reactive power averaging {avg_kvar:.2f} kVAR."
        )

        upsert("load_readings", temporal_narrative, {
            "time_start": t_start,
            "time_end": t_end,
            "avg_kw": round(avg_kw, 2),
            "delta_kw": round(delta_kw, 2),
            "min_pf": round(min_pf, 2),
            "max_cur": round(max_cur, 1),
            "type": "temporal_window"
        })
        temporal_chunks_count += 1

        if min_pf < 0.80 and avg_kw > 0.8:
            anomaly_text = (
                f"Historical Inductive Lag Incident ({t_start} - {t_end}): Power factor dropped to {min_pf:.2f} "
                f"while drawing {avg_kw:.2f} kW ({avg_kvar:.2f} kVAR). Typical signature of First Floor Lab 3.0 kW motor operation without power factor correction."
            )
            upsert("anomaly_episodes", anomaly_text, {
                "timestamp": t_start,
                "type": "low_power_factor_episode",
                "severity": "MEDIUM",
                "min_pf": min_pf
            })
            anomaly_count += 1
        elif max(kw_vals) > 3.8:
            anomaly_text = (
                f"Historical Peak Demand Spike ({t_start} - {t_end}): Active load spiked to {max(kw_vals):.2f} kW "
                f"({max_cur:.1f} A), utilizing over 85% of total 4.60 kW substation capacity."
            )
            upsert("anomaly_episodes", anomaly_text, {
                "timestamp": t_start,
                "type": "peak_demand_spike",
                "severity": "HIGH",
                "peak_kw": max(kw_vals)
            })
            anomaly_count += 1

    print(f"[COMPLETE] Advanced Ingestion Finished:")
    print(f"   • {len(rules)} Domain Knowledge Rules")
    print(f"   • {temporal_chunks_count} Multi-Point Temporal Window Chunks")
    print(f"   • {anomaly_count} Contextual Anomaly Episodes Indexed in Qdrant.")

if __name__ == "__main__":
    seed_historical_data()

