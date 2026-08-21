VERSION = "0003"
NAME = "family_circles"


async def upgrade(db) -> None:
    """Create collections and indexes that power the Family Circle location sharing feature."""
    await db.family_circles.create_index("id", unique=True)
    await db.family_circles.create_index("invite_code", unique=True)
    await db.family_circles.create_index("owner_id")
    await db.circle_members.create_index([("circle_id", 1), ("user_id", 1)], unique=True)
    await db.circle_members.create_index("user_id")
    await db.circle_locations.create_index([("circle_id", 1), ("user_id", 1)], unique=True)
    await db.circle_locations.create_index([("location", "2dsphere")])
