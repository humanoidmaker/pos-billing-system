import asyncio, sys, random
from datetime import datetime, timezone, timedelta
sys.path.insert(0, ".")
from app.core.database import init_db, get_db

CATEGORIES = ["Groceries", "Beverages", "Snacks", "Dairy", "Personal Care"]
PRODUCTS = [
    ("Basmati Rice 1kg", "GR001", "Groceries", 120, 90), ("Whole Wheat Flour 5kg", "GR002", "Groceries", 249, 200),
    ("Sunflower Oil 1L", "GR003", "Groceries", 159, 130), ("Sugar 1kg", "GR004", "Groceries", 48, 38),
    ("Salt 1kg", "GR005", "Groceries", 25, 18), ("Turmeric Powder 200g", "GR006", "Groceries", 65, 45),
    ("Tea Leaves 500g", "BV001", "Beverages", 199, 150), ("Instant Coffee 100g", "BV002", "Beverages", 349, 280),
    ("Mango Juice 1L", "BV003", "Beverages", 89, 65), ("Mineral Water 1L", "BV004", "Beverages", 20, 12),
    ("Lemon Soda 300ml", "BV005", "Beverages", 30, 18), ("Green Tea 25bags", "BV006", "Beverages", 149, 100),
    ("Potato Chips 100g", "SN001", "Snacks", 40, 28), ("Biscuit Pack 200g", "SN002", "Snacks", 35, 22),
    ("Namkeen Mix 400g", "SN003", "Snacks", 99, 70), ("Chocolate Bar 50g", "SN004", "Snacks", 45, 30),
    ("Peanut Butter 250g", "SN005", "Snacks", 199, 150), ("Roasted Cashews 200g", "SN006", "Snacks", 299, 220),
    ("Full Cream Milk 500ml", "DA001", "Dairy", 30, 24), ("Curd 400g", "DA002", "Dairy", 40, 30),
    ("Butter 100g", "DA003", "Dairy", 55, 42), ("Cheese Slice 200g", "DA004", "Dairy", 120, 90),
    ("Paneer 200g", "DA005", "Dairy", 80, 60), ("Cream 200ml", "DA006", "Dairy", 65, 48),
    ("Soap Bar 100g", "PC001", "Personal Care", 45, 30), ("Shampoo 200ml", "PC002", "Personal Care", 149, 100),
    ("Toothpaste 100g", "PC003", "Personal Care", 89, 60), ("Hand Wash 250ml", "PC004", "Personal Care", 99, 65),
    ("Face Wash 100ml", "PC005", "Personal Care", 179, 120), ("Body Lotion 200ml", "PC006", "Personal Care", 249, 170),
]

async def seed():
    await init_db()
    db = await get_db()
    if await db.products.count_documents({}) > 0:
        print("Data exists"); return

    for cat in CATEGORIES:
        await db.categories.insert_one({"name": cat, "slug": cat.lower().replace(" ", "-")})

    for name, sku, cat, price, cost in PRODUCTS:
        await db.products.insert_one({
            "name": name, "sku": sku, "barcode": f"890{sku.replace(chr(0x0), '')}", "category": cat,
            "price": price, "cost_price": cost, "tax_rate": 18 if cat != "Dairy" else 5,
            "stock": random.randint(20, 200), "min_stock": 10, "unit": "pcs",
            "is_active": True,
        })

    now = datetime.now(timezone.utc)
    admin = await db.users.find_one({"role": "admin"})
    admin_id = admin["_id"] if admin else None
    for i in range(25):
        day_offset = random.randint(0, 6)
        items = []
        for _ in range(random.randint(1, 5)):
            p = random.choice(PRODUCTS)
            qty = random.randint(1, 3)
            tax = round(p[3] * qty * (18 if p[2] != "Dairy" else 5) / 100, 2)
            items.append({"name": p[0], "sku": p[1], "quantity": qty, "price": p[3], "discount": 0, "tax": tax, "total": round(p[3] * qty + tax, 2)})
        subtotal = sum(i["price"] * i["quantity"] for i in items)
        total_tax = sum(i["tax"] for i in items)
        await db.bills.insert_one({
            "bill_number": f"BI-{(now - timedelta(days=day_offset)).strftime(chr(37)+'Y'+chr(37)+'m'+chr(37)+'d')}-{1000+i}",
            "items": items, "subtotal": subtotal, "total_discount": 0, "total_tax": total_tax,
            "grand_total": round(subtotal + total_tax, 2), "payment_method": random.choice(["cash", "upi", "card"]),
            "payment_status": "paid", "cashier_id": admin_id, "cashier_name": "Admin",
            "created_at": now - timedelta(days=day_offset, hours=random.randint(0, 10)),
        })

    print(f"Seeded: {len(CATEGORIES)} categories, {len(PRODUCTS)} products, 25 bills")

asyncio.run(seed())
