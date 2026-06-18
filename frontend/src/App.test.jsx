import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi, beforeEach } from 'vitest';
import App from './App';

// Mock global fetch
global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

test('renders welcome login header by default', () => {
  render(<App />);
  expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Mobile Number/i)).toBeInTheDocument();
});

test('allows typing mobile and displays OTP verification view on success', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status: 'success', message: 'OTP sent successfully.' }),
  });

  render(<App />);
  const input = screen.getByLabelText(/Mobile Number/i);
  fireEvent.change(input, { target: { value: '+1234567890' } });
  expect(input.value).toBe('+1234567890');

  const submitBtn = screen.getByRole('button', { name: /Send OTP/i });
  fireEvent.click(submitBtn);

  await waitFor(() => {
    expect(screen.getByLabelText(/Enter OTP Code/i)).toBeInTheDocument();
  });
});
