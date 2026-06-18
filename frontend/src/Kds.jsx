import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import api from './services/api';
import './Kds.css';

const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn("Audio play blocked:", e);
  }
};

export default function Kds() {
  const { isAuthenticated, role, logout, sendOtp, verifyOtp } = useAuth();
  
  // Auth Form State
  const [mobile, setMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Orders State
  const [orders, setOrders] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connected' | 'connecting' | 'disconnected'
  const wsRef = useRef(null);

  // Sound Notification Ref
  const previousOrdersRef = useRef([]);

  // Fetch initial orders on mount/auth
  useEffect(() => {
    if (isAuthenticated && ['chef', 'waiter', 'manager'].includes(role)) {
      fetchOrders();
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isAuthenticated, role]);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/api/orders/list/');
      setOrders(response.data);
      previousOrdersRef.current = response.data.map(o => o.id);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    }
  };

  const connectWebSocket = () => {
    const wsBase = window.location.port === '5173' ? 'ws://localhost:8000' : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const wsUrl = `${wsBase}/ws/orders/`;
    
    setWsStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (isAuthenticated && ['chef', 'waiter', 'manager'].includes(role)) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error("WS error:", err);
      ws.close();
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      handleIncomingOrderUpdate(payload);
    };
  };

  const handleIncomingOrderUpdate = (payload) => {
    setOrders((prevOrders) => {
      // Find if order already exists
      const exists = prevOrders.some((o) => o.id === payload.order_id);
      
      // If served or cancelled, filter it out from active columns
      if (payload.status === 'served' || payload.status === 'cancelled') {
        return prevOrders.filter((o) => o.id !== payload.order_id);
      }

      // Format to match order list object
      const formattedOrder = {
        id: payload.order_id,
        table_number: payload.table_number,
        status: payload.status,
        created_at: payload.created_at,
        updated_at: payload.updated_at,
        items: payload.items.map((item, idx) => ({
          id: idx,
          menu_item_name: item.menu_item_name,
          quantity: item.quantity,
          notes: item.notes
        }))
      };

      if (exists) {
        return prevOrders.map((o) => (o.id === payload.order_id ? formattedOrder : o));
      } else {
        // New order!
        // Play sound if not already in previous orders
        if (!previousOrdersRef.current.includes(payload.order_id)) {
          playChime();
          previousOrdersRef.current = [...previousOrdersRef.current, payload.order_id];
        }
        return [...prevOrders, formattedOrder];
      }
    });
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.patch(`/api/orders/${orderId}/status/`, { status: newStatus });
      // WS will broadcast, updating local state automatically
    } catch (err) {
      console.error(`Failed to update status for order #${orderId}:`, err);
    }
  };

  // Auth Handling
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!mobile) return setAuthError('Enter a valid mobile number.');
    
    setAuthLoading(true);
    const res = await sendOtp(mobile);
    setAuthLoading(false);
    
    if (res.success) {
      setOtpSent(true);
    } else {
      setAuthError(res.error);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!otpCode) return setAuthError('Enter the 6-digit OTP.');

    setAuthLoading(true);
    const res = await verifyOtp(mobile, otpCode);
    setAuthLoading(false);

    if (!res.success) {
      setAuthError(res.error);
    }
  };

  // Helper for Order Card Timer
  const getMinutesElapsed = (createdAtString) => {
    const created = new Date(createdAtString);
    const now = new Date();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins < 0 ? 0 : diffMins;
  };

  // Filter orders by column
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');

  // 1. Staff is not authenticated
  if (!isAuthenticated) {
    return (
      <div className="kds-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="login-card" style={{ margin: '0' }}>
          <div className="kds-logo" style={{ margin: '0 auto 16px auto' }}>👨‍🍳</div>
          <h2>KDS Kitchen Display</h2>
          <p>Staff Portal Authentication</p>

          {authError && <div style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '14px' }}>{authError}</div>}

          {!otpSent ? (
            <form onSubmit={handleSendOTP}>
              <div className="form-group">
                <label>Staff Mobile Number</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+91 98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  disabled={authLoading}
                  required
                />
              </div>
              <button type="submit" className="btn" disabled={authLoading}>
                {authLoading ? 'Verifying Staff...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <div className="form-group">
                <label>Staff Mobile</label>
                <input type="text" className="input-field" value={mobile} disabled />
              </div>
              <div className="form-group">
                <label>Enter Verification Code</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={authLoading}
                  maxLength="6"
                  required
                />
              </div>
              <button type="submit" className="btn" disabled={authLoading}>
                {authLoading ? 'Authenticating...' : 'Verify & Enter Kitchen Panel'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '10px' }}
                onClick={() => setOtpSent(false)}
                disabled={authLoading}
              >
                Change Phone Number
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 2. Authenticated but not staff
  if (!['chef', 'waiter', 'manager'].includes(role)) {
    return (
      <div className="kds-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="login-card" style={{ margin: '0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2>Access Denied</h2>
          <p>Your account role is "{role}". Only staff members (Chef, Waiter, Manager) can access the KDS.</p>
          <button className="btn" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  // 3. Render KDS Dashboard
  return (
    <div className="kds-container">
      <header className="kds-header">
        <div className="kds-title-section">
          <div className="kds-logo">🍳</div>
          <div>
            <div className="kds-title">Kitchen Display System (KDS)</div>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Role: {role.toUpperCase()}</span>
          </div>
        </div>

        <div className="kds-status-bar">
          <span className="kds-badge">
            <span className={`status-dot ${wsStatus === 'connected' ? 'status-connected' : wsStatus === 'connecting' ? 'status-connecting' : 'status-disconnected'}`} />
            WS: {wsStatus.toUpperCase()}
          </span>
          <span className="kds-badge">
            Total Active: {orders.length}
          </span>
          <button onClick={logout} className="btn" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="kds-kanban">
        {/* COLUMN 1: NEW ORDERS */}
        <div className="kds-column col-new">
          <div className="column-header">
            <span className="column-title">Incoming Orders</span>
            <span className="column-count">{pendingOrders.length}</span>
          </div>
          <div className="cards-container">
            {pendingOrders.length === 0 ? (
              <div className="kds-no-orders">No pending orders.</div>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.id} className="kds-card card-new" id={`kds-order-${order.id}`}>
                  <div className="card-header">
                    <span className="card-table-badge">Table {order.table_number}</span>
                    <span className="card-timer">⏱️ {getMinutesElapsed(order.created_at)}m ago</span>
                  </div>
                  <div className="card-items-list">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="card-item-row">
                        <span className="item-qty-name">
                          {item.quantity}x {item.menu_item_name}
                        </span>
                        {item.notes && <span className="item-notes">"{item.notes}"</span>}
                      </div>
                    ))}
                  </div>
                  <div className="card-actions">
                    <button
                      className="kds-btn btn-accept"
                      onClick={() => updateOrderStatus(order.id, 'preparing')}
                      id={`btn-accept-${order.id}`}
                    >
                      🔥 Start Cooking
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: PREPARING */}
        <div className="kds-column col-preparing">
          <div className="column-header">
            <span className="column-title">Preparing</span>
            <span className="column-count">{preparingOrders.length}</span>
          </div>
          <div className="cards-container">
            {preparingOrders.length === 0 ? (
              <div className="kds-no-orders">Kitchen idle.</div>
            ) : (
              preparingOrders.map((order) => (
                <div key={order.id} className="kds-card card-preparing" id={`kds-order-${order.id}`}>
                  <div className="card-header">
                    <span className="card-table-badge">Table {order.table_number}</span>
                    <span className="card-timer">⏱️ Cooking: {getMinutesElapsed(order.updated_at)}m</span>
                  </div>
                  <div className="card-items-list">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="card-item-row">
                        <span className="item-qty-name">
                          {item.quantity}x {item.menu_item_name}
                        </span>
                        {item.notes && <span className="item-notes">"{item.notes}"</span>}
                      </div>
                    ))}
                  </div>
                  <div className="card-actions">
                    <button
                      className="kds-btn btn-ready"
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                      id={`btn-ready-${order.id}`}
                    >
                      🔔 Food Ready
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: READY */}
        <div className="kds-column col-ready">
          <div className="column-header">
            <span className="column-title">Ready to Serve</span>
            <span className="column-count">{readyOrders.length}</span>
          </div>
          <div className="cards-container">
            {readyOrders.length === 0 ? (
              <div className="kds-no-orders">No food waiting to be served.</div>
            ) : (
              readyOrders.map((order) => (
                <div key={order.id} className="kds-card card-ready" id={`kds-order-${order.id}`}>
                  <div className="card-header">
                    <span className="card-table-badge">Table {order.table_number}</span>
                    <span className="card-timer">⏱️ Ready: {getMinutesElapsed(order.updated_at)}m</span>
                  </div>
                  <div className="card-items-list">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="card-item-row">
                        <span className="item-qty-name">
                          {item.quantity}x {item.menu_item_name}
                        </span>
                        {item.notes && <span className="item-notes">"{item.notes}"</span>}
                      </div>
                    ))}
                  </div>
                  <div className="card-actions">
                    <button
                      className="kds-btn btn-serve"
                      onClick={() => updateOrderStatus(order.id, 'served')}
                      id={`btn-serve-${order.id}`}
                    >
                      ✅ Food Served
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
