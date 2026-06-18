import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi, beforeEach } from 'vitest';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import api from './services/api';

// Mock the api service module
vi.mock('./services/api', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    }
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Set default window location query params
  delete window.location;
  window.location = new URL('http://localhost/?restaurant=1&table=12');
});

test('renders welcome login header and input field when table context is active', () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Mobile Number/i)).toBeInTheDocument();
});

test('displays QR scan warning when table context is missing', () => {
  // Set location with missing query params
  delete window.location;
  window.location = new URL('http://localhost/');

  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  expect(screen.getByText(/QR Code Scan Required/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/Mobile Number/i)).not.toBeInTheDocument();
});

test('allows typing mobile and displays OTP verification view on success', async () => {
  api.post.mockResolvedValueOnce({
    status: 200,
    data: { status: 'success', message: 'OTP sent successfully.' }
  });

  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  const input = screen.getByLabelText(/Mobile Number/i);
  fireEvent.change(input, { target: { value: '+1234567890' } });
  expect(input.value).toBe('+1234567890');

  const submitBtn = screen.getByRole('button', { name: /Send OTP/i });
  fireEvent.click(submitBtn);

  await waitFor(() => {
    expect(screen.getByLabelText(/Enter OTP Code/i)).toBeInTheDocument();
  });
});
