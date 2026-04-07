# QuickBill - POS & Billing System

Complete POS billing system with product catalog, GST billing, inventory, and sales reports.

## Tech Stack
- Backend: Python FastAPI + Motor (async MongoDB)
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Database: MongoDB
- Charts: Recharts

## Setup
```bash
# Docker
docker-compose up

# Manual
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

## Seed Data
```bash
cd backend
python -m scripts.seed_admin
python -m scripts.seed_sample_data
```

## Default Login
- Admin: admin@pos.local / admin123
