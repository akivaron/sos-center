VERSION = "0004"
NAME = "followers_notifications"


async def upgrade(db) -> None:
    """Add follower tracking on incidents and the per-user notification inbox."""
    await db.notifications.create_index("id", unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.incidents.create_index("followers")
