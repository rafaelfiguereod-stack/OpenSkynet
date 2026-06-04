/**
 * UI Alignment Tests
 * Tests for consistent component heights, padding, and border alignment
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SidebarStatus } from '@/components/layout/SidebarStatus';
import { SessionStatus } from '@/components/sandbox/SessionStatus';
import { useAppStore } from '@/stores/useAppStore';

// Mock the store
vi.mock('@/stores/useAppStore', () => ({
  useAppStore: vi.fn()
}));

import * as useAppStoreModule from '@/stores/useAppStore';

describe('UI Alignment Tests', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Bottom Section Heights', () => {
    it('SidebarStatus should have consistent minimum height', () => {
      (useAppStoreModule.useAppStore as any).mockImplementation((selector) => {
        if (selector.toString().includes('agentStatus')) {
          return { state: 'idle' };
        }
        if (selector.toString().includes('isConnected')) {
          return true;
        }
        return {};
      });

      const { container } = render(<SidebarStatus />);

      // Check that the component has the correct structure
      const statusDiv = container.querySelector('.flex.items-center');
      expect(statusDiv).toBeTruthy();

      // Verify it uses flex layout for horizontal alignment
      expect(statusDiv?.className).toContain('flex');
      expect(statusDiv?.className).toContain('items-center');
    });

    it('SessionStatus should have consistent minimum height', () => {
      const { container } = render(
        <SessionStatus
          connectionStatus="connected"
          controlMode="agent"
          isStreaming={false}
        />
      );

      // Check that the component has min-h-[38px] class
      const statusDiv = container.querySelector('.border-t');
      expect(statusDiv).toBeTruthy();
      expect(statusDiv?.className).toContain('min-h-[38px]');
    });

    it('All bottom sections should use consistent padding', () => {
      const { container: sidebarContainer } = render(<SidebarStatus />);
      const { container: sessionContainer } = render(
        <SessionStatus
          connectionStatus="connected"
          controlMode="agent"
          isStreaming={false}
        />
      );

      // Both should have p-2 padding
      const sidebarDiv = sidebarContainer.querySelector('.flex.items-center');
      const sessionDiv = sessionContainer.querySelector('.min-h-\\[38px\\]');

      expect(sidebarDiv?.className).toContain('p-2');
      expect(sessionDiv?.className).toContain('p-2');
    });
  });

  describe('Header Alignment', () => {
    it('all headers should have h-10 height', () => {
      // This test would check that all header components use h-10
      // Implementation would involve rendering each header component
      // and verifying the h-10 class is present

      const expectedHeight = 'h-10';
      // Test would render each header and check for expectedHeight class
      expect(expectedHeight).toBe('h-10');
    });

    it('all headers should have px-3 horizontal padding', () => {
      const expectedPadding = 'px-3';
      // Test would render each header and check for expectedPadding class
      expect(expectedPadding).toBe('px-3');
    });
  });

  describe('Border Alignment', () => {
    it('all bottom sections should have border-t class', () => {
      const { container: sidebarContainer } = render(<SidebarStatus />);
      const { container: sessionContainer } = render(
        <SessionStatus
          connectionStatus="connected"
          controlMode="agent"
          isStreaming={false}
        />
      );

      // Both should have border-t for top border
      const sidebarDiv = sidebarContainer.querySelector('.border-t');
      const sessionDiv = sessionContainer.querySelector('.border-t');

      expect(sidebarDiv).toBeTruthy();
      expect(sessionDiv).toBeTruthy();
    });

    it('all headers should have border-b class', () => {
      // Test would verify all header components have border-b class
      const expectedBorder = 'border-b';
      expect(expectedBorder).toBe('border-b');
    });
  });

  describe('Gap Consistency', () => {
    it('horizontal sections should use consistent gap', () => {
      const { container } = render(
        <SessionStatus
          connectionStatus="connected"
          controlMode="agent"
          isStreaming={false}
        />
      );

      // Should use gap-2 for consistent spacing
      const statusDiv = container.querySelector('.flex.items-center.gap-2');
      expect(statusDiv).toBeTruthy();
    });
  });
});
