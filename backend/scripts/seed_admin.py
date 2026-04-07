import asyncio, sys
sys.path.insert(0, ".")
from app.core.database import init_db, get_db
from app.utils.auth import hash_password

async def seed():
    await init_db()
    db = await get_db()
    if await db.users.find_one({"email": "admin@store.local"}):
        print("Admin exists"); return
    await db.users.insert_one({"email": "admin@store.local", "password_hash": hash_password("admin123"), "name": "Admin", "role": "admin", "is_active": True})
    await db.users.insert_one({"email": "cashier@store.local", "password_hash": hash_password("cashier123"), "name": "Cashier", "role": "cashier", "is_active": True})
    print("Admin + Cashier created")

asyncio.run(seed())
