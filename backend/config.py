from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    mongo_uri: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/specdb")
    mongo_db: str = os.getenv("MONGODB_DB", "specdb")
    admin_token: str = os.getenv("ADMIN_TOKEN", "dev-admin-token")
    cors_origins: List[str] = None
    port: int = int(os.getenv("PORT", "5000"))

    def __post_init__(self) -> None:
        origins = os.getenv("CORS_ORIGINS", "*")
        if origins == "*":
            self.cors_origins = ["*"]
        else:
            self.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]


settings = Settings()
