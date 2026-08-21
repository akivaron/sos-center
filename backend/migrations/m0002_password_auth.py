VERSION = "0002"
NAME = "password_auth"


async def upgrade(db) -> None:
    """Support email/password authentication.

    OAuth users created earlier have no password_hash. This migration adds a
    sparse index so password-based accounts can be looked up efficiently and
    ensures the schema tolerates both auth methods.
    """
    await db.users.create_index("password_hash", sparse=True)
    await db.user_sessions.create_index("user_id")
