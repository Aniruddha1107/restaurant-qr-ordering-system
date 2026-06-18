# System Design Specification

This document details the database Entity Relationship Diagram (ERD), user workflows, API sequence mappings, and infrastructure deployment layouts.

---

## 📊 Entity Relationship Diagram (ERD)

The relational schema maps our database layout:

```mermaid
erDiagram
    Restaurant {
        uuid id PK
        string name
        string logo_url
        datetime created_at
    }
    Branch {
        uuid id PK
        uuid restaurant_id FK
        string name
        text address
        string phone
        datetime created_at
    }
    Table {
        uuid id PK
        uuid branch_id FK
        string number
        string qr_code_url
        string status
    }
    DiningSession {
        uuid id PK
        uuid table_id FK
        string customer_phone
        boolean active
        datetime start_time
        datetime end_time
    }
    MenuItem {
        uuid id PK
        uuid category_id FK
        string name
        text description
        decimal price
        boolean is_available
    }
    Order {
        uuid id PK
        uuid session_id FK
        string status
        datetime created_at
    }
    OrderItem {
        uuid id PK
        uuid order_id FK
        uuid menu_item_id FK
        integer quantity
        string notes
    }
    Bill {
        uuid id PK
        uuid session_id FK
        decimal subtotal
        decimal gst
        decimal service_charge
        decimal total_amount
        boolean is_settled
    }
    Payment {
        uuid id PK
        uuid bill_id FK
        string payment_method
        string transaction_id
        string status
        datetime timestamp
    }

    Restaurant ||--|{ Branch : operates
    Branch ||--|{ Table : contains
    Table ||--|{ DiningSession : hosts
    DiningSession ||--|{ Order : places
    Order ||--|{ OrderItem : contains
    MenuItem ||--|{ OrderItem : lists
    DiningSession ||--|| Bill : generates
    Bill ||--|| Payment : clears
```

---

## 🔄 Sequence Diagrams

### 1. Mobile OTP Authentication Flow
```mermaid
sequenceDiagram
    actor Client as Customer Web Client
    participant AuthAPI as Django Auth Views
    participant DB as PostgreSQL
    participant Console as Logs / SMS Gateway

    Client->>AuthAPI: POST /api/auth/send-otp/ (mobile)
    AuthAPI->>DB: Create & Save OTP record
    AuthAPI->>Console: Log OTP (console / Textbelt)
    AuthAPI-->>Client: 200 OK (OTP Sent)
    
    Note over Client, Console: User retrieves code from log/SMS
    
    Client->>AuthAPI: POST /api/auth/verify-otp/ (mobile, code)
    AuthAPI->>DB: Fetch last OTP record for mobile
    alt Code Matches & Valid
        AuthAPI->>DB: Get or Create User
        AuthAPI->>DB: Delete OTP record (prevent replay)
        AuthAPI-->>Client: 200 OK (access & refresh tokens)
    else Invalid / Expired
        AuthAPI-->>Client: 400 Bad Request (Error Details)
    end
```

### 2. Order Placement & KDS Processing Flow
```mermaid
sequenceDiagram
    actor Client as Customer Web Client
    participant API as Django Order Views
    participant Sockets as Django Channels (ASGI)
    participant KDS as Chef KDS Dashboard
    participant DB as PostgreSQL

    Client->>API: POST /api/orders/ (items, table)
    API->>DB: Create Order & OrderItem entries
    API->>Sockets: Trigger channel broadcast (order details)
    Sockets->>KDS: WebSockets push: NEW_ORDER
    API-->>Client: 201 Created (Order confirmed)
    
    Note over KDS: Chef accepts and prepares food
    
    KDS->>API: PATCH /api/orders/{id}/ (status="PREPARING")
    API->>DB: Fetch Recipe & Ingredient tables
    API->>DB: Deduct ingredient volumes from Stock
    API->>DB: Log InventoryTransaction (CONSUMPTION)
    API->>Sockets: Push state update to Waiter
```

---

## 🚢 Deployment Diagram

Our production and local docker stack maps services inside an Nginx gateway:

```mermaid
graph LR
    User[Client Browser] -->|Port 80/443| Nginx[Nginx Reverse Proxy]
    Nginx -->|Port 5173| Frontend[Vite/React Container]
    Nginx -->|Port 8000 REST| Backend[Django Gunicorn/ASGI Container]
    Nginx -->|Port 8000 WebSockets| Channels[Django ASGI/Uvicorn Channel]
    Backend --> DB[(PostgreSQL Database)]
    Channels --> Redis[(Redis Channel Layer)]
    Backend --> Redis
    Worker[Celery Task Worker] --> Redis
    Worker --> DB
```
