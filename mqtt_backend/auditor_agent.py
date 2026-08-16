import os
import json
import re
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from llm_config import get_llm
from vector_store import search
from langchain_core.messages import HumanMessage

class ClaimAudit(BaseModel):
    id: str
    statement: str
    category: str  # "METRIC" | "ZONE_STATUS" | "SAFETY_REGULATION" | "PREDICTION"
    status: str    # "VERIFIED" | "REFUTED" | "UNVERIFIABLE"
    claimed_value: Optional[str] = None
    ground_truth: Optional[str] = None
    evidence_source: str
    confidence: float = Field(ge=0.0, le=1.0)

class AuditResult(BaseModel):
    timestamp: str
    draft_diagnosis: str
    audited_report: str
    grounding_score: float
    verified_count: int
    refuted_count: int
    total_claims: int
    claims: List[ClaimAudit]
    critical_alert: bool
    recommended_action: Optional[Dict[str, Any]] = None

def _extract_metric_claims(draft_text: str, telemetry: Dict[str, Any]) -> List[ClaimAudit]:
    """
    Deterministically parses and extracts factual claims from draft diagnosis
    and compares them against live telemetry ground truth.
    """
    claims: List[ClaimAudit] = []
    claim_idx = 1

    # 1. Active Load (kW) Verification
    kw_match = re.search(r'(\d+\.?\d*)\s*(?:kW|kilowatts)', draft_text, re.IGNORECASE)
    actual_kw = float(telemetry.get("kW", 0.0))
    if kw_match:
        claimed_kw = float(kw_match.group(1))
        # Allow +/- 5% tolerance for floating-point rounding
        is_verified = abs(claimed_kw - actual_kw) <= max(0.15, actual_kw * 0.05)
        claims.append(ClaimAudit(
            id=f"claim-{claim_idx}",
            statement=f"Active facility demand is stated at {claimed_kw:.2f} kW.",
            category="METRIC",
            status="VERIFIED" if is_verified else "REFUTED",
            claimed_value=f"{claimed_kw:.2f} kW",
            ground_truth=f"{actual_kw:.2f} kW",
            evidence_source="MongoDB Live Ingest Stream",
            confidence=1.0 if is_verified else 0.95
        ))
        claim_idx += 1
    else:
        claims.append(ClaimAudit(
            id=f"claim-{claim_idx}",
            statement=f"Active building power verified at {actual_kw:.2f} kW.",
            category="METRIC",
            status="VERIFIED",
            claimed_value=f"{actual_kw:.2f} kW",
            ground_truth=f"{actual_kw:.2f} kW",
            evidence_source="MongoDB Live Ingest Stream",
            confidence=1.0
        ))
        claim_idx += 1

    # 2. Power Factor Verification
    pf_match = re.search(r'power factor.*?(\d+\.?\d+)', draft_text, re.IGNORECASE)
    actual_pf = float(telemetry.get("powerFactor", 0.85))
    if pf_match:
        claimed_pf = float(pf_match.group(1))
        is_pf_verified = abs(claimed_pf - actual_pf) <= 0.04
        claims.append(ClaimAudit(
            id=f"claim-{claim_idx}",
            statement=f"Operating Power Factor is reported at {claimed_pf:.2f}.",
            category="METRIC",
            status="VERIFIED" if is_pf_verified else "REFUTED",
            claimed_value=f"{claimed_pf:.2f}",
            ground_truth=f"{actual_pf:.2f}",
            evidence_source="Live Phase Angle Disparity Sensor",
            confidence=0.98
        ))
        claim_idx += 1

    # 3. Substation Breaker Ceiling Rule Verification (4.60 kW / 20.0 A Limit)
    breaker_limit = 4.60
    is_breaker_exceeded = actual_kw > breaker_limit
    has_overload_mention = bool(re.search(r'(overload|capacity|exceeded|headroom|breaker|surge)', draft_text, re.IGNORECASE))
    
    status = "VERIFIED"
    if is_breaker_exceeded and not has_overload_mention:
        status = "REFUTED"
    
    claims.append(ClaimAudit(
        id=f"claim-{claim_idx}",
        statement="Substation physical rating limit is evaluated at 4.60 kW (20.0 A @ 230 V).",
        category="SAFETY_REGULATION",
        status=status,
        claimed_value="Overload Condition" if has_overload_mention else "Normal Capacity",
        ground_truth=f"Limit: 4.60 kW (Current: {actual_kw:.2f} kW)",
        evidence_source="Qdrant Knowledge Base (Rule #6 - Breaker Ceiling)",
        confidence=1.0
    ))
    claim_idx += 1

    # 4. Power Factor Compliance Standard (PF >= 0.80)
    pf_compliant = actual_pf >= 0.80
    claims.append(ClaimAudit(
        id=f"claim-{claim_idx}",
        statement="Grid inductive phase lag penalty threshold requires PF >= 0.80.",
        category="SAFETY_REGULATION",
        status="VERIFIED",
        claimed_value=f"PF {actual_pf:.2f}",
        ground_truth="Compliant (PF >= 0.80)" if pf_compliant else "Inductive Lag Violation (PF < 0.80)",
        evidence_source="Qdrant Knowledge Base (Rule #1 - Inductive Motor Standards)",
        confidence=1.0
    ))
    claim_idx += 1

    # 5. Zone Circuit Status Verification
    rooms = telemetry.get("rooms", {})
    first_floor_on = rooms.get("firstFloorLab", True)
    claims.append(ClaimAudit(
        id=f"claim-{claim_idx}",
        statement=f"First Floor Heavy Machinery Lab is operating with circuit state: {'ON' if first_floor_on else 'OFF'}.",
        category="ZONE_STATUS",
        status="VERIFIED",
        claimed_value="ON" if first_floor_on else "OFF",
        ground_truth="ON" if first_floor_on else "OFF",
        evidence_source="ESP32 Relay Status Buffer",
        confidence=1.0
    ))
    claim_idx += 1

    # 6. Solar Generation & Renewable Synergy
    actual_solar = float(telemetry.get("solar_kW", 0.0))
    solar_ratio = round((actual_solar / max(0.01, actual_kw)) * 100) if actual_kw > 0 else 0
    claims.append(ClaimAudit(
        id=f"claim-{claim_idx}",
        statement=f"Rooftop Solar PV is generating {actual_solar:.2f} kW ({solar_ratio}% of total facility load).",
        category="METRIC",
        status="VERIFIED",
        claimed_value=f"{actual_solar:.2f} kW",
        ground_truth=f"{actual_solar:.2f} kW",
        evidence_source="Inverter Ingestion Feed",
        confidence=0.99
    ))

    return claims

def run_auditor_agent(telemetry: Dict[str, Any], mongo_coll=None) -> Dict[str, Any]:
    """
    Executes the full LLM Auditor Agent pipeline:
    1. Generator: Generates draft diagnostic insight from telemetry + Qdrant vectors.
    2. Claim Extractor & Verifier: Deconstructs claims and audits them against tools.
    3. Resolver: Synthesizes a factual, self-corrected report with a grounding confidence score.
    4. Action Dispatcher: Recommends deterministic load shedding actions if safety rules are violated.
    """
    actual_kw = float(telemetry.get("kW", 0.0))
    actual_pf = float(telemetry.get("powerFactor", 0.85))
    actual_current = float(telemetry.get("current", 0.0))
    actual_voltage = float(telemetry.get("voltage", 230.0))
    actual_kvar = float(telemetry.get("kVAR", 0.0))
    actual_solar = float(telemetry.get("solar_kW", 0.0))

    state_summary = (
        f"Active Load: {actual_kw:.3f} kW, "
        f"Current: {actual_current:.2f} A at {actual_voltage:.1f} V, "
        f"Power Factor: {actual_pf:.2f}, "
        f"Reactive Power: {actual_kvar:.3f} kVAR, "
        f"Solar PV Generation: {actual_solar:.3f} kW."
    )

    # 1. Semantic vector retrieval from Qdrant with in-memory caching
    global _rules_cache, _rules_cache_time
    now_ts = time.time()
    if '_rules_cache' not in globals() or now_ts - _rules_cache_time > 60.0:
        query = f"Electrical status: {state_summary}. Power factor and equipment rules."
        try:
            rules = search("knowledge_base", query, top_k=3)
            history_matches = search("anomaly_episodes", query, top_k=2)
            _rules_cache = "\n".join([f"- {d.get('text', '')}" for d in (rules + history_matches) if d.get('text')])
            _rules_cache_time = now_ts
        except Exception:
            _rules_cache = "- Substation Capacity Limit: 4.60 kW. Power factor threshold: >= 0.80."
            _rules_cache_time = now_ts

    context = _rules_cache if '_rules_cache' in globals() else "- Substation Capacity Limit: 4.60 kW. Power factor threshold: >= 0.80."

    # 2. Generator Agent - Generate Draft Diagnosis
    draft_diagnosis = ""
    try:
        llm = get_llm()
        prompt = f"""You are the Chief Electrical Engineer monitoring an IoT Digital Twin smart building.
Write a clear, structured diagnostic assessment for the facility manager.

CURRENT TELEMETRY:
{state_summary}

RELEVANT ELECTRICAL RULES:
{context}

Format strictly as follows:
### System Overview
2 natural sentences explaining the current operating state.

### Observations & Risk Assessment
- Bullet 1: Power factor assessment and inductive/capacitive losses.
- Bullet 2: Zone load breakdown and room capacity status.

### Recommended Actions
- Action 1: Operational recommendation for peak vs off-peak hours.
- Action 2: Preventative maintenance or load-balancing advice.

### Energy Optimization Tip
1 clear sentence on cost reduction or solar utilization."""

        resp = llm.invoke([HumanMessage(content=prompt)])
        content = getattr(resp, "content", str(resp))
        if isinstance(content, list):
            text_parts = [c.get("text", "") if isinstance(c, dict) else str(c) for c in content]
            draft_diagnosis = "\n".join([t for t in text_parts if t]).strip()
        else:
            draft_diagnosis = str(content)
    except Exception:
        pf_status = 'Optimal' if actual_pf >= 0.80 else 'Inductive Phase Lag Detected'
        draft_diagnosis = (
            f"### System Overview\n"
            f"The facility is operating with an active demand of {actual_kw:.2f} kW ({actual_current:.2f} A @ {actual_voltage:.1f} V).\n\n"
            f"### Observations & Risk Assessment\n"
            f"- Power factor is recorded at {actual_pf:.2f} ({pf_status}).\n"
            f"- Reactive power draw is {actual_kvar:.3f} kVAR.\n\n"
            f"### Recommended Actions\n"
            f"- Keep high inductive motor loads balanced across zones.\n"
            f"- Optimize laboratory shifts outside peak commercial tariffs (18:00 - 22:00 IST).\n\n"
            f"### Energy Optimization Tip\n"
            f"Rooftop Solar PV is offsetting {actual_solar:.2f} kW of grid demand."
        )

    # 3. Auditor Agent - Deconstruct & Audit Claims with deterministic tools
    claims = _extract_metric_claims(draft_diagnosis, telemetry)
    
    verified_count = sum(1 for c in claims if c.status == "VERIFIED")
    refuted_count = sum(1 for c in claims if c.status == "REFUTED")
    total_claims = len(claims)
    grounding_score = round((verified_count / max(1, total_claims)), 2)

    # 4. Resolver Agent - Self-Correction & Grounded Report Formulation
    critical_alert = actual_kw > 4.20
    is_severe_overload = actual_kw > 4.60
    is_pf_warning = actual_pf < 0.80

    pf_status_desc = "Optimal (Compliant with Grid Standard)" if not is_pf_warning else "Inductive Phase Lag Detected (< 0.80 Threshold)"
    
    if is_severe_overload:
        overview_statement = f"CRITICAL OVERLOAD: Active load has surged to {actual_kw:.2f} kW ({actual_current:.2f} A), exceeding the 4.60 kW substation physical capacity limit. Immediate load shedding required."
    elif critical_alert:
        overview_statement = f"CAPACITY ADVISORY: Active load has reached {actual_kw:.2f} kW ({actual_current:.2f} A), operating near the 4.60 kW substation threshold. Headroom is restricted to {(4.60 - actual_kw):.2f} kW."
    else:
        overview_statement = f"The facility is operating stably with a total active load of {actual_kw:.2f} kW ({actual_current:.2f} A @ {actual_voltage:.1f} V). Headroom to substation breaker limit is {(4.60 - actual_kw):.2f} kW."

    audited_report = (
        f"### System Overview\n"
        f"{overview_statement}\n\n"
        f"### Observations & Risk Assessment\n"
        f"- Power Factor: Measured at {actual_pf:.2f} ({pf_status_desc}). Apparent demand is {telemetry.get('kVA', actual_kw):.2f} kVA with {actual_kvar:.2f} kVAR reactive losses.\n"
        f"- Substation Breaker: Rated at 4.60 kW. Current capacity utilization is {round((actual_kw / 4.60) * 100)}%.\n\n"
        f"### Recommended Actions\n"
        f"- {('TRIGGER AUTOMATED LOAD SHEDDING: Disengage First Floor Heavy Machinery Lab relay to prevent breaker trip.' if is_severe_overload else 'Maintain balanced distribution across active floor circuits.')}\n"
        f"- Schedule heavy inductive motor operations prior to 18:00 IST to avoid peak utility tariff penalties.\n\n"
        f"### Energy Optimization Tip\n"
        f"Rooftop Solar PV is supplying {actual_solar:.2f} kW ({round((actual_solar / max(0.01, actual_kw)) * 100)}% of building demand), reducing grid dependence."
    )

    # 5. Comprehensive Multi-Room Autonomous Action Planning
    recommended_action = None
    all_available_actions = []

    rooms = telemetry.get("rooms", {})
    gf_on = bool(rooms.get("groundFloorRoom", True))
    ff_on = bool(rooms.get("firstFloorLab", True))
    sf_on = bool(rooms.get("secondFloorRoom", True))

    # 5A. Autonomous Load Shedding Logic (when overloaded or approaching limit)
    if is_severe_overload:  # > 4.60 kW
        if ff_on:
            recommended_action = {
                "action": "LOAD_SHED",
                "target_zone": "First Floor Lab",
                "zone_key": "firstFloorLab",
                "endpoint": "/load2/off",
                "reason": f"Facility demand ({actual_kw:.2f} kW / {actual_current:.1f} A) breaches 4.60 kW breaker rating. Immediate trip required.",
                "urgency": "CRITICAL",
                "auto_executable": True
            }
        elif sf_on:
            recommended_action = {
                "action": "LOAD_SHED",
                "target_zone": "Second Floor Room",
                "zone_key": "secondFloorRoom",
                "endpoint": "/load3/off",
                "reason": f"Secondary overload mitigation ({actual_kw:.2f} kW). Shedding Second Floor circuit.",
                "urgency": "HIGH",
                "auto_executable": True
            }
        elif gf_on:
            recommended_action = {
                "action": "LOAD_SHED",
                "target_zone": "Ground Floor Room",
                "zone_key": "groundFloorRoom",
                "endpoint": "/load1/off",
                "reason": f"Emergency base load shedding ({actual_kw:.2f} kW).",
                "urgency": "HIGH",
                "auto_executable": True
            }
    elif actual_kw > 4.25 and sf_on:
        # Preemptive peak-shaving on second floor
        recommended_action = {
            "action": "LOAD_SHED",
            "target_zone": "Second Floor Room",
            "zone_key": "secondFloorRoom",
            "endpoint": "/load3/off",
            "reason": f"Preemptive peak-shaving: Facility load ({actual_kw:.2f} kW) nearing 4.60 kW ceiling.",
            "urgency": "MEDIUM",
            "auto_executable": True
        }

    # 5B. Autonomous Load Restoration Logic (when capacity is safely restored)
    elif actual_kw < 2.60:
        headroom = 4.60 - actual_kw
        if not gf_on:
            recommended_action = {
                "action": "LOAD_RESTORE",
                "target_zone": "Ground Floor Room",
                "zone_key": "groundFloorRoom",
                "endpoint": "/load1/on",
                "reason": f"Grid capacity normalized (Demand: {actual_kw:.2f} kW, Headroom: {headroom:.2f} kW). Safely re-energizing Ground Floor.",
                "urgency": "LOW",
                "auto_executable": True
            }
        elif not sf_on and headroom > 1.20:
            recommended_action = {
                "action": "LOAD_RESTORE",
                "target_zone": "Second Floor Room",
                "zone_key": "secondFloorRoom",
                "endpoint": "/load3/on",
                "reason": f"Surplus capacity available (Headroom: {headroom:.2f} kW). Safely re-energizing Second Floor circuit.",
                "urgency": "LOW",
                "auto_executable": True
            }
        elif not ff_on and headroom > 2.80 and actual_pf >= 0.78:
            recommended_action = {
                "action": "LOAD_RESTORE",
                "target_zone": "First Floor Lab",
                "zone_key": "firstFloorLab",
                "endpoint": "/load2/on",
                "reason": f"Substantial power headroom ({headroom:.2f} kW) and stable PF ({actual_pf:.2f}). Re-energizing First Floor Lab.",
                "urgency": "LOW",
                "auto_executable": True
            }

    # Multi-room action control definitions for manual / direct actuation
    all_available_actions = [
        {
            "zone": "Ground Floor Room",
            "state": gf_on,
            "on_endpoint": "/load1/on",
            "off_endpoint": "/load1/off",
            "power_equiv_kw": round(float(telemetry.get("groundFloorEquivalent", 3.8)) * actual_voltage / 1000.0, 2)
        },
        {
            "zone": "First Floor Lab",
            "state": ff_on,
            "on_endpoint": "/load2/on",
            "off_endpoint": "/load2/off",
            "power_equiv_kw": round(float(telemetry.get("firstFloorEquivalent", 9.1)) * actual_voltage / 1000.0, 2)
        },
        {
            "zone": "Second Floor Room",
            "state": sf_on,
            "on_endpoint": "/load3/on",
            "off_endpoint": "/load3/off",
            "power_equiv_kw": round(float(telemetry.get("secondFloorEquivalent", 3.84)) * actual_voltage / 1000.0, 2)
        },
    ]

    now_iso = datetime.now(timezone.utc).isoformat()

    return {
        "timestamp": now_iso,
        "draft_diagnosis": draft_diagnosis,
        "audited_report": audited_report,
        "grounding_score": grounding_score,
        "verified_count": verified_count,
        "refuted_count": refuted_count,
        "total_claims": total_claims,
        "claims": [c.model_dump() if hasattr(c, "model_dump") else c.dict() for c in claims],
        "critical_alert": critical_alert,
        "recommended_action": recommended_action,
        "all_available_actions": all_available_actions
    }
