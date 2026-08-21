VERSION = "0001"
NAME = "init_schema"


async def upgrade(db) -> None:
    """Create the core collections and indexes used by the ResQ Map API."""
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.incidents.create_index([("location", "2dsphere")])
    await db.sos_signals.create_index([("location", "2dsphere")])
    await db.sos_signals.create_index("client_event_id", unique=True)
    await db.media_files.create_index("file_id", unique=True)
