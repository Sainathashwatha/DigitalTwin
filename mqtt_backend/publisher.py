import json
import time
import ssl
import requests
import paho.mqtt.client as mqtt
from datetime import datetime, timezone
from dotenv import load_dotenv
import os

load_dotenv()

broker = os.getenv("MQTT_BROKER")
port = int(os.getenv("MQTT_PORT"))
username = os.getenv("MQTT_USERNAME")
password = os.getenv("MQTT_PASSWORD")
topic = os.getenv("MQTT_TOPIC")
esp32_url = os.getenv("ESP32_STATUS_URL")

client = mqtt.Client()
client.username_pw_set(username, password)
client.tls_set(cert_reqs=ssl.CERT_REQUIRED)

client.connect(broker, port)
client.loop_start()

print("MQTT publisher started...")

while True:
    try:
        res = requests.get(esp32_url, timeout=5)
        data = res.json()

        print("ESP32 DATA:", data)

        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "solarVoltage": data.get("solarVoltage", 0),
            "estimatedCurrent": data.get("estimatedCurrent", 0)
        }

        print("MQTT PAYLOAD:", payload)

        client.publish(topic, json.dumps(payload))

    except Exception as e:
        print("Publish error:", e)

    time.sleep(5)