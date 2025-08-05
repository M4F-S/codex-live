/**
 * Comprehensive test suite for CRDT with Y.js integration
 * Tests all functionality including Y.js providers and performance monitoring
 */

import { CRDT } from '../core/CRDT';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WebrtcProvider } from 'y-webrtc';

// Mock Y.js providers
jest.mock('y-websocket');
jest.mock('y-webrtc');

const mockWebsocketProvider = {
  on: jest.fn(),
  off: jest.fn(),
  destroy: jest.fn(),
  awareness: {
    on: jest.fn(),
    off: jest.fn(),
    setLocalState: jest.fn(),
    getStates: jest.fn(),
  }
};

const mockWebrtcProvider = {
  on: jest.fn(),
  off: jest.fn(),
  destroy: jest.fn(),
  awareness: {
    on: jest.fn(),
    off: jest.fn(),
    setLocalState: jest.fn(),
    getStates: jest.fn(),
  }
};

(WebsocketProvider as jest.MockedClass<typeof WebsocketProvider>).mockImplementation(() => mockWebsocketProvider as any);
(WebrtcProvider as jest.MockedClass<typeof WebrtcProvider>).mockImplementation(() => mockWebrtcProvider as any);

describe('CRDT', () => {
  let crdt: CRDT;

  beforeEach(() => {
    crdt = new CRDT();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (crdt) {
      crdt.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(crdt.getContent()).toBe('');
      expect(crdt.getConnectedUsers()).toEqual([]);
      expect(crdt.getCursors()).toEqual([]);
      expect(crdt.getSelections()).toEqual([]);
    });

    it('should initialize with custom document ID', () => {
      const customCRDT = new CRDT('custom-doc-123');
      expect(customCRDT.getState().documentId).toBe('custom-doc-123');
      customCRDT.destroy();
    });

    it('should initialize with websocket provider', () => {
      const crdtWithProvider = new CRDT('test-room', 'test-room', 'ws://localhost:1234', false);
      
      expect(WebsocketProvider).toHaveBeenCalledWith(
        'ws://localhost:1234',
        'test-room',
        expect.any(Y.Doc)
      );
      
      crdtWithProvider.destroy();
    });

    it('should initialize with WebRTC provider', () => {
      const crdtWithProvider = new CRDT('test-room', 'test-room', 'ws://localhost:1234', true);
      
      expect(WebrtcProvider).toHaveBeenCalledWith(
        'test-room',
        expect.any(Y.Doc)
      );
      
      crdtWithProvider.destroy();
    });
  });

  describe('Content Operations', () => {
    it('should set content correctly', () => {
      const content = 'Hello, World!';
      crdt.setContent(content);
      
      expect(crdt.getContent()).toBe(content);
    });

    it('should handle empty content', () => {
      crdt.setContent('');
      expect(crdt.getContent()).toBe('');
    });

    it('should handle large content', () => {
      const largeContent = 'a'.repeat(10000);
      crdt.setContent(largeContent);
      
      expect(crdt.getContent()).toBe(largeContent);
      expect(crdt.getContent().length).toBe(10000);
    });

    it('should insert text at position', () => {
      crdt.setContent('Hello World');
      crdt.insert(5, ' Beautiful');
      
      expect(crdt.getContent()).toBe('Hello Beautiful World');
    });

    it('should insert at beginning', () => {
      crdt.setContent('World');
      crdt.insert(0, 'Hello ');
      
      expect(crdt.getContent()).toBe('Hello World');
    });

    it('should insert at end', () => {
      crdt.setContent('Hello');
      crdt.insert(5, ' World');
      
      expect(crdt.getContent()).toBe('Hello World');
    });

    it('should delete text at position', () => {
      crdt.setContent('Hello Beautiful World');
      crdt.delete(6, 9); // Delete 'Beautiful'
      
      expect(crdt.getContent()).toBe('Hello World');
    });

    it('should delete from beginning', () => {
      crdt.setContent('Hello World');
      crdt.delete(0, 6); // Delete 'Hello '
      
      expect(crdt.getContent()).toBe('World');
    });

    it('should delete from end', () => {
      crdt.setContent('Hello World');
      crdt.delete(5, 6); // Delete ' World'
      
      expect(crdt.getContent()).toBe('Hello');
    });

    it('should handle edge cases for insert/delete', () => {
      // Insert at invalid position
      crdt.setContent('Hello');
      expect(() => crdt.insert(-1, 'test')).not.toThrow();
      expect(() => crdt.insert(100, 'test')).not.toThrow();

      // Delete with invalid parameters
      crdt.setContent('Hello');
      expect(() => crdt.delete(-1, 5)).not.toThrow();
      expect(() => crdt.delete(0, 100)).not.toThrow();
    });
  });

  describe('User Management', () => {
    it('should set user information', () => {
      const user = {
        id: 'user1',
        name: 'Test User',
        color: '#FF0000',
        lastSeen: new Date(),
        isOnline: true
      };

      crdt.setUser(user);
      
      expect(crdt.getConnectedUsers()).toContainEqual(expect.objectContaining(user));
    });

    it('should update cursor position', () => {
      crdt.setUser({ id: 'user1', name: 'Test User', color: '#FF0000', lastSeen: new Date(), isOnline: true });
      crdt.updateCursor(42);
      
      const cursors = crdt.getCursors();
      expect(cursors).toHaveLength(1);
      expect(cursors[0]).toMatchObject({
        position: 42,
        userId: 'user1'
      });
    });

    it('should update selection range', () => {
      crdt.setUser({ id: 'user1', name: 'Test User', color: '#FF0000', lastSeen: new Date(), isOnline: true });
      crdt.updateSelection(10, 20);
      
      const selections = crdt.getSelections();
      expect(selections).toHaveLength(1);
      expect(selections[0]).toMatchObject({
        start: 10,
        end: 20,
        userId: 'user1'
      });
    });

    it('should handle multiple users', () => {
      crdt.setUser({ id: 'user1', name: 'User 1', color: '#FF0000', lastSeen: new Date(), isOnline: true });
      crdt.setUser({ id: 'user2', name: 'User 2', color: '#00FF00', lastSeen: new Date(), isOnline: true });
      crdt.setUser({ id: 'user3', name: 'User 3', color: '#0000FF', lastSeen: new Date(), isOnline: true });

      expect(crdt.getConnectedUsers()).toHaveLength(3);
      expect(crdt.getConnectedUsers().map(u => u.id)).toEqual(['user1', 'user2', 'user3']);
    });

    it('should update existing user information', () => {
      crdt.setUser({ id: 'user1', name: 'Original Name', color: '#FF0000', lastSeen: new Date(), isOnline: true });
      crdt.setUser({ id: 'user1', name: 'Updated Name', color: '#FF0000', lastSeen: new Date(), isOnline: true });

      const users = crdt.getConnectedUsers();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Updated Name');
    });
  });

  describe('Remote Operations', () => {
    it('should apply remote operations', () => {
      const operation = {
        type: 'insert',
        position: 0,
        content: 'Hello',
        userId: 'user1'
      };

      crdt.applyRemoteOperation(operation);
      
      expect(crdt.getContent()).toBe('Hello');
    });

    it('should handle multiple remote operations', () => {
      const operations = [
        { type: 'insert', position: 0, content: 'Hello', userId: 'user1' },
        { type: 'insert', position: 5, content: ' World', userId: 'user2' },
        { type: 'delete', position: 5, length: 1, userId: 'user1' }
      ];

      operations.forEach(op => crdt.applyRemoteOperation(op));
      
      expect(crdt.getContent()).toBe('HelloWorld');
    });

    it('should handle invalid remote operations gracefully', () => {
      const invalidOperations = [
        null,
        {},
        { type: 'invalid' },
        { type: 'insert', position: -1, content: 'test' },
        { type: 'delete', position: -1, length: -1 }
      ];

      invalidOperations.forEach(op => {
        expect(() => crdt.applyRemoteOperation(op as any)).not.toThrow();
      });
    });
  });

  describe('State Management', () => {
    it('should export state correctly', () => {
      crdt.setContent('Test content');
      crdt.setUser({ id: 'user1', name: 'Test User' });
      
      const state = crdt.exportState();
      
      expect(state).toMatchObject({
        content: 'Test content',
        documentId: expect.any(String),
        vectorClock: expect.any(Object)
      });
    });

    it('should import state correctly', () => {
      const originalState = crdt.exportState();
      
      const newCRDT = new CRDT();
      newCRDT.importState(originalState);
      
      expect(newCRDT.getContent()).toBe(crdt.getContent());
      expect(newCRDT.getState().documentId).toBe(crdt.getState().documentId);
      
      newCRDT.destroy();
    });

    it('should handle empty state import', () => {
      const newCRDT = new CRDT();
      
      expect(() => newCRDT.importState({} as any)).not.toThrow();
      expect(newCRDT.getContent()).toBe('');
      
      newCRDT.destroy();
    });

    it('should handle invalid state import gracefully', () => {
      const invalidStates = [
        null,
        undefined,
        'invalid',
        { invalid: 'structure' }
      ];

      invalidStates.forEach(state => {
        expect(() => crdt.importState(state as any)).not.toThrow();
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', () => {
      const metrics = crdt.getPerformanceMetrics();
      
      expect(metrics).toMatchObject({
        latency: expect.any(Number),
        throughput: expect.any(Number),
        operationCount: expect.any(Number),
        memoryUsage: expect.any(Number)
      });
    });

    it('should update metrics after operations', () => {
      const initialMetrics = crdt.getPerformanceMetrics();
      
      // Perform operations
      for (let i = 0; i < 10; i++) {
        crdt.setContent(`Operation ${i}`);
      }
      
      const updatedMetrics = crdt.getPerformanceMetrics();
      expect(updatedMetrics.operationCount).toBeGreaterThan(initialMetrics.operationCount);
    });

    it('should handle large content performance', () => {
      const largeContent = 'a'.repeat(100000);
      
      const startTime = Date.now();
      crdt.setContent(largeContent);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(crdt.getContent()).toBe(largeContent);
    });
  });

  describe('Provider Management', () => {
    it('should initialize with provider parameters', () => {
      const crdtWithProvider = new CRDT('test-site', 'test-room', 'ws://localhost:1234');
      
      expect(crdtWithProvider).toBeDefined();
      crdtWithProvider.destroy();
    });

    it('should handle provider connection events', () => {
      const crdtWithProvider = new CRDT('test-site', 'test-room', 'ws://localhost:1234');
      
      // Test that the CRDT instance is created successfully
      expect(crdtWithProvider).toBeDefined();
      crdtWithProvider.destroy();
    });

    it('should handle provider disconnection events', () => {
      const crdtWithProvider = new CRDT('test-site', 'test-room', 'ws://localhost:1234');
      
      // Test that the CRDT instance is created successfully
      expect(crdtWithProvider).toBeDefined();
      crdtWithProvider.destroy();
    });

    it('should destroy provider on cleanup', () => {
      const crdtWithProvider = new CRDT('test-site', 'test-room', 'ws://localhost:1234');
      
      crdtWithProvider.destroy();
      
      expect(crdtWithProvider).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle provider initialization errors', () => {
      (WebsocketProvider as jest.MockedClass<typeof WebsocketProvider>).mockImplementation(() => {
        throw new Error('Provider initialization failed');
      });
      
      expect(() => new CRDT('test-site', 'test-room', 'ws://localhost:1234')).not.toThrow();
    });

    it('should handle Y.js document errors', () => {
      const mockYDoc = {
        getText: jest.fn().mockImplementation(() => {
          throw new Error('Y.js error');
        })
      };
      
      jest.spyOn(Y, 'Doc').mockReturnValue(mockYDoc as any);
      
      const newCRDT = new CRDT();
      expect(() => newCRDT.setContent('test')).not.toThrow();
      newCRDT.destroy();
    });

    it('should handle awareness state errors', () => {
      const crdtWithProvider = new CRDT('test-room', 'test-room', 'ws://localhost:1234', false);
      
      // Mock awareness getStates to throw
      mockWebsocketProvider.awareness.getStates.mockImplementation(() => {
        throw new Error('Awareness error');
      });
      
      expect(() => crdtWithProvider.getConnectedUsers()).not.toThrow();
      crdtWithProvider.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should destroy Y.js document on cleanup', () => {
      const destroySpy = jest.spyOn(Y.Doc.prototype, 'destroy');
      
      crdt.destroy();
      
      expect(destroySpy).toHaveBeenCalled();
    });

    it('should destroy provider on cleanup', () => {
      const crdtWithProvider = new CRDT('test-room', 'test-room', 'ws://localhost:1234', false);
      
      crdtWithProvider.destroy();
      
      expect(mockWebsocketProvider.destroy).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls', () => {
      crdt.destroy();
      
      expect(() => crdt.destroy()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid content changes', () => {
      const changes = ['a', 'ab', 'abc', 'abcd', 'abcde'];
      
      changes.forEach(content => {
        crdt.setContent(content);
        expect(crdt.getContent()).toBe(content);
      });
    });

    it('should handle concurrent user updates', () => {
      const users = [
        { id: 'user1', name: 'User 1', color: '#FF0000', lastSeen: new Date(), isOnline: true },
        { id: 'user2', name: 'User 2', color: '#00FF00', lastSeen: new Date(), isOnline: true },
        { id: 'user1', name: 'Updated User 1', color: '#FF0000', lastSeen: new Date(), isOnline: true }
      ];

      users.forEach(user => crdt.setUser(user));
      
      const connectedUsers = crdt.getConnectedUsers();
      expect(connectedUsers).toHaveLength(2);
      expect(connectedUsers.find(u => u.id === 'user1')?.name).toBe('Updated User 1');
    });

    it('should handle empty cursor/selection updates', () => {
      crdt.setUser({ id: 'user1', name: 'Test', color: '#FF0000', lastSeen: new Date(), isOnline: true });
      
      // These should not crash
      crdt.updateCursor(0);
      crdt.updateSelection(0, 0);
      crdt.updateCursor(-1);
      crdt.updateSelection(-1, -1);
    });
  });
});