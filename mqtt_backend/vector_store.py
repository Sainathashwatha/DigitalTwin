import os
import uuid
import socket
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from dotenv import load_dotenv

load_dotenv()

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

COLLECTIONS = [
    "load_readings",
    "anomaly_episodes",
    "knowledge_base"
]

_client = None

def is_qdrant_online() -> bool:
    try:
        host = "127.0.0.1" if QDRANT_HOST in ["localhost", "127.0.0.1"] else QDRANT_HOST
        with socket.create_connection((host, QDRANT_PORT), timeout=0.1):
            return True
    except Exception:
        return False

def get_client():
    global _client
    if _client is None:
        _client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, prefer_grpc=False, timeout=1.5)
    return _client

def init_collections(dim: int = 384):
    """Ensure all required collections exist in Qdrant with 384-dim Cosine configuration."""
    if not is_qdrant_online():
        return
    try:
        client = get_client()
        existing = [c.name for c in client.get_collections().collections]
        for col in COLLECTIONS:
            if col not in existing:
                client.create_collection(
                    collection_name=col,
                    vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
                )
                print(f"[INFO] Created Qdrant collection: {col}")
    except Exception as e:
        print(f"[WARN] Qdrant collection init check: {e}")

def upsert(collection: str, text: str, metadata: dict):
    """Embed and store a document in Qdrant."""
    if not is_qdrant_online():
        return
    try:
        from embedder import embed
        client = get_client()
        vector = embed(text)
        point_id = str(uuid.uuid4())
        payload = {**metadata, "text": text}
        client.upsert(
            collection_name=collection,
            points=[PointStruct(id=point_id, vector=vector, payload=payload)]
        )
    except Exception:
        pass

def search(collection: str, query: str, top_k: int = 5, min_score: float = 0.40) -> list[dict]:
    """
    Semantic vector search over a specific collection with score thresholding
    to eliminate irrelevant low-confidence context.
    """
    if not is_qdrant_online():
        return []

    try:
        from embedder import embed
        client = get_client()
        vector = embed(query, is_query=True)
        if hasattr(client, "query_points"):
            response = client.query_points(
                collection_name=collection,
                query=vector,
                limit=top_k,
                score_threshold=min_score
            )
            points = response.points
        else:
            points = client.search(
                collection_name=collection,
                query_vector=vector,
                limit=top_k,
                score_threshold=min_score
            )
        return [
            {**p.payload, "score": getattr(p, "score", 1.0)}
            for p in points
            if getattr(p, "score", 1.0) >= min_score
        ]
    except Exception:
        return []
