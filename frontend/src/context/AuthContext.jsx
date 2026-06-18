import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('access_token');
    const savedMobile = localStorage.getItem('mobile_number');
    const savedRole = localStorage.getItem('role');
    if (savedToken && savedMobile) {
      setAccessToken(savedToken);
      setMobile(savedMobile);
      setRole(savedRole || '');
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const sendOtp = async (mobileNumber) => {
    try {
      const response = await api.post('/api/auth/send-otp/', { mobile: mobileNumber });
      return { success: true, message: response.data.message };
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to send OTP.';
      return { success: false, error: errorMsg };
    }
  };

  const verifyOtp = async (mobileNumber, code) => {
    try {
      const response = await api.post('/api/auth/verify-otp/', { mobile: mobileNumber, code });
      const { access, refresh, role: userRole } = response.data;
      
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('mobile_number', mobileNumber);
      localStorage.setItem('role', userRole || 'customer');
      
      setAccessToken(access);
      setMobile(mobileNumber);
      setRole(userRole || 'customer');
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Invalid OTP code.';
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('mobile_number');
    localStorage.removeItem('role');
    setAccessToken('');
    setMobile('');
    setRole('');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ accessToken, mobile, role, isAuthenticated, loading, sendOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
