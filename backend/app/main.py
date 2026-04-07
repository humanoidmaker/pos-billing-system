from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import init_db
from app.api import auth, products, bills, settings as settings_api

@asynccontextmanager
async def lifespan(app):
    await init_db()
    yield

app = FastAPI(title="QuickBill POS API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(bills.router)
app.include_router(settings_api.router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "QuickBill POS"}

@app.get("/api/stats")
async def stats_redirect():
    from app.core.database import get_db as gdb
    db = await gdb()
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    pipe = [{"$match": {"created_at": {"$gte": start}}}, {"$group": {"_id": None, "revenue": {"$sum": "$grand_total"}, "count": {"$sum": 1}}}]
    r = await db.bills.aggregate(pipe).to_list(1)
    d = r[0] if r else {"revenue": 0, "count": 0}
    tp = await db.products.count_documents({"is_active": {"$ne": False}})
    return {"stats": {"today_revenue": d["revenue"], "today_bills": d["count"], "total_products": tp}}
