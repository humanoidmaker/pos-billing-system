from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/products", tags=["products"])

def s(doc):
    if doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/")
async def list_products(q: str = "", category: str = "", db=Depends(get_db)):
    f = {"is_active": {"$ne": False}}
    if q:
        f["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"barcode": q},
        ]
    if category:
        f["category"] = category
    docs = await db.products.find(f).sort("name", 1).to_list(500)
    return {"success": True, "products": [s(d) for d in docs]}

@router.get("/search")
async def search(q: str, db=Depends(get_db)):
    f = {
        "is_active": {"$ne": False},
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"barcode": q},
        ],
    }
    docs = await db.products.find(f).limit(20).to_list(20)
    return {"success": True, "products": [s(d) for d in docs]}

@router.get("/barcode/{code}")
async def get_by_barcode(code: str, db=Depends(get_db)):
    doc = await db.products.find_one({"barcode": code, "is_active": {"$ne": False}})
    if not doc:
        raise HTTPException(404, "Product not found")
    return {"success": True, "product": s(doc)}

@router.get("/low-stock")
async def low_stock(db=Depends(get_db)):
    docs = await db.products.find({
        "is_active": {"$ne": False},
        "$expr": {"$lte": ["$stock", "$min_stock"]},
    }).sort("stock", 1).to_list(100)
    return {"success": True, "products": [s(d) for d in docs]}

@router.get("/{pid}")
async def get_product(pid: str, db=Depends(get_db)):
    doc = await db.products.find_one({"_id": ObjectId(pid)})
    if not doc:
        raise HTTPException(404, "Product not found")
    return {"success": True, "product": s(doc)}

@router.post("/")
async def create(data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    data.setdefault("is_active", True)
    data.setdefault("stock", 0)
    data.setdefault("min_stock", 10)
    data.setdefault("tax_rate", 18)
    data.setdefault("unit", "pcs")
    data.setdefault("image_url", "")
    data.setdefault("cost_price", 0)
    r = await db.products.insert_one(data)
    return {"success": True, "id": str(r.inserted_id)}

@router.put("/{pid}")
async def update(pid: str, data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    data.pop("id", None)
    data.pop("_id", None)
    await db.products.update_one({"_id": ObjectId(pid)}, {"$set": data})
    return {"success": True}

@router.put("/{pid}/stock")
async def adjust_stock(pid: str, data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    adjustment = data.get("adjustment", 0)
    reason = data.get("reason", "")
    await db.products.update_one({"_id": ObjectId(pid)}, {"$inc": {"stock": adjustment}})
    from datetime import datetime, timezone
    await db.stock_log.insert_one({
        "product_id": ObjectId(pid),
        "adjustment": adjustment,
        "reason": reason,
        "user_id": user["id"],
        "created_at": datetime.now(timezone.utc),
    })
    return {"success": True}

@router.delete("/{pid}")
async def delete(pid: str, user=Depends(get_current_user), db=Depends(get_db)):
    await db.products.update_one({"_id": ObjectId(pid)}, {"$set": {"is_active": False}})
    return {"success": True}
