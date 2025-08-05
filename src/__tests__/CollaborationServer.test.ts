/**
 * Comprehensive test suite for CollaborationServer
 * Tests all functionality including performance monitoring and error handling
 */

import { CollaborationServer } from '../core/CollaborationServer';
import { Server as HttpServer } from 'http';
import { WebSocket } from 'ws';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid');
const mockUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;

// Mock WebSocket for testing
class MockWebSocket {
  readyState = WebSocket.OPEN;
  messages: any[] = [];
  closed = false;
  closeCode?: number;
  closeReason?: string;

  send(data: string) {
    this.messages.push(JSON.parse(data));
  }

  close(code?: number, reason?: string) {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = WebSocket.CLOSED;
  }

  ping() {
    // Mock ping implementation
  }
}

describe('CollaborationServer', () => {
  let server: HttpServer;
  let collaborationServer: CollaborationServer;
  let mockSocket: MockWebSocket;
  let port: number;

  beforeEach((done) => {
    server = createServer();
    server.listen(0, () => {
      port = (server.address() as AddressInfo).port;
      collaborationServer = new CollaborationServer(server);
      mockSocket = new MockWebSocket();
      done();
    });
  });

  afterEach(() => {
    collaborationServer.shutdown();
    server.close();
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should handle new connections with IP logging', () => {
      const mockRequest = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        connection: { remoteAddress: '192.168.1.2' },
        socket: { remoteAddress: '192.168.1.3' }
      };

      const wss = (collaborationServer as any).wss;
      const connectionId = 'test-connection-1';
      mockUuid.mockReturnValue(connectionId);

      // Simulate connection
      wss.emit('connection', mockSocket, mockRequest);

      expect(mockSocket.readyState).toBe(WebSocket.OPEN);
    });

    it('should handle connection errors gracefully', () => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      // Simulate error
      mockSocket.emit('error', new Error('Test error'));

      expect(mockSocket.closed).toBe(true);
    });

    it('should close stale connections during health checks', (done) => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      // Join document
      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1',
        userName: 'Test User'
      }));

      // Simulate stale connection by setting last activity far in the past
      const connection = (collaborationServer as any).connections.values().next().value;
      connection.lastActivity = new Date(Date.now() - 120000); // 2 minutes ago

      // Trigger health check
      setTimeout(() => {
        expect(mockSocket.closed).toBe(true);
        done();
      }, 100);
    });
  });

  describe('Document Management', () => {
    it('should create new document sessions on first join', () => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'new-doc',
        userName: 'Test User'
      }));

      const document = (collaborationServer as any).documents.get('new-doc');
      expect(document).toBeDefined();
      expect(document.document.title).toBe('Document new-doc');
    });

    it('should validate required fields for document join', () => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      // Missing userId
      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        documentId: 'doc1',
        userName: 'Test User'
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('User ID is required')
        })
      );

      // Missing documentId
      mockSocket.messages = [];
      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        userName: 'Test User'
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Document ID is required')
        })
      );

      // Missing userName
      mockSocket.messages = [];
      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1'
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('User name is required')
        })
      );
    });

    it('should prevent duplicate document joins', () => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      // First join
      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1',
        userName: 'Test User'
      }));

      // Second join attempt
      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1',
        userName: 'Test User'
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Connection already joined')
        })
      );
    });

    it('should clean up empty documents', () => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      // Join document
      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'temp-doc',
        userName: 'Test User'
      }));

      expect((collaborationServer as any).documents.has('temp-doc')).toBe(true);

      // Disconnect
      mockSocket.emit('close');

      expect((collaborationServer as any).documents.has('temp-doc')).toBe(false);
    });
  });

  describe('Operation Handling', () => {
    beforeEach(() => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1',
        userName: 'Test User'
      }));
    });

    it('should validate operation structure', () => {
      // Missing operation
      mockSocket.emit('message', JSON.stringify({
        type: 'operation'
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Invalid operation format')
        })
      );

      // Missing required fields
      mockSocket.messages = [];
      mockSocket.emit('message', JSON.stringify({
        type: 'operation',
        operation: { type: 'insert' }
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Operation missing required fields')
        })
      );
    });

    it('should handle operation application errors', () => {
      const crdt = (collaborationServer as any).documents.get('doc1').crdt;
      jest.spyOn(crdt, 'applyRemoteOperation').mockImplementation(() => {
        throw new Error('CRDT operation failed');
      });

      mockSocket.emit('message', JSON.stringify({
        type: 'operation',
        operation: {
          type: 'insert',
          position: 0,
          content: 'test',
          userId: 'user1'
        }
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Failed to apply operation')
        })
      );
    });

    it('should update document metrics on successful operations', () => {
      const documentSession = (collaborationServer as any).documents.get('doc1');
      const initialOperations = documentSession.metrics.totalOperations;

      mockSocket.emit('message', JSON.stringify({
        type: 'operation',
        operation: {
          type: 'insert',
          position: 0,
          content: 'Hello',
          userId: 'user1'
        }
      }));

      expect(documentSession.metrics.totalOperations).toBe(initialOperations + 1);
    });
  });

  describe('Cursor and Selection Updates', () => {
    beforeEach(() => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1',
        userName: 'Test User'
      }));
    });

    it('should validate cursor updates', () => {
      // Invalid cursor format
      mockSocket.emit('message', JSON.stringify({
        type: 'cursor_update',
        cursor: { invalid: 'data' }
      }));

      // Should not throw error, just not broadcast
      expect(mockSocket.messages).not.toContainEqual(
        expect.objectContaining({
          type: EventType.CURSOR_CHANGED
        })
      );
    });

    it('should validate selection updates', () => {
      // Invalid selection format
      mockSocket.emit('message', JSON.stringify({
        type: 'selection_update',
        selection: { invalid: 'data' }
      }));

      // Should not throw error, just not broadcast
      expect(mockSocket.messages).not.toContainEqual(
        expect.objectContaining({
          type: EventType.SELECTION_CHANGED
        })
      );
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(() => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1',
        userName: 'Test User'
      }));
    });

    it('should handle get_metrics requests', () => {
      mockSocket.emit('message', JSON.stringify({
        type: 'get_metrics'
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'metrics',
          data: expect.objectContaining({
            server: expect.any(Object),
            document: expect.any(Object)
          })
        })
      );
    });

    it('should provide accurate server metrics', () => {
      const metrics = collaborationServer.getServerMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        totalConnections: expect.any(Number),
        activeDocuments: expect.any(Number),
        peakConnections: expect.any(Number),
        totalMessages: expect.any(Number),
        uptime: expect.any(Date)
      }));
    });

    it('should provide accurate document metrics', () => {
      const metrics = collaborationServer.getDocumentMetrics('doc1');
      
      expect(metrics).toEqual(expect.objectContaining({
        totalOperations: expect.any(Number),
        totalUsers: expect.any(Number),
        peakConcurrentUsers: expect.any(Number),
        activeConnections: expect.any(Number),
        lastActivity: expect.any(Date),
        documentSize: expect.any(Number)
      }));
    });

    it('should provide performance metrics', () => {
      const metrics = collaborationServer.getPerformanceMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        latency: expect.any(Number),
        throughput: expect.any(Number),
        concurrentUsers: expect.any(Number),
        operationCount: expect.any(Number),
        memoryUsage: expect.any(Number)
      }));
    });

    it('should track peak concurrent users', () => {
      const wss = (collaborationServer as any).wss;
      const mockSocket2 = new MockWebSocket();
      
      wss.emit('connection', mockSocket2, {});
      mockSocket2.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user2',
        documentId: 'doc1',
        userName: 'User 2'
      }));

      const documentSession = (collaborationServer as any).documents.get('doc1');
      expect(documentSession.metrics.peakConcurrentUsers).toBe(2);
    });
  });

  describe('Message Handling', () => {
    it('should validate message structure', () => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      // Invalid message format
      mockSocket.emit('message', 'invalid-json');

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Invalid message format')
        })
      );

      // Missing type
      mockSocket.messages = [];
      mockSocket.emit('message', JSON.stringify({ data: 'test' }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Message must have a type field')
        })
      );
    });

    it('should handle unknown message types', () => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      mockSocket.emit('message', JSON.stringify({
        type: 'unknown_type'
      }));

      expect(mockSocket.messages).toContainEqual(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Unknown message type')
        })
      );
    });
  });

  describe('User Color Generation', () => {
    it('should generate unique colors for users', () => {
      const colors = new Set();
      for (let i = 0; i < 100; i++) {
        const color = (collaborationServer as any).generateUserColor();
        colors.add(color);
      }
      
      // Should have reasonable color diversity
      expect(colors.size).toBeGreaterThan(5);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast messages to all clients in document except sender', () => {
      const wss = (collaborationServer as any).wss;
      const mockSocket1 = new MockWebSocket();
      const mockSocket2 = new MockWebSocket();
      
      wss.emit('connection', mockSocket1, {});
      wss.emit('connection', mockSocket2, {});

      // Both join same document
      mockSocket1.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1',
        userName: 'User 1'
      }));

      mockSocket2.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user2',
        documentId: 'doc1',
        userName: 'User 2'
      }));

      // Clear initial messages
      mockSocket1.messages = [];
      mockSocket2.messages = [];

      // Send operation from user1
      mockSocket1.emit('message', JSON.stringify({
        type: 'operation',
        operation: {
          type: 'insert',
          position: 0,
          content: 'test',
          userId: 'user1'
        }
      }));

      // User2 should receive the operation, user1 should not
      expect(mockSocket2.messages).toHaveLength(1);
      expect(mockSocket1.messages).toHaveLength(0);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', () => {
      const wss = (collaborationServer as any).wss;
      wss.emit('connection', mockSocket, {});

      mockSocket.emit('message', JSON.stringify({
        type: 'join_document',
        userId: 'user1',
        documentId: 'doc1',
        userName: 'Test User'
      }));

      const closeSpy = jest.spyOn((collaborationServer as any).wss, 'close');
      
      collaborationServer.shutdown();

      expect(closeSpy).toHaveBeenCalled();
      expect(mockSocket.closed).toBe(true);
      expect(mockSocket.closeCode).toBe(1001);
      expect(mockSocket.closeReason).toBe('Server shutting down');
    });
  });
});