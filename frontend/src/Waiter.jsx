import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import api from './services/api';
import './Waiter.css';

const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
    
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.45);
  } catch (e) {
    console.warn("Audio block:", e);
  }
};

export default function Waiter() {
  const { isAuthenticated, role, logout, sendOtp, verifyOtp } = useAuth();

  // Auth Form State
  const [mobile, setMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Active service requests & Ready-to-serve orders
  const [requests, setRequests] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const wsRef = useRef(null);

  // Sound notification tracker
  const soundTrackerRef = useRef({ requests: [], orders: [] });

  useEffect(() => {
    if (isAuthenticated && ['waiter', 'chef', 'manager'].includes(role)) {
      fetchRequests();
      fetchReadyOrders();
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isAuthenticated, role]);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/api/notifications/list/');
      setRequests(response.data);
      soundTrackerRef.current.requests = response.data.map(r => r.id);
    } catch (err) {
      console.error("Failed to fetch service requests:", err);
    }
  };

  const fetchReadyOrders = async () => {
    try {
      const response = await api.get('/api/orders/list/?status=ready');
      setReadyOrders(response.data);
      soundTrackerRef.current.orders = response.data.map(o => o.id);
    } catch (err) {
      console.error("Failed to fetch ready orders:", err);
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
      setTimeout(() => {
        if (isAuthenticated && ['waiter', 'chef', 'manager'].includes(role)) {
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
      handleIncomingUpdate(payload);
    };
  };

  const handleIncomingUpdate = (payload) => {
    // Check if it is a service request notification event
    if (payload.event_type === 'service_request') {
      setRequests((prev) => {
        const exists = prev.some((r) => r.id === payload.id);
        if (exists) return prev;
        
        if (!soundTrackerRef.current.requests.includes(payload.id)) {
          playChime();
          soundTrackerRef.current.requests.push(payload.id);
        }
        return [...prev, payload];
      });
    } else if (payload.event_type === 'service_request_completed') {
      setRequests((prev) => prev.filter((r) => r.id !== payload.id));
    } else {
      // Normal order updates
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

      if (payload.status === 'ready') {
        setReadyOrders((prev) => {
          const exists = prev.some((o) => o.id === payload.order_id);
          if (exists) return prev.map(o => o.id === payload.order_id ? formattedOrder : o);

          if (!soundTrackerRef.current.orders.includes(payload.order_id)) {
            playChime();
            soundTrackerRef.current.orders.push(payload.order_id);
          }
          return [...prev, formattedOrder];
        });
      } else {
        // Any other status (served, preparing, pending) removes it from the ready orders column
        setReadyOrders((prev) => prev.filter((o) => o.id !== payload.order_id));
      }
    }
  };

  const completeServiceRequest = async (requestId) => {
    try {
      await api.patch(`/api/notifications/${requestId}/complete/`);
      // WS will trigger removal
    } catch (err) {
      console.error("Failed to complete request:", err);
    }
  };

  const markOrderServed = async (orderId) => {
    try {
      await api.patch(`/api/orders/${orderId}/status/`, { status: 'served' });
      // WS will trigger removal
    } catch (err) {
      console.error("Failed to mark order served:", err);
    }
  };

  // Staff Authentication Handling
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

  if (!isAuthenticated) {
    return (
      <div className="waiter-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="login-card" style={{ margin: '0' }}>
          <div className="waiter-logo" style={{ margin: '0 auto 16px auto' }}>🛎️</div>
          <h2>Waiter Service Queue</h2>
          <p>Staff Portal Authentication</p>

          {authError && <div style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '14px' }}>{authError}</div>}

          {!otpSent ? (
            <form onSubmit={handleSendOTP}>
              <div className="form-group">
                <label>Waiter Mobile Number</label>
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
                <label>Waiter Mobile</label>
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
                {authLoading ? 'Authenticating...' : 'Verify & Enter Waiter Panel'}
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

  if (!['waiter', 'chef', 'manager'].includes(role)) {
    return (
      <div className="waiter-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="login-card" style={{ margin: '0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2>Access Denied</h2>
          <p>Your account role is "{role}". Only staff members can access the Waiter Dashboard.</p>
          <button className="btn" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="waiter-container">
      <header className="waiter-header">
        <div className="waiter-title-section">
          <div className="waiter-logo">🛎️</div>
          <div>
            <div className="waiter-title">Waiter Dashboard</div>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Role: {role.toUpperCase()}</span>
          </div>
        </div>

        <div className="kds-status-bar">
          <span className="kds-badge">
            <span className={`status-dot ${wsStatus === 'connected' ? 'status-connected' : wsStatus === 'connecting' ? 'status-connecting' : 'status-disconnected'}`} />
            WS: {wsStatus.toUpperCase()}
          </span>
          <button onClick={logout} className="btn" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="waiter-dashboard-grid">
        {/* SECTION 1: TABLE SERVICE REQUESTS */}
        <div className="waiter-section">
          <div className="waiter-section-title">
            <span>Table Alerts & Requests</span>
            <span className="column-count" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
              {requests.length} Pending
            </span>
          </div>
          <div className="waiter-list-container">
            {requests.length === 0 ? (
              <div className="waiter-no-items">All quiet. No table alerts.</div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="waiter-item-card" id={`waiter-req-${req.id}`}>
                  <div className="waiter-item-details">
                    <span className="waiter-card-title">Table {req.table_number}</span>
                    <span className={`waiter-request-tag tag-${req.request_type}`}>
                      {req.request_type_display.toUpperCase()}
                    </span>
                  </div>
                  <button
                    className="kds-btn btn-serve"
                    style={{ flex: '0 0 auto', width: 'auto' }}
                    onClick={() => completeServiceRequest(req.id)}
                    id={`btn-complete-req-${req.id}`}
                  >
                    Resolve Alert
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 2: FOOD READY TO SERVE */}
        <div className="waiter-section">
          <div className="waiter-section-title">
            <span>Ready to Serve (Pick up from Kitchen)</span>
            <span className="column-count" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
              {readyOrders.length} Ready
            </span>
          </div>
          <div className="waiter-list-container">
            {readyOrders.length === 0 ? (
              <div className="waiter-no-items">No food waiting at the kitchen pass.</div>
            ) : (
              readyOrders.map((order) => (
                <div key={order.id} className="waiter-item-card" id={`waiter-order-${order.id}`}>
                  <div className="waiter-item-details">
                    <span className="waiter-card-title">Table {order.table_number}</span>
                    <div className="waiter-card-desc">
                      {order.items.map((item, idx) => (
                        <div key={idx}>
                          {item.quantity}x {item.menu_item_name}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    className="kds-btn btn-serve"
                    style={{ flex: '0 0 auto', width: 'auto' }}
                    onClick={() => markOrderServed(order.id)}
                    id={`btn-serve-order-${order.id}`}
                  >
                    Food Served
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
