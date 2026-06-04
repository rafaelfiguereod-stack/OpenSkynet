import { render, screen, fireEvent } from '@testing-library/react';
import { SandboxPanel } from '@/components/sandbox/SandboxPanel';
import { useSandbox } from '@/hooks/useSandbox';

// Mock the useSandbox hook
jest.mock('@/hooks/useSandbox');

describe('SandboxPanel Component', () => {
  const mockActions = {
    togglePanel: jest.fn(),
    setOpen: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    setControlMode: jest.fn(),
    setSandboxType: jest.fn(),
    clearError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when panel is closed', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: false,
        isActive: false,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'disconnected',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    const { container } = render(<SandboxPanel />);
    expect(container.firstChild).toBe(null);
  });

  it('renders when panel is open', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: false,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'disconnected',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    // Check for ControlBar elements
    expect(screen.getByRole('button', { name: 'Browser' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Computer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();

    // Check for empty state message
    expect(screen.getByText('Start the sandbox to view')).toBeInTheDocument();
  });

  it('shows loading state when connecting', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: false,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connecting',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    expect(screen.getByText('Loading sandbox...')).toBeInTheDocument();
  });

  it('shows error state when there is an error', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: false,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'error',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: 'Connection failed',
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows screenshot when available', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: true,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connected',
        lastScreenshot: 'base64screenshot',
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: true,
      },
      mockActions,
    ]);

    const { container } = render(<SandboxPanel />);

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,base64screenshot');
  });

  it('shows control mode toggle when active', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: true,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connected',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    expect(screen.getByRole('button', { name: 'Agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User' })).toBeInTheDocument();
  });

  it('calls setSandboxType when sandbox type is changed', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: false,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'disconnected',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Computer' }));
    expect(mockActions.setSandboxType).toHaveBeenCalledWith('computer');
  });

  it('calls start when Start button is clicked', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: false,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'disconnected',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(mockActions.clearError).toHaveBeenCalled();
    expect(mockActions.start).toHaveBeenCalledWith('browser');
  });

  it('calls stop when Stop button is clicked', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: true,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connected',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(mockActions.stop).toHaveBeenCalled();
  });

  it('calls setControlMode when control mode button is clicked', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: true,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connected',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'User' }));
    expect(mockActions.setControlMode).toHaveBeenCalledWith('user');
  });

  it('disables Start button when starting', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: false,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connecting',
        lastScreenshot: null,
        isStarting: true,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    const button = screen.getByRole('button', { name: 'Starting...' });
    expect(button).toBeDisabled();
  });

  it('shows session status with connection status', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: true,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connected',
        lastScreenshot: null,
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: false,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Agent Control')).toBeInTheDocument();
  });

  it('shows streaming indicator when streaming', () => {
    (useSandbox as jest.Mock).mockReturnValue([
      {
        isOpen: true,
        isActive: true,
        sandboxType: 'browser',
        controlMode: 'agent',
        connectionStatus: 'connected',
        lastScreenshot: 'screenshot',
        isStarting: false,
        isStopping: false,
        error: null,
        isStreaming: true,
      },
      mockActions,
    ]);

    render(<SandboxPanel />);

    expect(screen.getByText('Streaming')).toBeInTheDocument();
  });
});
