import os

_model = None

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")
    return _model

def embed(text: str, is_query: bool = False) -> list[float]:
    """
    Embed text with task-aware semantic instruction prefixes and L2 normalization
    to improve cosine similarity precision between live telemetry queries and stored chunks.
    """
    model = get_model()
    prefix = "query: " if is_query else "passage: "
    formatted_text = f"{prefix}{text.strip()}"
    return model.encode(formatted_text, normalize_embeddings=True).tolist()

def embed_batch(texts: list[str], is_query: bool = False) -> list[list[float]]:
    """Embed multiple texts in batch with task prefix."""
    if not texts:
        return []
    model = get_model()
    prefix = "query: " if is_query else "passage: "
    formatted_texts = [f"{prefix}{t.strip()}" for t in texts]
    return model.encode(formatted_texts, normalize_embeddings=True).tolist()
