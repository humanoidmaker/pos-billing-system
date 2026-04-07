from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
from app.core.database import get_db
from app.utils.auth import get_current_user
import random, string

router = APIRouter(prefix="/api/bills", tags=["bills"])

def s(doc):
    if doc:
        doc["id"] = str(doc.pop("_id"))
        for k in ["customer_id", "cashier_id"]:
            if k in doc and doc[k]:
                doc[k] = str(doc[k])
    return doc

@router.post("/")
async def create_bill(data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    items = data.get("items", [])
    if not items:
        raise HTTPException(400, "No items")
    subtotal = total_tax = total_discount = 0
    for item in items:
        qty = item.get("quantity", 1)
        price = item.get("price", 0)
        disc = item.get("discount", 0)
        tax_rate = item.get("tax_rate", 18)
        line = (price * qty) - disc
        tax = round(line * tax_rate / 100, 2)
        item["total"] = round(line + tax, 2)
        item["tax"] = tax
        subtotal += price * qty
        total_discount += disc
        total_tax += tax
        if "product_id" in item:
            await db.products.update_one({"_id": ObjectId(item["product_id"])}, {"$inc": {"stock": -qty}})
    now = datetime.now(timezone.utc)
    bill = {
        "bill_number": f"BI-{now.strftime(chr(37)+'Y'+chr(37)+'m'+chr(37)+'d')}-{''.join(random.choices(string.digits, k=4))}",
        "items": items, "subtotal": round(subtotal, 2), "total_discount": round(total_discount, 2),
        "total_tax": round(total_tax, 2), "grand_total": round(subtotal - total_discount + total_tax, 2),
        "payment_method": data.get("payment_method", "cash"), "payment_status": "paid",
        "cashier_id": ObjectId(user["id"]), "cashier_name": user.get("name", ""),
        "created_at": now,
    }
    r = await db.bills.insert_one(bill)
    bill["id"] = str(r.inserted_id)
    del bill["_id"]
    return {"success": True, "bill": bill}

@router.get("/")
async def list_bills(db=Depends(get_db), user=Depends(get_current_user)):
    docs = await db.bills.find().sort("created_at", -1).to_list(500)
    return {"success": True, "bills": [s(d) for d in docs]}

@router.get("/today")
async def today(db=Depends(get_db), user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    docs = await db.bills.find({"created_at": {"$gte": start}}).sort("created_at", -1).to_list(500)
    return {"success": True, "bills": [s(d) for d in docs]}

@router.get("/stats")
async def stats(db=Depends(get_db), user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    pipe = [{"$match": {"created_at": {"$gte": start}}}, {"$group": {"_id": None, "revenue": {"$sum": "$grand_total"}, "count": {"$sum": 1}}}]
    r = await db.bills.aggregate(pipe).to_list(1)
    d = r[0] if r else {"revenue": 0, "count": 0}
    tp = await db.products.count_documents({"is_active": {"$ne": False}})
    return {"success": True, "stats": {"today_revenue": d["revenue"], "today_bills": d["count"], "total_products": tp}}
