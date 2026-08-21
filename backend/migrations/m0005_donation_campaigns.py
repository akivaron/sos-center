VERSION = "0005"
NAME = "donation_campaigns"


async def upgrade(db) -> None:
    """Indexes for donation campaigns tagged to incidents or areas."""
    await db.donation_campaigns.create_index("id", unique=True)
    await db.donation_campaigns.create_index([("location", "2dsphere")])
