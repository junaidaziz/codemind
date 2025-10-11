import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';

// Mock user data for testing
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user' as const,
  profile: {
    firstName: 'Test',
    lastName: 'User',
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockAdminUser = {
  ...mockUser,
  id: 'test-admin-id',
  email: 'admin@example.com',
  role: 'admin' as const,
};

export const mockProject = {
  id: 'test-project-id',
  name: 'Test Project',
  description: 'A test project for unit testing',
  status: 'active' as const,
  repositoryUrl: 'https://github.com/test/repo.git',
  language: 'typescript',
  filesCount: 10,
  chunksCount: 50,
  indexingProgress: 100,
  lastIndexed: new Date(),
  userId: mockUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockChatSession = {
  id: 'test-session-id',
  title: 'Test Chat Session',
  projectId: mockProject.id,
  userId: mockUser.id,
  messageCount: 2,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockChatMessage = {
  id: 'test-message-id',
  sessionId: mockChatSession.id,
  role: 'user' as const,
  content: 'How does authentication work?',
  sources: [],
  createdAt: new Date(),
};

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialUser?: typeof mockUser | typeof mockAdminUser | null;
  preloadedState?: Record<string, unknown>;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const { initialUser, ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    // Mock AuthProvider for testing - initialUser can be used for context setup
    const contextValue = initialUser || null;
    return React.createElement(
      'div', 
      { 'data-testid': 'auth-provider', 'data-user': contextValue?.id || 'anonymous' }, 
      children
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// Custom matchers and utilities
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

// Mock API response helpers
export const createMockApiResponse = <T>(data: T, success: boolean = true) => ({
  success,
  data,
  ...(success ? {} : { error: { code: 'TEST_ERROR', message: 'Test error' } }),
});

export const createMockApiError = (code: string, message: string) => ({
  success: false,
  error: {
    code,
    message,
  },
});

// Database mock helpers
export const mockDbResponse = <T>(data: T) => Promise.resolve(data);
export const mockDbError = (error: Error) => Promise.reject(error);

// Test data generators
export const generateTestUser = (overrides: Partial<typeof mockUser> = {}) => ({
  ...mockUser,
  ...overrides,
  id: overrides.id || `test-user-${Date.now()}`,
});

export const generateTestProject = (overrides: Partial<typeof mockProject> = {}) => ({
  ...mockProject,
  ...overrides,
  id: overrides.id || `test-project-${Date.now()}`,
});

export const generateTestChatSession = (overrides: Partial<typeof mockChatSession> = {}) => ({
  ...mockChatSession,
  ...overrides,
  id: overrides.id || `test-session-${Date.now()}`,
});

// Async test helpers
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Mock localStorage
export const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Mock window.location
export const mockWindowLocation = (url: string) => {
  const location = new URL(url);
  Object.defineProperty(window, 'location', {
    value: {
      href: location.href,
      origin: location.origin,
      protocol: location.protocol,
      host: location.host,
      hostname: location.hostname,
      port: location.port,
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
    },
    writable: true,
  });
};

// Console output capture for testing logs
export const captureConsoleOutput = () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    logs.push(args.join(' '));
  };

  console.error = (...args) => {
    errors.push(args.join(' '));
  };

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
};

// Test environment setup helpers
export const setupTestEnvironment = () => {
  // Mock IntersectionObserver
  global.IntersectionObserver = class MockIntersectionObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof IntersectionObserver;

  // Mock ResizeObserver
  global.ResizeObserver = class MockResizeObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock window.scrollTo
  window.scrollTo = jest.fn();

  // Setup localStorage mock
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
  });
};

// Call setup by default
setupTestEnvironment();