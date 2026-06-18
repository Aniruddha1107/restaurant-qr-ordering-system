# Restaurant QR Ordering System

## Overview

A full‑stack, enterprise‑grade Restaurant ERP platform that enables QR‑based ordering, smart inventory management, AI demand forecasting, multi‑branch support, and premium UI/UX. It manages a restaurant automatically by removing the server/waiter role of taking and tracking orders to keep the fast flow of the restaurant, and integrates AI models for inventory optimization.

- **Frontend**: React + Vite, Ant Design, Framer Motion, Recharts, dark/red theme.
- **Backend**: Django 5, Django REST Framework, PostgreSQL, Redis, Celery, Django Channels, JWT + OTP authentication.
- **AI**: Prophet & scikit‑learn for inventory forecasting.
- **Payments**: Razorpay sandbox integration.
- **Containerisation**: Docker & Docker‑Compose.
- **CI/CD**: GitHub Actions.

## 📚 System Documentation

- [System Architecture](file:///d:/projects%202026/restaurant-qr-ordering-system/docs/architecture.md)
- [Database Design & Schema](file:///d:/projects%202026/restaurant-qr-ordering-system/docs/database_design.md)
- [API Specifications](file:///d:/projects%202026/restaurant-qr-ordering-system/docs/api_spec.md)
- [Product Requirements (PRD)](file:///d:/projects%202026/restaurant-qr-ordering-system/docs/prd.md)
- [System Design (ERD, Flows)](file:///d:/projects%202026/restaurant-qr-ordering-system/docs/system_design.md)

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
