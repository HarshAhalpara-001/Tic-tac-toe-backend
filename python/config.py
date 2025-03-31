import os
import json
from typing import List

# Get environment variables with defaults
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ALLOWED_ORIGINS = json.loads(os.getenv("ALLOWED_ORIGINS", '["http://localhost:3000"]'))

# Configuration based on environment
if ENVIRONMENT == "production":
    # Production settings
    ALLOWED_ORIGINS = [
        "http://localhost:3000",  # Local development
        # "https://your-frontend-domain.com",  # Replace with your actual frontend URL
        # "http://your-frontend-domain.com",   # Include both http and https
    ]
else:
    # Development settings
    ALLOWED_ORIGINS = ["http://localhost:3000"]

# WebSocket settings
WS_PING_INTERVAL = 20
WS_PING_TIMEOUT = 20
WS_CLOSE_TIMEOUT = 20

# Game settings
GAME_TIMEOUT = int(os.getenv("GAME_TIMEOUT", "60"))  # seconds 