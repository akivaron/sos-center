from datetime import datetime, timezone

from . import m0001_init_schema, m0002_password_auth, m0003_family_circles, m0004_followers_notifications, m0005_donation_campaigns

MIGRATIONS = [m0001_init_schema, m0002_password_auth, m0003_family_circles, m0004_followers_notifications, m0005_donation_campaigns]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def run_migrations(db) -> list[str]:
    """Run all pending migrations in order. Idempotent via a tracking collection."""
    applied: set[str] = {
        doc["version"] async for doc in db.migrations.find({}, {"_id": 0, "version": 1})
    }
    done: list[str] = []
    for migration in MIGRATIONS:
        if migration.VERSION in applied:
            continue
        await migration.upgrade(db)
        await db.migrations.update_one(
            {"version": migration.VERSION},
            {"$set": {
                "version": migration.VERSION,
                "name": migration.NAME,
                "applied_at": _utc_now(),
            }},
            upsert=True,
        )
        done.append(migration.NAME)
    return done
