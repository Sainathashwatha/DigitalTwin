import os
import math
import time
import random
import threading
from datetime import datetime, timezone

class BuildingSimulator:
    def __init__(self):
        # Room relay states (True = ACTIVE, False = STANDBY/OFF)
        self.rooms = {
            "ground_floor_room": True,
            "first_floor_lab": True,
            "second_floor_room": True,
        }
        self.voltage = 230.0
        self.time_step = 0
        self.kwh_counter = 14.85
        self.history = []
        self.lock = threading.Lock()
        
        # Initialize state and seed continuous history with live time labels
        self._seed_continuous_history()
        self.current_telemetry = self._calculate_telemetry()
        
        # Start the strict 5-second ticker thread
        self._start_background_ticker()

    def _calculate_telemetry(self) -> dict:
        """Calculates instantaneous telemetry based on room states and stochastic power dynamics."""
        self.time_step += 1
        now = datetime.now()
        now_utc = datetime.now(timezone.utc)

        # 1. Base wattage by room
        gf_kw = random.uniform(0.80, 1.15) if self.rooms["ground_floor_room"] else 0.02
        ff_kw = random.uniform(2.10, 2.80) if self.rooms["first_floor_lab"] else 0.04
        sf_kw = random.uniform(0.75, 1.20) if self.rooms["second_floor_room"] else 0.02

        # 2. Frequent Overload Machine (~35% chance when First Floor Lab is ACTIVE)
        roll = random.random()
        volt_var = random.uniform(-1.0, 1.0)

        if roll < 0.35 and self.rooms["first_floor_lab"]:
            # OVERLOAD SURGE: Industrial motor inrush pushing total facility load past 4.60 kW breaker limit
            ff_kw += random.uniform(1.30, 1.85)  # 1F lab reaches 3.4 - 4.6 kW
            pf = round(random.uniform(0.66, 0.74), 2)  # Low inductive power factor
            solar_kw = round(random.uniform(1.10, 1.70), 2)
            volt_var = random.uniform(-4.0, -1.5)
        elif roll < 0.70:
            # OPTIMAL STABLE
            pf = round(random.uniform(0.85, 0.94), 2)
            solar_kw = round(random.uniform(1.80, 2.60), 2)
        else:
            # MODERATE ACTIVE DYNAMICS
            if self.rooms["first_floor_lab"]:
                ff_kw += random.uniform(0.30, 0.60)
            pf = round(random.uniform(0.77, 0.83), 2)
            solar_kw = round(random.uniform(1.40, 2.10), 2)
            volt_var = random.uniform(-2.0, 2.0)

        total_kw = round(gf_kw + ff_kw + sf_kw, 2)
        actual_voltage = round(self.voltage + volt_var, 1)
        total_current = round((total_kw * 1000.0) / actual_voltage, 2)

        # Power Triangle Math: S = P / PF, Q = sqrt(S^2 - P^2)
        kva = round(total_kw / max(0.1, pf), 2)
        kvar = round(math.sqrt(max(0.0, kva**2 - total_kw**2)), 2)
        self.kwh_counter += round(total_kw * (5.0 / 3600.0), 6)

        point = {
            "timestamp": now_utc.isoformat(),
            "time_label": now.strftime("%H:%M:%S"),
            "voltage": actual_voltage,
            "current": total_current,
            "kW": total_kw,
            "powerFactor": pf,
            "kVA": kva,
            "kVAR": kvar,
            "kWh": round(self.kwh_counter, 5),
            "solar_kW": solar_kw,
            "rooms": {
                "groundFloorRoom": self.rooms["ground_floor_room"],
                "firstFloorLab": self.rooms["first_floor_lab"],
                "secondFloorRoom": self.rooms["second_floor_room"],
            },
            "groundFloorEquivalent": round((gf_kw * 1000.0) / actual_voltage, 2),
            "firstFloorEquivalent": round((ff_kw * 1000.0) / actual_voltage, 2),
            "secondFloorEquivalent": round((sf_kw * 1000.0) / actual_voltage, 2),
        }
        return point

    def _seed_continuous_history(self):
        """Generates historical continuous time points with live timestamps for initial chart rendering."""
        now_ts = time.time()
        for i in range(30, 0, -1):
            past_dt = datetime.fromtimestamp(now_ts - (i * 5))
            past_utc = datetime.fromtimestamp(now_ts - (i * 5), tz=timezone.utc).isoformat()
            gf = random.uniform(0.75, 1.10)
            ff = random.uniform(2.10, 2.80)
            sf = random.uniform(0.80, 1.15)
            total = round(gf + ff + sf, 2)
            pf = round(random.uniform(0.78, 0.90), 2)
            cur = round((total * 1000.0) / self.voltage, 2)
            kva = round(total / pf, 2)
            kvar = round(math.sqrt(max(0.0, kva**2 - total**2)), 2)

            self.history.append({
                "timestamp": past_utc,
                "time_label": past_dt.strftime("%H:%M:%S"),
                "voltage": self.voltage,
                "current": cur,
                "kW": total,
                "powerFactor": pf,
                "kVA": kva,
                "kVAR": kvar,
                "kWh": round(total * 0.001, 5),
                "solar_kW": round(random.uniform(1.4, 2.3), 2),
                "rooms": {
                    "groundFloorRoom": True,
                    "firstFloorLab": True,
                    "secondFloorRoom": True,
                },
                "groundFloorEquivalent": round((gf * 1000.0) / self.voltage, 2),
                "firstFloorEquivalent": round((ff * 1000.0) / self.voltage, 2),
                "secondFloorEquivalent": round((sf * 1000.0) / self.voltage, 2),
            })

    def _start_background_ticker(self):
        """Background daemon ticking strictly once every 5.0 seconds."""
        def tick_loop():
            while True:
                time.sleep(5.0)
                try:
                    self.step()
                except Exception:
                    pass

        t = threading.Thread(target=tick_loop, daemon=True)
        t.start()

    def step(self) -> dict:
        """Advances simulation by one 5-second interval and appends to history."""
        with self.lock:
            point = self._calculate_telemetry()
            self.current_telemetry = point
            self.history.append(point)
            if len(self.history) > 60:
                self.history.pop(0)
            return point

    def get_latest(self) -> dict:
        """Instant non-blocking fetch of the current 5-second telemetry state."""
        with self.lock:
            if not self.current_telemetry:
                self.current_telemetry = self._calculate_telemetry()
            return self.current_telemetry

    def set_room_state(self, room: str, state: bool) -> bool:
        """Immediately toggles a room circuit and recalculates the live telemetry state."""
        clean_room = room.lower().replace(" ", "_")
        with self.lock:
            if clean_room in self.rooms:
                self.rooms[clean_room] = state
                # Recalculate instantaneously
                self.current_telemetry = self._calculate_telemetry()
                self.history.append(self.current_telemetry)
                if len(self.history) > 60:
                    self.history.pop(0)
                return True
        return False

    def get_history(self, limit: int = 30) -> list:
        with self.lock:
            return list(self.history[-limit:])

simulator = BuildingSimulator()
