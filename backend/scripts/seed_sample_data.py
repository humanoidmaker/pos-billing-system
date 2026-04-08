"""Seed sample data for QuickBill POS"""
import asyncio
import sys
import random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, ".")
from app.core.database import init_db, get_db
from app.utils.auth import hash_password

CATEGORIES = [
    {"name": "Groceries", "slug": "groceries", "description": "Daily essentials and staples"},
    {"name": "Beverages", "slug": "beverages", "description": "Drinks and juices"},
    {"name": "Snacks", "slug": "snacks", "description": "Chips, biscuits and munchies"},
    {"name": "Dairy", "slug": "dairy", "description": "Milk, curd and dairy products"},
    {"name": "Personal Care", "slug": "personal-care", "description": "Soaps, shampoos and hygiene"},
]

PRODUCTS = [
    ("Toor Dal 1kg", "GRO-001", "8901001001", "Groceries", 149, 120, "kg"),
    ("Basmati Rice 5kg", "GRO-002", "8901001002", "Groceries", 399, 320, "kg"),
    ("Wheat Flour 10kg", "GRO-003", "8901001003", "Groceries", 349, 280, "kg"),
    ("Sugar 1kg", "GRO-004", "8901001004", "Groceries", 49, 38, "kg"),
    ("Mustard Oil 1L", "GRO-005", "8901001005", "Groceries", 199, 160, "L"),
    ("Salt 1kg", "GRO-006", "8901001006", "Groceries", 25, 18, "kg"),
    ("Green Tea 100g", "BEV-001", "8901002001", "Beverages", 199, 140, "pcs"),
    ("Mango Juice 1L", "BEV-002", "8901002002", "Beverages", 99, 70, "pcs"),
    ("Cola 750ml", "BEV-003", "8901002003", "Beverages", 40, 30, "pcs"),
    ("Mineral Water 1L", "BEV-004", "8901002004", "Beverages", 20, 12, "pcs"),
    ("Orange Juice 200ml", "BEV-005", "8901002005", "Beverages", 30, 20, "pcs"),
    ("Lemon Soda 300ml", "BEV-006", "8901002006", "Beverages", 25, 16, "pcs"),
    ("Potato Chips 100g", "SNK-001", "8901003001", "Snacks", 30, 20, "pcs"),
    ("Cream Biscuits 150g", "SNK-002", "8901003002", "Snacks", 25, 16, "pcs"),
    ("Namkeen Mix 200g", "SNK-003", "8901003003", "Snacks", 45, 30, "pcs"),
    ("Peanut Bar", "SNK-004", "8901003004", "Snacks", 10, 6, "pcs"),
    ("Banana Chips 150g", "SNK-005", "8901003005", "Snacks", 35, 22, "pcs"),
    ("Toast Rusk 300g", "SNK-006", "8901003006", "Snacks", 40, 28, "pcs"),
    ("Full Cream Milk 1L", "DRY-001", "8901004001", "Dairy", 68, 56, "L"),
    ("Fresh Curd 400g", "DRY-002", "8901004002", "Dairy", 45, 32, "pcs"),
    ("Paneer 200g", "DRY-003", "8901004003", "Dairy", 99, 75, "pcs"),
    ("Butter 100g", "DRY-004", "8901004004", "Dairy", 55, 42, "pcs"),
    ("Cheese Slice 10pcs", "DRY-005", "8901004005", "Dairy", 120, 90, "pcs"),
    ("Buttermilk 200ml", "DRY-006", "8901004006", "Dairy", 15, 10, "pcs"),
    ("Bath Soap 100g", "PC-001", "8901005001", "Personal Care", 45, 30, "pcs"),
    ("Shampoo 200ml", "PC-002", "8901005002", "Personal Care", 149, 100, "pcs"),
    ("Toothpaste 150g", "PC-003", "8901005003", "Personal Care", 99, 65, "pcs"),
    ("Hand Wash 250ml", "PC-004", "8901005004", "Personal Care", 79, 50, "pcs"),
    ("Face Cream 50g", "PC-005", "8901005005", "Personal Care", 199, 130, "pcs"),
    ("Hair Oil 200ml", "PC-006", "8901005006", "Personal Care", 120, 80, "pcs"),
]

CUSTOMERS = [
    {"name": "Rajesh Kumar", "phone": "+919876500001", "email": "rajesh@example.com"},
    {"name": "Priya Sharma", "phone": "+919876500002", "email": "priya@example.com"},
    {"name": "Amit Patel", "phone": "+919876500003", "email": "amit@example.com"},
    {"name": "Sunita Devi", "phone": "+919876500004", "email": "sunita@example.com"},
    {"name": "Vikram Singh", "phone": "+919876500005", "email": "vikram@example.com"},
]


async def seed():
    await init_db()
    db = await get_db()

    # Clear existing data
    for coll in ["categories", "products", "customers", "bills", "users", "stock_log"]:
        await db[coll].delete_many({})

    print("Seeding admin user...")
    await db.users.insert_one({
        "email": "admin@store.local",
        "password_hash": hash_password("admin123"),
        "name": "Store Admin",
        "role": "admin",
        "is_active": True,
    })

    print("Seeding categories...")
    await db.categories.insert_many(CATEGORIES)

    print("Seeding 30 products...")
    product_docs = []
    for name, sku, barcode, cat, price, cost, unit in PRODUCTS:
        doc = {
            "name": name, "sku": sku, "barcode": barcode, "category": cat,
            "price": price, "cost_price": cost, "tax_rate": 18,
            "stock": random.randint(20, 200), "min_stock": 10, "unit": unit,
            "image_url": "", "is_active": True,
        }
        r = await db.products.insert_one(doc)
        doc["_id"] = r.inserted_id
        product_docs.append(doc)

    print("Seeding 5 customers...")
    now = datetime.now(timezone.utc)
    customer_docs = []
    for c in CUSTOMERS:
        c["loyalty_points"] = random.randint(10, 200)
        c["total_purchases"] = random.randint(3, 30)
        c["created_at"] = now - timedelta(days=random.randint(1, 30))
        r = await db.customers.insert_one(c)
        c["_id"] = r.inserted_id
        customer_docs.append(c)

    print("Seeding 25 bills over 7 days...")
    admin = await db.users.find_one({"email": "admin@store.local"})
    payment_methods = ["cash", "upi", "card"]

    for i in range(25):
        bill_date = now - timedelta(days=random.randint(0, 6), hours=random.randint(0, 12), minutes=random.randint(0, 59))
        num_items = random.randint(1, 5)
        chosen = random.sample(product_docs, min(num_items, len(product_docs)))
        items = []
        subtotal = total_tax = total_discount = 0.0
        for prod in chosen:
            qty = random.randint(1, 3)
            price = prod["price"]
            disc = random.choice([0, 0, 0, 5, 10])
            tax_rate = 18
            line = (price * qty) - disc
            tax = round(line * tax_rate / 100, 2)
            items.append({
                "product_id": str(prod["_id"]),
                "name": prod["name"],
                "quantity": qty,
                "price": price,
                "discount": disc,
                "tax_rate": tax_rate,
                "tax": tax,
                "total": round(line + tax, 2),
            })
            subtotal += price * qty
            total_discount += disc
            total_tax += tax

        bill = {
            "bill_number": f"BI-{bill_date.strftime('%Y%m%d')}-{str(i + 1).zfill(4)}",
            "items": items,
            "subtotal": round(subtotal, 2),
            "total_discount": round(total_discount, 2),
            "total_tax": round(total_tax, 2),
            "grand_total": round(subtotal - total_discount + total_tax, 2),
            "payment_method": random.choice(payment_methods),
            "payment_status": "paid",
            "customer_id": random.choice(customer_docs)["_id"] if random.random() > 0.5 else None,
            "cashier_id": admin["_id"],
            "cashier_name": "Store Admin",
            "created_at": bill_date,
        }
        await db.bills.insert_one(bill)

    print("Seed complete! 30 products, 5 categories, 5 customers, 25 bills.")

if __name__ == "__main__":
    asyncio.run(seed())
