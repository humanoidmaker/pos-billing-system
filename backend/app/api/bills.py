from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from app.core.database import get_db
from app.utils.auth import get_current_user
import random
import string

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
    subtotal = total_tax = total_discount = 0.0
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
    bill_number = f"BI-{now.strftime('%Y%m%d')}-{''.join(random.choices(string.digits, k=4))}"
    customer_id = None
    if data.get("customer_id"):
        customer_id = ObjectId(data["customer_id"])
        await db.customers.update_one(
            {"_id": customer_id},
            {"$inc": {"total_purchases": 1, "loyalty_points": int(round(subtotal - total_discount) / 100)}},
        )
    bill = {
        "bill_number": bill_number,
        "items": items,
        "subtotal": round(subtotal, 2),
        "total_discount": round(total_discount, 2),
        "total_tax": round(total_tax, 2),
        "grand_total": round(subtotal - total_discount + total_tax, 2),
        "payment_method": data.get("payment_method", "cash"),
        "payment_status": "paid",
        "customer_id": customer_id,
        "cashier_id": ObjectId(user["id"]),
        "cashier_name": user.get("name", ""),
        "created_at": now,
    }
    r = await db.bills.insert_one(bill)
    bill["id"] = str(r.inserted_id)
    del bill["_id"]
    if bill.get("customer_id"):
        bill["customer_id"] = str(bill["customer_id"])
    bill["cashier_id"] = str(bill["cashier_id"])
    return {"success": True, "bill": bill}

@router.get("/")
async def list_bills(date: str = "", db=Depends(get_db), user=Depends(get_current_user)):
    f = {}
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            f["created_at"] = {"$gte": d, "$lt": d + timedelta(days=1)}
        except ValueError:
            pass
    docs = await db.bills.find(f).sort("created_at", -1).to_list(500)
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
    pipe = [
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$grand_total"}, "count": {"$sum": 1}}},
    ]
    r = await db.bills.aggregate(pipe).to_list(1)
    d = r[0] if r else {"revenue": 0, "count": 0}
    tp = await db.products.count_documents({"is_active": {"$ne": False}})
    tc = await db.customers.count_documents({})
    # Last 7 days revenue
    week_ago = now - timedelta(days=7)
    week_pipe = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "revenue": {"$sum": "$grand_total"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    weekly = await db.bills.aggregate(week_pipe).to_list(7)
    # Top selling products
    top_pipe = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "qty": {"$sum": "$items.quantity"}, "revenue": {"$sum": "$items.total"}}},
        {"$sort": {"qty": -1}},
        {"$limit": 10},
    ]
    top_products = await db.bills.aggregate(top_pipe).to_list(10)
    # Recent bills
    recent = await db.bills.find().sort("created_at", -1).limit(10).to_list(10)
    return {
        "success": True,
        "stats": {
            "today_revenue": d["revenue"],
            "today_bills": d["count"],
            "total_products": tp,
            "total_customers": tc,
        },
        "weekly_revenue": [{"date": w["_id"], "revenue": w["revenue"], "count": w["count"]} for w in weekly],
        "top_products": [{"name": t["_id"], "qty": t["qty"], "revenue": t["revenue"]} for t in top_products],
        "recent_bills": [s(b) for b in recent],
    }

@router.get("/receipt/{bill_id}")
async def get_receipt(bill_id: str, db=Depends(get_db)):
    bill = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not bill:
        raise HTTPException(404, "Bill not found")
    settings_docs = await db.settings.find().to_list(20)
    cfg = {d["key"]: d["value"] for d in settings_docs}
    store_name = cfg.get("store_name", "QuickBill Store")
    store_address = cfg.get("store_address", "")
    store_phone = cfg.get("store_phone", "")
    gstin = cfg.get("gstin", "")
    footer = cfg.get("receipt_footer", "Thank you for shopping!")
    items_html = ""
    for item in bill.get("items", []):
        items_html += f"""<tr>
            <td style="padding:4px 0;border-bottom:1px dashed #ddd;">{item.get('name','Item')}</td>
            <td style="padding:4px 0;border-bottom:1px dashed #ddd;text-align:center;">{item.get('quantity',1)}</td>
            <td style="padding:4px 0;border-bottom:1px dashed #ddd;text-align:right;">&#8377;{item.get('price',0)}</td>
            <td style="padding:4px 0;border-bottom:1px dashed #ddd;text-align:right;">&#8377;{item.get('total',0)}</td>
        </tr>"""
    created = bill["created_at"].strftime("%d/%m/%Y %I:%M %p") if bill.get("created_at") else ""
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>
<style>body{{font-family:monospace;max-width:300px;margin:0 auto;padding:10px;font-size:12px;}}
.center{{text-align:center;}} table{{width:100%;border-collapse:collapse;}} hr{{border:none;border-top:1px dashed #333;}}
@media print {{ body {{margin:0;}} }}</style></head><body>
<div class="center"><h2 style="margin:0;">{store_name}</h2>
<p style="margin:2px 0;">{store_address}</p>
<p style="margin:2px 0;">Tel: {store_phone}</p>
{"<p style='margin:2px 0;'>GSTIN: "+gstin+"</p>" if gstin else ""}</div><hr>
<p><strong>Bill #:</strong> {bill['bill_number']}<br><strong>Date:</strong> {created}<br>
<strong>Cashier:</strong> {bill.get('cashier_name','')}<br><strong>Payment:</strong> {bill.get('payment_method','cash').upper()}</p><hr>
<table><thead><tr><th style="text-align:left;">Item</th><th>Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
<tbody>{items_html}</tbody></table><hr>
<table><tr><td>Subtotal</td><td style="text-align:right;">&#8377;{bill.get('subtotal',0)}</td></tr>
<tr><td>Discount</td><td style="text-align:right;">-&#8377;{bill.get('total_discount',0)}</td></tr>
<tr><td>GST</td><td style="text-align:right;">&#8377;{bill.get('total_tax',0)}</td></tr>
<tr><td><strong>Grand Total</strong></td><td style="text-align:right;"><strong>&#8377;{bill.get('grand_total',0)}</strong></td></tr></table><hr>
<p class="center">{footer}</p></body></html>"""
    return {"success": True, "html": html}

@router.get("/{bill_id}")
async def get_bill(bill_id: str, db=Depends(get_db), user=Depends(get_current_user)):
    doc = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not doc:
        raise HTTPException(404, "Bill not found")
    return {"success": True, "bill": s(doc)}
