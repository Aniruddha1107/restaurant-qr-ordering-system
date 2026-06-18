import React, { useState, useEffect } from 'react';
import './App.css';
import { payWithRazorpay } from './services/payment';

const API_BASE = 'http://localhost:8000';

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

function App() {
  // Parsing restaurant & table from URL query parameters
  const [restaurantId, setRestaurantId] = useState(null);
  const [tableId, setTableId] = useState(null);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);

  // Cart State
  const [cart, setCart] = useState({});

  // Toast Notification State
  const [toast, setToast] = useState(null);

  // Initialize and check query params & local token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('restaurant');
    const tId = params.get('table');
    setRestaurantId(rId);
    setTableId(tId);

    const savedToken = localStorage.getItem('access_token');
    const savedMobile = localStorage.getItem('mobile_number');
    if (savedToken && savedMobile) {
      setAccessToken(savedToken);
      setMobile(savedMobile);
      setIsAuthenticated(true);
    }
  }, []);

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
    try {
      const response = await fetch(`${API_BASE}/api/auth/send-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await response.json();
      
      if (response.ok) {
        setOtpSent(true);
        showToast('OTP sent successfully! Check django console.', 'success');
      } else {
        showToast(data.error || 'Failed to send OTP.', 'error');
      }
    } catch (err) {
      showToast('Network error while sending OTP.', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode) return showToast('Please enter the 6-digit OTP.', 'error');

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, code: otpCode }),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('mobile_number', mobile);
        setAccessToken(data.access);
        setIsAuthenticated(true);
        showToast('Logged in successfully.', 'success');
      } else {
        showToast(data.error || 'Invalid OTP code.', 'error');
      }
    } catch (err) {
      showToast('Network error during OTP verification.', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Logout
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('mobile_number');
    setAccessToken('');
    setIsAuthenticated(false);
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
      // Step A: Create order on Django backend
      const response = await fetch(`${API_BASE}/api/payment/create-order/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ amount: total }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment order on backend.');
      }

      // Step B: Trigger Razorpay Checkout dialog
      await payWithRazorpay({
        amount: data.amount,
        orderId: data.order_id,
        keyId: data.key_id,
        onSuccess: async (paymentDetails) => {
          // Step C: Verify payment signature on Django backend
          try {
            const verifyResponse = await fetch(`${API_BASE}/api/payment/verify-payment/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify(paymentDetails),
            });
            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok) {
              setCart({});
              showToast('Order placed successfully! Payment verified.', 'success');
            } else {
              showToast(verifyData.message || 'Signature verification failed.', 'error');
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
      showToast(err.message || 'Payment system error.', 'error');
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
            <span className="table-badge" id="table-display">
              Table {tableId} (Rest. {restaurantId})
            </span>
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

export default App;
