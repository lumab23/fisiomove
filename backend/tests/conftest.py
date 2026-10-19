import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault(
    "AUTH_SECRET_KEY",
    "tests-only-secret-key-with-at-least-32-characters",
)
