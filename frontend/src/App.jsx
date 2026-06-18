import React, { useState, useEffect } from 'react';
import './App.css';
import { payWithRazorpay } from './services/payment';
import { useAuth } from './context/AuthContext';
import api from './services/api';

const MENU_ITEMS = [
  {
    id: 1,
    name: 'Red Velvet Pancakes',
    description: 'Fluffy signature buttermilk pancakes topped with red velvet crumble, berries, and whipped cream.',
    price: 249,
    emoji: '🥞',
  },
  {
    id: 2,
    name: 'Spicy Sriracha Burger',
    description: 'Juicy grilled patty, double cheddar, jalapeños, crispy onions, and our signature spicy sriracha glaze.',
    price: 349,
    emoji: '🍔',
  },
  {
    id: 3,
    name: 'Truffle Mushroom Pizza',
    description: 'Artisanal wood-fired sourdough crust topped with wild porcini mushrooms, mozzarella, and truffle oil.',
    price: 499,
    emoji: '🍕',
  },
  {
    id: 4,
    name: 'Activated Charcoal Latte',
    description: 'Rich dark espresso blended with activated coconut charcoal and velvety steamed oat milk.',
    price: 199,
    emoji: '☕',
  },
];

function CustomerMenu() {
  // Parsing restaurant & table from URL query parameters
  const [restaurantId, setRestaurantId] = useState(null);
  const [tableId, setTableId] = useState(null);

  // Auth Context Global States
  const { isAuthenticated, mobile: globalMobile, sendOtp, verifyOtp, logout } = useAuth();

  // Local Auth UI States
  const [mobile, setMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Cart State
  const [cart, setCart] = useState({});

  // Table Service Call state
  const [serviceModalOpen, setServiceModalOpen] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState(null);

  const handleServiceRequest = async (type) => {
    try {
      await api.post('/api/notifications/request/', {
        table_id: tableId,
        request_type: type
      });
      showToast('Request submitted to waiter!', 'success');
      setServiceModalOpen(false);
    } catch (err) {
      showToast('Failed to call waiter.', 'error');
    }
  };

  // Initialize and check query params & local mobile
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('restaurant');
    const tId = params.get('table');
    setRestaurantId(rId);
    setTableId(tId);

    if (globalMobile) {
      setMobile(globalMobile);
    }
  }, [globalMobile]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // 1. Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!mobile) return showToast('Please enter a valid mobile number.', 'error');
    
    setLoading(true);
    const res = await sendOtp(mobile);
    setLoading(false);
    
    if (res.success) {
      setOtpSent(true);
      showToast('OTP sent successfully! Check django console.', 'success');
    } else {
      showToast(res.error, 'error');
    }
  };

  // 2. Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) return showToast('Please enter the 6-digit OTP.', 'error');

    setLoading(true);
    const res = await verifyOtp(mobile, otpCode);
    setLoading(false);

    if (res.success) {
      showToast('Logged in successfully.', 'success');
    } else {
      showToast(res.error, 'error');
    }
  };

  // 3. Logout
  const handleLogout = () => {
    logout();
    setOtpSent(false);
    setOtpCode('');
    setCart({});
    showToast('Logged out.', 'success');
  };

  // Cart operations
  const addToCart = (item) => {
    setCart((prev) => ({
      ...prev,
      [item.id]: {
        ...item,
        quantity: (prev[item.id]?.quantity || 0) + 1,
      },
    }));
    showToast(`Added ${item.name} to cart.`);
  };

  const updateQuantity = (itemId, change) => {
    setCart((prev) => {
      const currentItem = prev[itemId];
      if (!currentItem) return prev;
      
      const newQuantity = currentItem.quantity + change;
      if (newQuantity <= 0) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }

      return {
        ...prev,
        [itemId]: {
          ...currentItem,
          quantity: newQuantity,
        },
      };
    });
  };

  // Calculate prices
  const cartItems = Object.values(cart);
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const gst = Math.round(subtotal * 0.05); // 5% GST
  const serviceCharge = Math.round(subtotal * 0.02); // 2% Service Charge
  const total = subtotal + gst + serviceCharge;

  // 4. Razorpay Checkout integration
  const handleCheckout = async () => {
    if (cartItems.length === 0) return showToast('Your cart is empty.', 'error');

    setLoading(true);
    try {
      // Step A: Create order on Django backend using Axios API Client
      const response = await api.post('/api/payment/create-order/', { amount: total });
      const orderData = response.data;

      // Step B: Trigger Razorpay Checkout dialog
      await payWithRazorpay({
        amount: orderData.amount,
        orderId: orderData.order_id,
        keyId: orderData.key_id,
        onSuccess: async (paymentDetails) => {
          // Step C: Verify payment signature on Django backend using Axios API Client
          try {
            const verifyResponse = await api.post('/api/payment/verify-payment/', paymentDetails);
            if (verifyResponse.status === 200) {
              setCart({});
              showToast('Order placed successfully! Payment verified.', 'success');
            } else {
              showToast('Signature verification failed.', 'error');
            }
          } catch (err) {
            showToast('Network error verifying payment.', 'error');
          }
        },
        onFailure: (error) => {
          showToast(error.message || 'Payment cancelled or failed.', 'error');
        },
      });
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Payment system error.';
      showToast(errMsg, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Toast notifications */}
      {toast && (
        <div className={`alert-toast ${toast.type}`} id="toast-notification">
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header bar */}
      <header>
        <div className="logo-container">
          <div className="logo-icon">R</div>
          <div className="logo-text">Red Velvet Bistro</div>
        </div>
        <div className="flex-align-center">
          {restaurantId && tableId && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
              <span className="table-badge" id="table-display">
                Table {tableId}
              </span>
              <button
                className="btn btn-secondary"
                style={{ width: 'auto', padding: '6px 14px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}
                onClick={() => setServiceModalOpen(!serviceModalOpen)}
                id="btn-call-waiter"
              >
                🛎️ Call Service
              </button>
              
              {serviceModalOpen && (
                <div className="service-dropdown-card" id="service-dropdown" style={{
                  position: 'absolute',
                  top: '45px',
                  right: '0',
                  background: 'rgba(30, 41, 59, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px',
                  zIndex: 1000,
                  boxShadow: 'var(--shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '200px',
                  animation: 'fadeIn 0.2s ease forwards'
                }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#c5a880', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Call Table Service</h4>
                  <button className="kds-btn btn-accept" style={{ textAlign: 'left', justifyContent: 'flex-start', margin: 0 }} onClick={() => handleServiceRequest('water')}>💧 Water Bottle</button>
                  <button className="kds-btn btn-accept" style={{ textAlign: 'left', justifyContent: 'flex-start', margin: 0 }} onClick={() => handleServiceRequest('assistance')}>🙋 Assistance</button>
                  <button className="kds-btn btn-accept" style={{ textAlign: 'left', justifyContent: 'flex-start', margin: 0 }} onClick={() => handleServiceRequest('bill')}>💳 Request Bill</button>
                </div>
              )}
            </div>
          )}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ margin: '0 0 0 16px', padding: '6px 14px', width: 'auto', fontSize: '13px' }}
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Login Screen */}
      {!isAuthenticated ? (
        <div className="login-card" id="login-container">
          <h2>Welcome</h2>
          {!restaurantId || !tableId ? (
            <div className="qr-scan-warning" id="qr-warning-message" style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h3 style={{ color: 'var(--accent)', marginBottom: '10px' }}>QR Code Scan Required</h3>
              <p style={{ color: 'var(--text-d)', fontSize: '14px', lineHeight: '1.6' }}>
                Please scan the QR code located on your dining table to access our digital menu, call for service, and place orders.
              </p>
            </div>
          ) : (
            <>
              <p>Please enter your mobile number to view our digital menu and place an order.</p>

              {!otpSent ? (
            <form onSubmit={handleSendOTP} id="otp-request-form">
              <div className="form-group">
                <label htmlFor="mobile-input">Mobile Number</label>
                <input
                  type="tel"
                  id="mobile-input"
                  className="input-field"
                  placeholder="+91 98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <button type="submit" className="btn" disabled={loading} id="btn-send-otp">
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} id="otp-verify-form">
              <div className="form-group">
                <label>Mobile Number</label>
                <input type="text" className="input-field" value={mobile} disabled />
              </div>
              <div className="form-group">
                <label htmlFor="otp-input">Enter OTP Code</label>
                <input
                  type="text"
                  id="otp-input"
                  className="input-field"
                  placeholder="6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={loading}
                  maxLength="6"
                  required
                />
              </div>
              <button type="submit" className="btn" disabled={loading} id="btn-verify-otp">
                {loading ? 'Verifying...' : 'Verify & Enter Menu'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOtpSent(false)}
                disabled={loading}
              >
                Change Phone Number
              </button>
            </form>
          )}
          </>
          )}
        </div>
      ) : (
        /* Menu and Cart view */
        <div className="menu-section" id="menu-container">
          {/* Menu Catalog */}
          <div>
            <h2 style={{ fontSize: '28px', color: 'var(--text-h)', marginBottom: '20px' }}>Our Specialties</h2>
            <div className="menu-grid">
              {MENU_ITEMS.map((item) => (
                <div key={item.id} className="menu-item-card" id={`menu-item-${item.id}`}>
                  <div className="menu-item-image">
                    {item.emoji}
                  </div>
                  <div className="menu-item-details">
                    <div className="menu-item-header">
                      <h3 className="menu-item-title">{item.name}</h3>
                      <span className="menu-item-price">₹{item.price}</span>
                    </div>
                    <p className="menu-item-desc">{item.description}</p>
                    <button
                      className="btn"
                      style={{ padding: '10px', fontSize: '14px' }}
                      onClick={() => addToCart(item)}
                      id={`btn-add-${item.id}`}
                    >
                      Add to Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="cart-sidebar" id="cart-container">
            <h3 className="cart-title">
              Your Order
              {cartItems.length > 0 && <span className="cart-count-badge">{cartItems.length}</span>}
            </h3>

            {cartItems.length === 0 ? (
              <div className="cart-empty" id="cart-empty-msg">
                Your cart is empty. Tap "Add to Order" to select food.
              </div>
            ) : (
              <div id="cart-items-list">
                {cartItems.map((item) => (
                  <div key={item.id} className="cart-item" id={`cart-item-${item.id}`}>
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-price">₹{item.price * item.quantity}</div>
                    </div>
                    <div className="quantity-controller">
                      <button
                        className="qty-btn"
                        onClick={() => updateQuantity(item.id, -1)}
                        id={`btn-qty-dec-${item.id}`}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-h)' }}>
                        {item.quantity}
                      </span>
                      <button
                        className="qty-btn"
                        onClick={() => updateQuantity(item.id, 1)}
                        id={`btn-qty-inc-${item.id}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}

                <div className="cart-summary">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="summary-row">
                    <span>GST (5%)</span>
                    <span>₹{gst}</span>
                  </div>
                  <div className="summary-row">
                    <span>Service Charge (2%)</span>
                    <span>₹{serviceCharge}</span>
                  </div>
                  <div className="summary-row total">
                    <span>Total Amount</span>
                    <span id="cart-total-amount">₹{total}</span>
                  </div>
                  <button
                    className="btn"
                    onClick={handleCheckout}
                    disabled={loading}
                    id="btn-checkout"
                    style={{ animation: 'pulse 2s infinite' }}
                  >
                    {loading ? 'Processing...' : 'Place Order & Pay'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import Kds from './Kds';
import Waiter from './Waiter';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<CustomerMenu />} />
      <Route path="/kds" element={<Kds />} />
      <Route path="/waiter" element={<Waiter />} />
    </Routes>
  );
}

export default App;
