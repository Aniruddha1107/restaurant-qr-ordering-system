# Restaurant QR Ordering System

## Overview

A full‑stack, enterprise‑grade Restaurant ERP platform that enables QR‑based ordering, smart inventory management, AI demand forecasting, multi‑branch support, and premium UI/UX.

- **Frontend**: React + Vite, Ant Design, Framer Motion, Recharts, dark/red theme.
- **Backend**: Django 5, Django REST Framework, PostgreSQL, Redis, Celery, Django Channels, JWT + OTP authentication.
- **AI**: Prophet & scikit‑learn for inventory forecasting.
- **Payments**: Razorpay sandbox integration.
- **Containerisation**: Docker & Docker‑Compose.
- **CI/CD**: GitHub Actions.

## Quick Start (Local Development)

```bash
# Clone repo (if applicable)
# Install dependencies
cd backend && pip install -r requirements.txt
cd ../frontend && npm install
# Start services
docker compose up -d
# Run backend migrations
cd backend && python manage.py migrate
# Start dev servers
cd ../frontend && npm run dev
cd ../backend && python manage.py runserver
```

## Architecture

- **frontend/** – React app with pages for customers, chefs, waiters, and owners.
- **backend/** – Django project with modular apps (`authentication`, `menu`, `orders`, `inventory`, `analytics`, …).
- **docker/** – Dockerfiles and compose for all services.
- **docs/** – Documentation, API specs, DB schema.

---

*Generated based on the implementation plan.*
