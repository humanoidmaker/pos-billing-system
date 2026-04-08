from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = None
db = None

async def get_db():
    return db

async def init_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_name = settings.MONGODB_URI.rsplit("/", 1)[-1].split("?")[0] or "pos_billing"
    db = client[db_name]
    await db.products.create_index("sku", unique=True)
    await db.products.create_index("barcode")
    await db.bills.create_index("bill_number", unique=True)
    await db.customers.create_index("phone", unique=True, sparse=True)
    await db.categories.create_index("slug", unique=True)
    if not await db.settings.find_one({"key": "store_name"}):
        await db.settings.insert_many([
            {"key": "store_name", "value": "QuickBill Store"},
            {"key": "store_address", "value": "123 Market Street"},
            {"key": "store_phone", "value": "+91 98765 43210"},
            {"key": "gstin", "value": ""},
            {"key": "currency", "value": "INR"},
            {"key": "tax_rate", "value": "18"},
            {"key": "receipt_footer", "value": "Thank you for shopping!"},
        ])

    # Email settings defaults
    email_defaults = [
        {"key": "smtp_host", "value": ""},
        {"key": "smtp_port", "value": "587"},
        {"key": "smtp_user", "value": ""},
        {"key": "smtp_pass", "value": ""},
        {"key": "smtp_from", "value": ""},
        {"key": "email_verification_enabled", "value": "true"},
        {"key": "email_welcome_enabled", "value": "true"},
        {"key": "email_password_reset_enabled", "value": "true"},
        {"key": "email_password_changed_enabled", "value": "true"},
        {"key": "require_email_verification", "value": "false"},
    ]
    for d in email_defaults:
        await db.settings.update_one({"key": d["key"]}, {"$setOnInsert": d}, upsert=True)

