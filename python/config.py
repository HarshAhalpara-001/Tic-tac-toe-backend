import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get environment variables with safe parsing
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Parse allowed origins with error handling

allowed_origins_env = os.getenv("ALLOWED_ORIGINS",)
ALLOWED_ORIGINS = json.loads(allowed_origins_env)


# WebSocket settings with safe parsing
WS_PING_INTERVAL = int(os.getenv("WS_PING_INTERVAL", "20"))
WS_PING_TIMEOUT = int(os.getenv("WS_PING_TIMEOUT", "20"))
WS_CLOSE_TIMEOUT = int(os.getenv("WS_CLOSE_TIMEOUT", "20"))

# Game settings with safe parsing
GAME_TIMEOUT = int(os.getenv("GAME_TIMEOUT", "60"))

# Debug output
if ENVIRONMENT == "development":
    print(f"Environment: {ENVIRONMENT}")
    print(f"Allowed Origins: {ALLOWED_ORIGINS}")
    print(f"Game Timeout: {GAME_TIMEOUT} seconds")
    print(f"WebSocket Settings:")
    print(f"  - Ping Interval: {WS_PING_INTERVAL}")
    print(f"  - Ping Timeout: {WS_PING_TIMEOUT}")
    print(f"  - Close Timeout: {WS_CLOSE_TIMEOUT}")
