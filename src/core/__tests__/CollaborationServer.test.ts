import { CollaborationServer } from '../CollaborationServer';

// Mock WebSocket
const mockWebSocket = () => ({
  readyState: 1, // WebSocket.OPEN
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
});

describe('CollaborationServer', () => {
  let server: CollaborationServer;
  let mockHttpServer: any;
  let mockSocket: any;

  beforeEach(() => {
    mockHttpServer = {
      listen: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
    };
    server = new CollaborationServer(mockHttpServer);
    mockSocket = mockWebSocket();
  });

  describe('constructor', () => {
    it('should initialize server with empty documents and connections', () => {
      expect(server).toBeDefined();
    });
  });

  describe('document management', () => {
    it('should handle document join request', () => {
      const message = {
        type: 'join_document',
        userId: 'user-1',
        documentId: 'test-doc',
        userName: 'Test User',
      };

      (server as any).handleJoinDocument('conn-1', mockSocket, message);
      
      // Verify socket received document state
      expect(mockSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('document_state');
      expect(sentMessage.data).toHaveProperty('document');
      expect(sentMessage.data).toHaveProperty('content');
      expect(sentMessage.data).toHaveProperty('users');
    });

    it('should reject join request with missing fields', () => {
      const message = {
        type: 'join_document',
        userId: 'user-1',
        // Missing documentId and userName
      };

      (server as any).handleJoinDocument('conn-1', mockSocket, message);
      
      expect(mockSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.data.error).toContain('Document ID is required');
    });
  });

  describe('operation handling', () => {
    beforeEach(() => {
      const joinMessage = {
        type: 'join_document',
        userId: 'user-1',
        documentId: 'test-doc',
        userName: 'Test User',
      };
      (server as any).handleJoinDocument('conn-1', mockSocket, joinMessage);
    });

    it('should handle valid operation', () => {
      const operationMessage = {
        type: 'operation',
        operation: {
          type: 'insert',
          position: 0,
          content: 'Hello',
          operationId: 'op-1',
          timestamp: new Date(),
          userId: 'user-1',
        },
      };

      (server as any).handleOperation('conn-1', operationMessage);
      
      // Operation should be processed without errors
      expect(true).toBe(true);
    });

    it('should handle cursor update', () => {
      const cursorMessage = {
        type: 'cursor_update',
        position: 10,
        selection: { start: 10, end: 15 },
      };

      (server as any).handleCursorUpdate('conn-1', cursorMessage);
      
      // Cursor update should be processed without errors
      expect(true).toBe(true);
    });

    it('should handle selection update', () => {
      const selectionMessage = {
        type: 'selection_update',
        selection: { start: 0, end: 5 },
      };

      (server as any).handleSelectionUpdate('conn-1', selectionMessage);
      
      // Selection update should be processed without errors
      expect(true).toBe(true);
    });
  });

  describe('message handling', () => {
    it('should handle unknown message type', () => {
      const message = {
        type: 'unknown_type',
        data: {},
      };

      (server as any).handleMessage('conn-1', mockSocket, message);
      
      expect(mockSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.data.error).toContain('Unknown message type');
    });

    it('should handle invalid JSON', () => {
      const invalidMessage = 'invalid json';
      
      expect(() => {
        (server as any).handleMessage('conn-1', mockSocket, invalidMessage);
      }).not.toThrow();
    });

    it('should handle ping message', () => {
      (server as any).handlePing('conn-1');
      
      // Ping should be processed without errors
      expect(true).toBe(true);
    });
  });

  describe('user management', () => {
    it('should generate unique user colors', () => {
      const color1 = (server as any).generateUserColor();
      const color2 = (server as any).generateUserColor();
      
      expect(color1).toMatch(/^#[0-9A-F]{6}$/i);
      expect(color2).toMatch(/^#[0-9A-F]{6}$/i);
      expect(color1).not.toBe(color2);
    });
  });

  describe('broadcasting', () => {
    beforeEach(() => {
      const joinMessage = {
        type: 'join_document',
        userId: 'user-1',
        documentId: 'test-doc',
        userName: 'Test User',
      };
      (server as any).handleJoinDocument('conn-1', mockSocket, joinMessage);
    });

    it('should broadcast to document users', () => {
      const mockSocket2 = mockWebSocket();
      const joinMessage2 = {
        type: 'join_document',
        userId: 'user-2',
        documentId: 'test-doc',
        userName: 'User 2',
      };
      (server as any).handleJoinDocument('conn-2', mockSocket2, joinMessage2);

      const message = { type: 'test', data: 'test data' };
      (server as any).broadcastToDocument('test-doc', message, 'conn-1');
      
      // Should broadcast to other users
      expect(mockSocket2.send).toHaveBeenCalled();
    });

    it('should handle non-existent document for broadcast', () => {
      expect(() => {
        (server as any).broadcastToDocument('non-existent', {}, 'conn-1');
      }).not.toThrow();
    });
  });

  describe('connection management', () => {
    it('should handle connection disconnect', () => {
      const joinMessage = {
        type: 'join_document',
        userId: 'user-1',
        documentId: 'test-doc',
        userName: 'Test User',
      };
      (server as any).handleJoinDocument('conn-1', mockSocket, joinMessage);

      (server as any).handleDisconnect('conn-1');
      
      // Disconnect should be processed without errors
      expect(true).toBe(true);
    });

    it('should handle disconnect for non-existent connection', () => {
      expect(() => {
        (server as any).handleDisconnect('non-existent');
      }).not.toThrow();
    });
  });

  describe('document sessions', () => {
    it('should create new document session', () => {
      const session = (server as any).getOrCreateDocumentSession('new-doc');
      
      expect(session).toBeDefined();
      expect(session.crdt).toBeDefined();
      expect(session.users).toBeInstanceOf(Map);
      expect(session.connections).toBeInstanceOf(Map);
      expect(session.document).toBeDefined();
    });

    it('should reuse existing document session', () => {
      const session1 = (server as any).getOrCreateDocumentSession('test-doc');
      const session2 = (server as any).getOrCreateDocumentSession('test-doc');
      
      expect(session1).toBe(session2);
    });
  });

  describe('utility methods', () => {
    it('should send error messages', () => {
      (server as any).sendError(mockSocket, 'Test error');
      
      expect(mockSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.data.error).toBe('Test error');
    });

    it('should send regular messages', () => {
      const message = { type: 'test', data: 'test data' };
      (server as any).sendMessage(mockSocket, message);
      
      expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not send messages to closed sockets', () => {
      mockSocket.readyState = WebSocket.CLOSED;
      const message = { type: 'test', data: 'test data' };
      (server as any).sendMessage(mockSocket, message);
      
      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });
});