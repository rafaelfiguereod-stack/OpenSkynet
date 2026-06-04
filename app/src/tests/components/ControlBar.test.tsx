import { render, screen, fireEvent } from '@testing-library/react';
import { ControlBar } from '@/components/sandbox/ControlBar';

describe('ControlBar Component', () => {
  const mockProps = {
    sandboxType: 'browser' as const,
    controlMode: 'agent' as const,
    isStarting: false,
    isStopping: false,
    isActive: false,
    onSandboxTypeChange: jest.fn(),
    onControlModeChange: jest.fn(),
    onStart: jest.fn(),
    onStop: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sandbox type selector', () => {
    render(<ControlBar {...mockProps} />);

    expect(screen.getByRole('button', { name: 'Browser' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Computer' })).toBeInTheDocument();
  });

  it('highlights current sandbox type', () => {
    const { rerender } = render(<ControlBar {...mockProps} sandboxType="browser" />);

    let browserButton = screen.getByRole('button', { name: 'Browser' });
    expect(browserButton).toHaveClass('bg-secondary');

    rerender(<ControlBar {...mockProps} sandboxType="computer" />);

    browserButton = screen.getByRole('button', { name: 'Browser' });
    expect(browserButton).not.toHaveClass('bg-secondary');

    const computerButton = screen.getByRole('button', { name: 'Computer' });
    expect(computerButton).toHaveClass('bg-secondary');
  });

  it('calls onSandboxTypeChange when type buttons are clicked', () => {
    render(<ControlBar {...mockProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Browser' }));
    expect(mockProps.onSandboxTypeChange).toHaveBeenCalledWith('browser');

    fireEvent.click(screen.getByRole('button', { name: 'Computer' }));
    expect(mockProps.onSandboxTypeChange).toHaveBeenCalledWith('computer');
  });

  it('does not render control mode toggle when not active', () => {
    render(<ControlBar {...mockProps} isActive={false} />);

    expect(screen.queryByRole('button', { name: 'Agent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'User' })).not.toBeInTheDocument();
  });

  it('renders control mode toggle when active', () => {
    render(<ControlBar {...mockProps} isActive={true} />);

    expect(screen.getByRole('button', { name: 'Agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User' })).toBeInTheDocument();
  });

  it('highlights current control mode', () => {
    const { rerender } = render(
      <ControlBar {...mockProps} isActive={true} controlMode="agent" />
    );

    let agentButton = screen.getByRole('button', { name: 'Agent' });
    expect(agentButton).toHaveClass('bg-secondary');

    rerender(<ControlBar {...mockProps} isActive={true} controlMode="user" />);

    agentButton = screen.getByRole('button', { name: 'Agent' });
    expect(agentButton).not.toHaveClass('bg-secondary');

    const userButton = screen.getByRole('button', { name: 'User' });
    expect(userButton).toHaveClass('bg-secondary');
  });

  it('calls onControlModeChange when mode buttons are clicked', () => {
    render(<ControlBar {...mockProps} isActive={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agent' }));
    expect(mockProps.onControlModeChange).toHaveBeenCalledWith('agent');

    fireEvent.click(screen.getByRole('button', { name: 'User' }));
    expect(mockProps.onControlModeChange).toHaveBeenCalledWith('user');
  });

  it('renders Start button when not active', () => {
    render(<ControlBar {...mockProps} isActive={false} />);

    const startButton = screen.getByRole('button', { name: 'Start' });
    expect(startButton).toBeInTheDocument();
    expect(startButton).toHaveTextContent('Start');
  });

  it('renders Stop button when active', () => {
    render(<ControlBar {...mockProps} isActive={true} />);

    const stopButton = screen.getByRole('button', { name: 'Stop' });
    expect(stopButton).toBeInTheDocument();
    expect(stopButton).toHaveTextContent('Stop');
  });

  it('calls onStart when Start button is clicked', () => {
    render(<ControlBar {...mockProps} isActive={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(mockProps.onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when Stop button is clicked', () => {
    render(<ControlBar {...mockProps} isActive={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(mockProps.onStop).toHaveBeenCalledTimes(1);
  });

  it('disables button when starting', () => {
    render(<ControlBar {...mockProps} isStarting={true} />);

    const button = screen.getByRole('button', { name: 'Starting...' });
    expect(button).toBeDisabled();
  });

  it('disables button when stopping', () => {
    render(<ControlBar {...mockProps} isStopping={true} />);

    const button = screen.getByRole('button', { name: 'Stopping...' });
    expect(button).toBeDisabled();
  });

  it('shows destructive variant for Stop button', () => {
    render(<ControlBar {...mockProps} isActive={true} />);

    const stopButton = screen.getByRole('button', { name: 'Stop' });
    expect(stopButton).toHaveClass('bg-destructive');
  });

  it('shows default variant for Start button', () => {
    render(<ControlBar {...mockProps} isActive={false} />);

    const startButton = screen.getByRole('button', { name: 'Start' });
    expect(startButton).toHaveClass('bg-primary');
  });
});
