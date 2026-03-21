import json
import ssl
import os
import random
import math
from datetime import datetime
import paho.mqtt.client as mqtt
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# ---------------- DATABASE ----------------
mongo_client = MongoClient(os.getenv("MONGO_URI"))
db = mongo_client[os.getenv("DB_NAME")]

load_collection = db[os.getenv("COLLECTION_NAME")]
solar_collection = db[os.getenv("SOLAR_COLLECTION")]

# ---------------- MQTT ----------------
broker = os.getenv("MQTT_BROKER")
port = int(os.getenv("MQTT_PORT"))
username = os.getenv("MQTT_USERNAME")
password = os.getenv("MQTT_PASSWORD")
topic = os.getenv("MQTT_TOPIC")

# ---------------- CONSTANTS ----------------
DEFAULT_VOLTAGE = 230.0
TIME_INTERVAL_HOURS = 5 / 3600

# ---------------- CALLBACKS ----------------
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to HiveMQ")
        client.subscribe(topic)
    else:
        print("❌ Connection failed:", rc)

def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())

        print("\n📩 MQTT RECEIVED:", data)

        # =====================================================
        # ⚡ LOAD
        # =====================================================

        current = float(data.get("estimatedCurrent", 0))

        load_kw = round((DEFAULT_VOLTAGE * current) / 1000, 3)
        load_kwh = round(load_kw * TIME_INTERVAL_HOURS, 5)

        # 🔥 NEW: Power Factor
        power_factor = round(random.uniform(0.8, 0.9), 2) if load_kw > 0 else 0

        # 🔥 NEW: Apparent Power (kVA)
        kVA = round(load_kw / power_factor, 3) if power_factor > 0 else 0

        # 🔥 NEW: Reactive Power (kVAR)
        kVAR = round(math.sqrt(kVA**2 - load_kw**2), 3) if kVA > 0 else 0

        load_doc = {
            "timestamp": datetime.utcnow(),
            "voltage": DEFAULT_VOLTAGE,
            "current": round(current, 3),

            # main
            "kW": load_kw,
            "kWh": load_kwh,

            # advanced
            "powerFactor": power_factor,
            "kVA": kVA,
            "kVAR": kVAR
        }

        load_collection.insert_one(load_doc)
        print("⚡ Load saved:", load_doc)

        # =====================================================
        # ☀️ SOLAR
        # =====================================================

        solar_voltage = float(data.get("solarVoltage", 0))
        print("🌞 Solar Voltage:", solar_voltage)

        # ⚠️ Keep your working scaling but reduce a bit
        solar_kw = round(solar_voltage * 0.5, 3)
        solar_kwh = round(solar_kw * TIME_INTERVAL_HOURS, 5)

        solar_doc = {
            "timestamp": datetime.utcnow(),
            "kW": solar_kw,
            "kWh": solar_kwh
        }

        solar_collection.insert_one(solar_doc)

        print("☀️ Solar saved:", solar_doc)
        print("📌 Writing to solar collection:", solar_collection.name)

    except Exception as e:
        print("❌ Error:", e)

# ---------------- CLIENT ----------------
client = mqtt.Client()
client.username_pw_set(username, password)
client.tls_set()

client.on_connect = on_connect
client.on_message = on_message

client.connect(broker, port)

print("🚀 Listening for MQTT data...")
client.loop_forever()