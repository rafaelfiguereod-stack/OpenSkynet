import { render, screen } from '@testing-library/react';
import { SessionStatus } from '@/components/sandbox/SessionStatus';

describe('SessionStatus Component', () => {
  const mockProps = {
    connectionStatus: 'disconnected' as const,
    controlMode: 'agent' as const,
    isStreaming: false,
  };

  it('renders connection status', () => {
    render(<SessionStatus {...mockProps} />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows correct status for connecting', () => {
    render(<SessionStatus {...mockProps} connectionStatus="connecting" />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('shows correct status for connected', () => {
    render(<SessionStatus {...mockProps} connectionStatus="connected" />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows correct status for error', () => {
    render(<SessionStatus {...mockProps} connectionStatus="error" />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows green animated dot for connected status', () => {
    const { container } = render(
      <SessionStatus {...mockProps} connectionStatus="connected" />
    );

    const dot = container.querySelector('.bg-green-500.animate-pulse');
    expect(dot).toBeInTheDocument();
  });

  it('shows yellow animated dot for connecting status', () => {
    const { container } = render(
      <SessionStatus {...mockProps} connectionStatus="connecting" />
    );

    const dot = container.querySelector('.bg-yellow-500.animate-pulse');
    expect(dot).toBeInTheDocument();
  });

  it('shows red dot for error status', () => {
    const { container } = render(
      <SessionStatus {...mockProps} connectionStatus="error" />
    );

    const dot = container.querySelector('.bg-red-500');
    expect(dot).toBeInTheDocument();
  });

  it('shows gray dot for disconnected status', () => {
    const { container } = render(
      <SessionStatus {...mockProps} connectionStatus="disconnected" />
    );

    const dot = container.querySelector('.bg-muted-foreground');
    expect(dot).toBeInTheDocument();
  });

  it('does not show control mode badge when disconnected', () => {
    render(<SessionStatus {...mockProps} connectionStatus="disconnected" />);

    expect(screen.queryByText('Agent Control')).not.toBeInTheDocument();
  });

  it('shows control mode badge when connected', () => {
    render(<SessionStatus {...mockProps} connectionStatus="connected" />);

    expect(screen.getByText('Agent Control')).toBeInTheDocument();
  });

  it('shows correct control mode badges', () => {
    const { rerender } = render(
      <SessionStatus {...mockProps} connectionStatus="connected" controlMode="agent" />
    );

    expect(screen.getByText('Agent Control')).toBeInTheDocument();

    rerender(
      <SessionStatus {...mockProps} connectionStatus="connected" controlMode="user" />
    );

    expect(screen.getByText('User Control')).toBeInTheDocument();

    rerender(
      <SessionStatus {...mockProps} connectionStatus="connected" controlMode="shared" />
    );

    expect(screen.getByText('Shared Control')).toBeInTheDocument();
  });

  it('shows agent control badge with blue color', () => {
    const { container } = render(
      <SessionStatus {...mockProps} connectionStatus="connected" controlMode="agent" />
    );

    const badge = screen.getByText('Agent Control').parentElement;
    expect(badge).toHaveClass('bg-blue-500/10', 'text-blue-500', 'border-blue-500/20');
  });

  it('shows user control badge with green color', () => {
    const { container } = render(
      <SessionStatus {...mockProps} connectionStatus="connected" controlMode="user" />
    );

    const badge = screen.getByText('User Control').parentElement;
    expect(badge).toHaveClass('bg-green-500/10', 'text-green-500', 'border-green-500/20');
  });

  it('shows shared control badge with purple color', () => {
    const { container } = render(
      <SessionStatus {...mockProps} connectionStatus="connected" controlMode="shared" />
    );

    const badge = screen.getByText('Shared Control').parentElement;
    expect(badge).toHaveClass('bg-purple-500/10', 'text-purple-500', 'border-purple-500/20');
  });

  it('does not show streaming indicator when not streaming', () => {
    render(<SessionStatus {...mockProps} isStreaming={false} />);

    expect(screen.queryByText('Streaming')).not.toBeInTheDocument();
  });

  it('shows streaming indicator when streaming', () => {
    render(<SessionStatus {...mockProps} isStreaming={true} />);

    expect(screen.getByText('Streaming')).toBeInTheDocument();
  });

  it('shows blue animated dot for streaming indicator', () => {
    const { container } = render(
      <SessionStatus {...mockProps} isStreaming={true} />
    );

    const dot = container.querySelector('.bg-blue-500.animate-pulse');
    expect(dot).toBeInTheDocument();
  });

  it('renders all indicators together when connected and streaming', () => {
    render(
      <SessionStatus
        connectionStatus="connected"
        controlMode="agent"
        isStreaming={true}
      />
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Agent Control')).toBeInTheDocument();
    expect(screen.getByText('Streaming')).toBeInTheDocument();
  });
});
