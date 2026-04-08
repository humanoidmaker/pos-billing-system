from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
from app.core.database import get_db
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/customers", tags=["customers"])

def s(doc):
    if doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/")
async def list_customers(q: str = "", db=Depends(get_db)):
    f = {}
    if q:
        f["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.customers.find(f).sort("name", 1).to_list(500)
    return {"success": True, "customers": [s(d) for d in docs]}

@router.get("/search")
async def search_customers(q: str, db=Depends(get_db)):
    f = {"$or": [
        {"name": {"$regex": q, "$options": "i"}},
        {"phone": {"$regex": q, "$options": "i"}},
    ]}
    docs = await db.customers.find(f).limit(20).to_list(20)
    return {"success": True, "customers": [s(d) for d in docs]}

@router.get("/phone/{phone}")
async def get_by_phone(phone: str, db=Depends(get_db)):
    doc = await db.customers.find_one({"phone": phone})
    if not doc:
        raise HTTPException(404, "Customer not found")
    return {"success": True, "customer": s(doc)}

@router.get("/{cid}")
async def get_customer(cid: str, db=Depends(get_db)):
    doc = await db.customers.find_one({"_id": ObjectId(cid)})
    if not doc:
        raise HTTPException(404, "Customer not found")
    return {"success": True, "customer": s(doc)}

@router.post("/")
async def create_customer(data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    name = data.get("name", "").strip()
    phone = data.get("phone", "").strip()
    if not name or not phone:
        raise HTTPException(400, "Name and phone are required")
    if await db.customers.find_one({"phone": phone}):
        raise HTTPException(400, "Customer with this phone already exists")
    doc = {
        "name": name,
        "phone": phone,
        "email": data.get("email", ""),
        "loyalty_points": 0,
        "total_purchases": 0,
        "created_at": datetime.now(timezone.utc),
    }
    r = await db.customers.insert_one(doc)
    return {"success": True, "id": str(r.inserted_id)}

@router.put("/{cid}")
async def update_customer(cid: str, data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    data.pop("id", None)
    data.pop("_id", None)
    await db.customers.update_one({"_id": ObjectId(cid)}, {"$set": data})
    return {"success": True}
