import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

connect_args = {}
engine_kwargs = {}

# SQLite only
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL production settings
    # pool_size: Number of persistent connections to keep
    # max_overflow: Additional connections allowed when pool is exhausted
    # Total max connections = pool_size + max_overflow = 50
    engine_kwargs = {
        "pool_size": int(os.getenv("DB_POOL_SIZE", "20")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "30")),
        "pool_pre_ping": True,  # Detect and recycle stale connections
        "pool_recycle": 300,  # Recycle connections after 5 minutes
        "pool_timeout": 30,  # Timeout waiting for connection from pool
    }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()
