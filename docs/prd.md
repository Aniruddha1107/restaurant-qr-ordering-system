# Product Requirements Document (PRD)

This document establishes the product vision, targeted user personas, functional workflows, and non-functional specifications for the Restaurant ERP platform.

---

## 🎯 Product Vision & Value Proposition

Our objective is to deliver a highly integrated, modern ERP platform that streamlines the dining lifecycle:
- **For Customers**: Seamless, zero-friction mobile web ordering directly from tables via QR scanning with zero app install overhead.
- **For Staff (Chefs & Waiters)**: Real-time synchronization of cooking and serving states, minimizing delays and kitchen miscommunication.
- **For Management**: Automated inventory deductions, invoice settlements, and ML-powered demand forecasts to eliminate waste and prevent stock shortages.

---

## 👥 Targeted Personas

| Persona | Core Needs | Channels of Interaction |
| :--- | :--- | :--- |
| **Customer** | Easy menu navigation, fast cart placement, mobile login, immediate secure checkout. | QR Landing Page + Client Web App |
| **Chef** | Clear visibility of incoming orders, ingredient checklist, single-action preparation stage toggles. | Kitchen Display System (KDS) Panel |
| **Waiter** | Instant service request alerts (water, check, assistance), table mapping, order serving queues. | Waiter Serve Dashboard |
| **Admin / Owner** | Multi-branch revenue analytics, supplier costing catalogs, menu administration, AI forecasting reports. | Executive Admin Console |
| **Supplier** | Clear purchase requisitions, shipment tracking logs. | Supplier Requisition Portal |

---

## ⚙️ Functional Specifications

### 1. Customer QR ordering
- **Table Lock**: Customers scan a table-specific QR code containing query variables `?restaurant=X&table=Y`.
- **OTP Verification**: Passwordless login utilizing mobile numbers and 6-digit codes.
- **Menu & Cart**: Clean responsive catalog with search filters, special preparation text notes, and cart drawers.
- **Razorpay Checkout**: Seamless payment dialog rendering on the client web app.

### 2. Kitchen Display System (KDS)
- Interactive, multi-column Kanban board displaying order ticket blocks moving through preparation phases:
  `New Orders` ➔ `Preparing` ➔ `Ready for Server`.

### 3. Waiter Task Queues
- Real-time waiter dispatch logs displaying table requests (e.g. "Water call from Table 12") and ready-to-serve food tickers.

### 4. Billing & Auto-Deductions
- Generating print-ready invoices applying exact tax (5% GST) and service levies (2%).
- **Automatic Ingredient Deductions**: Triggered when a chef marks an order as `PREPARING`—the system automatically resolves the recipe details and deducts corresponding volumes from the raw stock ledger.

### 5. AI forecasting
- Out-of-the-box Prophet machine learning predictions modeling historical inventory consumption records to suggest future supplier purchase orders and safety threshold revisions.

---

## 📈 Non-Functional Requirements (NFRs)

### 1. Performance & Speed
- **API response latency**: 95% of server endpoint responses must complete under **200ms** to guarantee a snappy interface.
- **Real-time updates**: WebSocket notifications (Channel layers) must dispatch to KDS and serving logs in under **100ms** of database changes.

### 2. Security & Compliance
- **Authentication**: JWT access tokens expire in 24 hours, refresh tokens expire in 7 days.
- **Financial Processing**: External payment processing must occur strictly inside Razorpay's PCI-DSS compliant checkout.

### 3. Reliability & Scalability
- **Concurrency**: High-concurrency support using ASGI (Django Channels) and Redis, allowing hundreds of tables to place orders and receive socket alerts simultaneously per branch.
- **Multi-Branch Isolation**: Strict data access controls—branch personnel should never be able to access the database tables or revenues of other branches under the parent organization.
