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


## Deployment

### Docker Compose (Easiest)

```bash
# Clone the repository
git clone https://github.com/humanoidmaker/pos-billing-system.git
cd pos-billing-system

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### PM2 (Production Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Install dependencies
cd backend && pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..

# Start all services
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs

# Stop all
pm2 stop all

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/mongodb.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Check status
kubectl get pods -n pos-billing-system

# View logs
kubectl logs -f deployment/backend -n pos-billing-system

# Scale
kubectl scale deployment/backend --replicas=3 -n pos-billing-system
```

### Manual Setup

**1. Database:**
```bash
# Start MongoDB
mongod --dbpath /data/db
```

**2. Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv/Scripts/activate  # Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database URL and secrets
python -m scripts.seed_admin
python -m scripts.seed_sample_data
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**3. Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**4. Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## License

MIT License — Copyright (c) 2026 Humanoid Maker (www.humanoidmaker.com)
