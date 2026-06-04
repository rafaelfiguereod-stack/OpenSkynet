import { render, screen } from '@testing-library/react';
import { SandboxView } from '@/components/sandbox/SandboxView';

describe('SandboxView Component', () => {
  it('renders loading state when isLoading is true', () => {
    const { container } = render(
      <SandboxView screenshot={null} isLoading={true} error={null} />
    );

    expect(screen.getByText('Loading sandbox...')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders error state when error is provided', () => {
    const errorMessage = 'Failed to connect to sandbox';
    render(
      <SandboxView screenshot={null} isLoading={false} error={errorMessage} />
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('!')).toBeInTheDocument();
  });

  it('renders empty state when not loading, no error, and no screenshot', () => {
    render(
      <SandboxView screenshot={null} isLoading={false} error={null} />
    );

    expect(screen.getByText('Start the sandbox to view')).toBeInTheDocument();
  });

  it('renders screenshot when provided', () => {
    const screenshot = 'base64encodedscreenshotdata';
    const { container } = render(
      <SandboxView screenshot={screenshot} isLoading={false} error={null} />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,base64encodedscreenshotdata');
    expect(img).toHaveAttribute('alt', 'Sandbox view');
  });

  it('shows loading state priority over error', () => {
    render(
      <SandboxView screenshot={null} isLoading={true} error="Error message" />
    );

    expect(screen.getByText('Loading sandbox...')).toBeInTheDocument();
    expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  });

  it('shows loading state priority over screenshot', () => {
    const { container } = render(
      <SandboxView screenshot="screenshot" isLoading={true} error={null} />
    );

    expect(screen.getByText('Loading sandbox...')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('shows error state priority over screenshot', () => {
    render(
      <SandboxView screenshot="screenshot" isLoading={false} error="Error" />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Start the sandbox to view')).not.toBeInTheDocument();
  });
});
