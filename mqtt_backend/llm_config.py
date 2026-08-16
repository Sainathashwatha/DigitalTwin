import os
import socket
import urllib.parse
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama
from dotenv import load_dotenv

load_dotenv()

def _is_server_online(url: str, timeout: float = 0.2) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        host = parsed.hostname or "127.0.0.1"
        if host == "localhost":
            host = "127.0.0.1"
        port = parsed.port or (80 if parsed.scheme == "http" else 11434)
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def get_llm(prefer_local: bool = None):
    """
    Returns an initialized LLM:
    - If USE_LOCAL_LLM=true in .env or prefer_local=True and Ollama server is running -> ChatOllama
    - Otherwise if GOOGLE_API_KEY is present -> Gemini Flash
    - Falls back gracefully to deterministic rule synthesis when offline.
    """
    use_local = prefer_local if prefer_local is not None else os.getenv("USE_LOCAL_LLM", "false").lower() == "true"
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    if use_local and _is_server_online(ollama_url, timeout=0.3):
        ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
        return ChatOllama(
            model=ollama_model,
            base_url=ollama_url,
            temperature=0.2,
        )

    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.2,
        )

    raise ConnectionError("No live LLM server (Ollama or Gemini API key) available. Using deterministic synthesis.")
