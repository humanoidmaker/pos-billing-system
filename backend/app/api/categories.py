from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from app.core.database import get_db
from app.utils.auth import get_current_user
import re

router = APIRouter(prefix="/api/categories", tags=["categories"])

def s(doc):
    if doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

def make_slug(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

@router.get("/")
async def list_categories(db=Depends(get_db)):
    docs = await db.categories.find().sort("name", 1).to_list(200)
    result = []
    for d in docs:
        d["product_count"] = await db.products.count_documents({"category": d["name"], "is_active": {"$ne": False}})
        result.append(s(d))
    return {"success": True, "categories": result}

@router.post("/")
async def create_category(data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    slug = data.get("slug") or make_slug(name)
    if await db.categories.find_one({"slug": slug}):
        raise HTTPException(400, "Category with this slug already exists")
    doc = {"name": name, "slug": slug, "description": data.get("description", ""), "product_count": 0}
    r = await db.categories.insert_one(doc)
    return {"success": True, "id": str(r.inserted_id)}

@router.put("/{cid}")
async def update_category(cid: str, data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    data.pop("id", None)
    data.pop("_id", None)
    if "name" in data and "slug" not in data:
        data["slug"] = make_slug(data["name"])
    await db.categories.update_one({"_id": ObjectId(cid)}, {"$set": data})
    return {"success": True}

@router.delete("/{cid}")
async def delete_category(cid: str, user=Depends(get_current_user), db=Depends(get_db)):
    cat = await db.categories.find_one({"_id": ObjectId(cid)})
    if not cat:
        raise HTTPException(404, "Category not found")
    count = await db.products.count_documents({"category": cat["name"], "is_active": {"$ne": False}})
    if count > 0:
        raise HTTPException(400, f"Cannot delete: {count} products in this category")
    await db.categories.delete_one({"_id": ObjectId(cid)})
    return {"success": True}
