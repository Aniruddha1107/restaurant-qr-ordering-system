# API Specification

This document maps out the core REST API routes, request/response formats, and status codes for the ERP platform.

---

## 🔐 Authentication Module (`/api/auth/`)

### 1. Request OTP
- **Endpoint**: `POST /api/auth/send-otp/`
- **Request Body**:
  ```json
  {
    "mobile": "+919876543210"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "OTP sent successfully."
  }
  ```

### 2. Verify OTP & Token Login
- **Endpoint**: `POST /api/auth/verify-otp/`
- **Request Body**:
  ```json
  {
    "mobile": "+919876543210",
    "code": "123456"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "access": "jwt-access-token-string",
    "refresh": "jwt-refresh-token-string"
  }
  ```

---

## 🍽️ Menu Catalog (`/api/menu/`)

### 1. List Categories
- **Endpoint**: `GET /api/menu/categories/`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "uuid-category-1",
      "name": "Starters"
    }
  ]
  ```

### 2. List Menu Items by Category
- **Endpoint**: `GET /api/menu/items/`
- **Query Params**: `?category=uuid-category-1`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "uuid-item-1",
      "name": "Red Velvet Pancakes",
      "description": "Fluffy signature pancakes...",
      "price": "249.00",
      "is_available": true
    }
  ]
  ```

---

## 🛍️ Customer Ordering Flow (`/api/orders/`)

### 1. Place New Order
- **Endpoint**: `POST /api/orders/`
- **Headers**: `Authorization: Bearer <access_token>`
- **Request Body**:
  ```json
  {
    "restaurant_id": "1",
    "table_id": "12",
    "items": [
      {
        "menu_item_id": "uuid-item-1",
        "quantity": 2,
        "notes": "No sugar"
      }
    ]
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "id": "uuid-order-1",
    "status": "PLACED",
    "created_at": "2026-06-18T12:00:00Z"
  }
  ```

### 2. Get Active Orders Status
- **Endpoint**: `GET /api/orders/active/`
- **Headers**: `Authorization: Bearer <access_token>`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "uuid-order-1",
      "status": "PREPARING",
      "items": [...]
    }
  ]
  ```

---

## 💳 Billing & Payment Gateway (`/api/payment/`)

### 1. Create Transaction Order
- **Endpoint**: `POST /api/payment/create-order/`
- **Headers**: `Authorization: Bearer <access_token>`
- **Request Body**:
  ```json
  {
    "amount": 549.00
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "order_id": "order_Hkn3jdfS93",
    "amount": 54900,
    "currency": "INR",
    "key_id": "rzp_test_xxxxxxx"
  }
  ```

### 2. Verify Razorpay Transaction Signature
- **Endpoint**: `POST /api/payment/verify-payment/`
- **Headers**: `Authorization: Bearer <access_token>`
- **Request Body**:
  ```json
  {
    "razorpay_order_id": "order_Hkn3jdfS93",
    "razorpay_payment_id": "pay_Kdsjfkjsdf93",
    "razorpay_signature": "signature-hash-string"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Payment verified successfully."
  }
  ```

---

## 🔌 WebSocket Streams (`ws://`)

### 1. Live Kitchen Update Channel
- **Path**: `ws://localhost:8000/ws/kitchen/`
- **Purpose**: Real-time pushes to the Kitchen Display System (KDS).
- **Broadcast payload sample**:
  ```json
  {
    "event": "ORDER_PLACED",
    "order": {
      "id": "uuid-order-1",
      "table": "12",
      "items": [...]
    }
  }
  ```
