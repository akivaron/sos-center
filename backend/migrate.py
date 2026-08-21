import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from migrations import run_migrations  # noqa: E402


async def main() -> None:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    applied = await run_migrations(db)
    print("Applied migrations:", applied or "none")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
