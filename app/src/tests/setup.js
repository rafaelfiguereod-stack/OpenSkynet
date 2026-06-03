require('@testing-library/jest-dom');

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(function(query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  }),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(function() {
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  };
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(function() {
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  };
});

// Mock react-markdown and related packages
jest.mock('react-markdown', function() {
  return {
    __esModule: true,
    default: function ReactMarkdownMock({ children }) {
      return React.createElement('div', null, children);
    },
  };
});

jest.mock('remark-gfm', function() {
  return {
    __esModule: true,
    default: function() {},
  };
});

jest.mock('rehype-highlight', function() {
  return {
    __esModule: true,
    default: function() {},
  };
});
