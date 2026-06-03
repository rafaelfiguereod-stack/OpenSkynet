import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentPage } from '@/components/pages/AgentPage';

// Mock the chat service
jest.mock('@/services/chatService', () => ({
  getChatService: () => ({
    sendMessage: jest.fn(async (conversationId, content, options) => {
      options.onChunk('Hello response');
      options.onDone();
    }),
  }),
}));

describe('AgentPage Integration', () => {
  it('renders header with title and New Chat button', () => {
    render(<AgentPage />);
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('renders message input', () => {
    render(<AgentPage />);
    const input = screen.getByPlaceholderText(/Type your message/);
    expect(input).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<AgentPage />);
    const sendButton = screen.getByRole('button', { name: '' }); // Send button has no text, just icon
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has text', () => {
    render(<AgentPage />);
    const input = screen.getByPlaceholderText(/Type your message/);

    fireEvent.change(input, { target: { value: 'Hello' } });

    const sendButton = screen.getByRole('button');
    expect(sendButton).not.toBeDisabled();
  });
});
