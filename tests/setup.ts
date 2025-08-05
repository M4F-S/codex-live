/**
 * Jest test setup file
 * Configures global test environment and utilities
 */

// Skip TextEncoder/TextDecoder polyfill since jsdom provides them

// Mock WebSocket for Node.js environment
(global as any).WebSocket = class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  
  readyState = 1;
  onopen = jest.fn();
  onclose = jest.fn();
  onmessage = jest.fn();
  onerror = jest.fn();
  
  send = jest.fn();
  close = jest.fn();
} as any;

// Mock WebSocketServer
jest.mock('ws', () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    close: jest.fn(),
    clients: new Set(),
  })),
}));

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
} as any;

// Mock localStorage
(global as any).localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0,
} as any;

// Mock sessionStorage
(global as any).sessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0,
} as any;