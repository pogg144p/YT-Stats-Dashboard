"""Database configuration and session management."""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

# On Render, the working directory is read-only — use /tmp for SQLite.
# Locally on Windows, fall back to the project directory.
_default_db = (
    "sqlite:////tmp/yt_stats.db"
    if os.name != "nt"  # nt = Windows
    else "sqlite:///./yt_stats.db"
)
DATABASE_URL = os.environ.get("DATABASE_URL", _default_db)

engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Get database session for dependency injection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
