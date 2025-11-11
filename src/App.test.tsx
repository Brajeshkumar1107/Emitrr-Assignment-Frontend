import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

describe('Connect4 App', () => {
  test('renders login screen initially', () => {
    render(<App />);
    expect(screen.getByText('Connect 4')).toBeInTheDocument();
    expect(screen.getByText('Enter your username')).toBeInTheDocument();
  });

  test('validates username input', () => {
    render(<App />);
    const input = screen.getByPlaceholderText('Username');
    const button = screen.getByText('Play Game');

    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.click(button);
    expect(screen.getByText('Username must be between 3 and 20 characters')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'validUsername' } });
    fireEvent.click(button);
    expect(screen.queryByText('Username must be between 3 and 20 characters')).not.toBeInTheDocument();
  });

  test('shows game mode selection after login', async () => {
    render(<App />);
    const input = screen.getByPlaceholderText('Username');
    const button = screen.getByText('Play Game');

    fireEvent.change(input, { target: { value: 'testUser' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Choose your opponent')).toBeInTheDocument();
      expect(screen.getByText('Play with Computer')).toBeInTheDocument();
      expect(screen.getByText('Play with Friend')).toBeInTheDocument();
    });
  });
});
