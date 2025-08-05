/**
 * Integration tests for Codex-Live
 * Tests end-to-end functionality including real-time collaboration, CRDT synchronization, and full system behavior
 */

import * as http from 'http';
import { CRDT } from '../core/CRDT';
import { CollaborationServer } from '../core/CollaborationServer';
import { CollaborativeEditor } from '../client/Editor';

// Test utilities
const createTestServer = async (port: number): Promise<{ server: http.Server; collaborationServer: CollaborationServer }> => {
  const server = http.createServer();
  const collaborationServer = new CollaborationServer(server);
  
  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });
  
  return { server, collaborationServer };
};

const createTestClient = async (port: number, documentId: string): Promise<{ crdt: CRDT; editor: CollaborativeEditor }> => {
  const crdt = new CRDT(documentId, documentId, `ws://localhost:${port}`, false);
  
  // Create mock DOM
  const mockContainer = {
    appendChild: jest.fn(),
    querySelector: jest.fn().mockReturnValue(null),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  
  // Create mock callbacks that match EditorCallbacks interface
  const mockCallbacks = {
    onContentChange: jest.fn(),
    onCursorChange: jest.fn(),
    onUserJoin: jest.fn(),
    onUserLeave: jest.fn(),
    onError: jest.fn()
  };
  
  const editor = new CollaborativeEditor(mockContainer as any, crdt, mockCallbacks);
  
  return { crdt, editor };
};

describe('Integration Tests', () => {
  let server: http.Server;
  let collaborationServer: CollaborationServer;
  const testPort = 8081;

  beforeAll(async () => {
    const setup = await createTestServer(testPort);
    server = setup.server;
    collaborationServer = setup.collaborationServer;
  });

  afterAll(async () => {
    if (collaborationServer) {
      await collaborationServer.shutdown();
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Reset server state
    if (collaborationServer) {
      (collaborationServer as any).documents.clear();
      (collaborationServer as any).connections.clear();
    }
  });

  describe('Real-time Collaboration', () => {
    it('should synchronize content between multiple clients', async () => {
      const documentId = 'test-doc-sync';
      
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Client 1 makes changes
      client1.crdt.setContent('Hello from client 1');
      
      // Wait for synchronization
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify both clients have the same content
      expect(client1.crdt.getContent()).toBe('Hello from client 1');
      expect(client2.crdt.getContent()).toBe('Hello from client 1');
      
      // Cleanup
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 5000);

    it('should handle concurrent edits correctly', async () => {
      const documentId = 'test-doc-concurrent';
      
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Both clients start with same content
      client1.crdt.setContent('Initial content');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Client 1 adds text at position 8
      client1.crdt.insert(8, ' by client 1');
      
      // Client 2 adds text at position 8 (concurrent)
      client2.crdt.insert(8, ' by client 2');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Both clients should have the same final content
      const content1 = client1.crdt.getContent();
      const content2 = client2.crdt.getContent();
      
      expect(content1).toBe(content2);
      expect(content1).toContain('Initial content');
      expect(content1).toContain('by client 1');
      expect(content1).toContain('by client 2');
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 10000);

    it('should propagate cursor positions', async () => {
      const documentId = 'test-doc-cursors';
      
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set content
      client1.crdt.setContent('This is a test document');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Client 1 updates cursor
      client1.crdt.updateCursor(10);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Client 2 should see the cursor
      const cursors = client2.crdt.getCursors();
      expect(cursors).toHaveLength(1);
      expect(cursors[0]?.position).toBe(10);
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 5000);

    it('should handle user presence', async () => {
      const documentId = 'test-doc-presence';
      
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Both clients should see each other
      const users1 = client1.crdt.getConnectedUsers();
      const users2 = client2.crdt.getConnectedUsers();
      
      expect(users1).toHaveLength(2);
      expect(users2).toHaveLength(2);
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 5000);
  });

  describe('CRDT Conflict Resolution', () => {
    it('should resolve text insertion conflicts', async () => {
      const documentId = 'test-crdt-insert';
      
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      client1.crdt.setContent('ABC');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Simultaneous inserts at same position
      client1.crdt.insert(1, 'X');
      client2.crdt.insert(1, 'Y');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const content1 = client1.crdt.getContent();
      const content2 = client2.crdt.getContent();
      
      expect(content1).toBe(content2);
      expect(content1).toHaveLength(5); // ABC + X + Y
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 8000);

    it('should resolve text deletion conflicts', async () => {
      const documentId = 'test-crdt-delete';
      
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      client1.crdt.setContent('ABCDEF');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Client 1 deletes 'B'
      client1.crdt.delete(1, 1);
      
      // Client 2 deletes 'C' (now at position 1 due to client1's delete)
      client2.crdt.delete(1, 1);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const content1 = client1.crdt.getContent();
      const content2 = client2.crdt.getContent();
      
      expect(content1).toBe(content2);
      expect(content1).toBe('ADEF');
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 8000);

    it('should handle complex mixed operations', async () => {
      const documentId = 'test-crdt-complex';
      
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      const client3 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      client1.crdt.setContent('The quick brown fox');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Complex concurrent operations
      client1.crdt.insert(10, ' very');
      client2.crdt.delete(4, 6); // delete 'quick '
      client3.crdt.insert(20, ' jumps');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const content1 = client1.crdt.getContent();
      const content2 = client2.crdt.getContent();
      const content3 = client3.crdt.getContent();
      
      expect(content1).toBe(content2);
      expect(content2).toBe(content3);
      
      client1.crdt.destroy();
      client2.crdt.destroy();
      client3.crdt.destroy();
    }, 12000);
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent connections', async () => {
      const documentId = 'test-scalability';
      const clientCount = 5;
      const clients: Array<{ crdt: CRDT; editor: CollaborativeEditor }> = [];
      
      // Create multiple clients
      for (let i = 0; i < clientCount; i++) {
        clients.push(await createTestClient(testPort, documentId));
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify all clients are connected
      for (const client of clients) {
        const users = client.crdt.getConnectedUsers();
        expect(users).toHaveLength(clientCount);
      }
      
      // Perform concurrent operations
      const promises = clients.map(async (client, index) => {
        client.crdt.setContent(`Initial by client ${index}`);
        await new Promise(resolve => setTimeout(resolve, 50));
        client.crdt.insert(0, `Edit ${index} `);
      });
      
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // All clients should have the same content
      const finalContent = clients[0]?.crdt.getContent() || '';
      for (const client of clients) {
        expect(client.crdt.getContent()).toBe(finalContent);
      }
      
      // Cleanup
      clients.forEach(client => client.crdt.destroy());
    }, 15000);

    it('should maintain low latency under load', async () => {
      const documentId = 'test-performance';
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const startTime = Date.now();
      const operations = 100;
      
      // Rapid operations
      for (let i = 0; i < operations; i++) {
        client1.crdt.insert(0, `op${i}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const endTime = Date.now();
      const averageLatency = (endTime - startTime) / operations;
      
      // Should maintain <150ms latency per operation
      expect(averageLatency).toBeLessThan(150);
      
      // Verify synchronization
      expect(client1.crdt.getContent()).toBe(client2.crdt.getContent());
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 5000);

    it('should handle large documents efficiently', async () => {
      const documentId = 'test-large-doc';
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create large document (100KB)
      const largeContent = 'Large document content. '.repeat(5000);
      client1.crdt.setContent(largeContent);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify synchronization
      expect(client1.crdt.getContent()).toBe(client2.crdt.getContent());
      expect(client1.crdt.getContent().length).toBe(largeContent.length);
      
      // Perform edit on large document
      client2.crdt.insert(100, ' EDIT ');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(client1.crdt.getContent()).toBe(client2.crdt.getContent());
      expect(client1.crdt.getContent()).toContain(' EDIT ');
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 8000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle connection drops gracefully', async () => {
      const documentId = 'test-recovery';
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      client1.crdt.setContent('Persistent content');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Simulate connection drop
      (client1.crdt as any).provider.disconnect();
      
      // Make changes while disconnected
      client1.crdt.insert(0, 'Offline: ');
      
      // Reconnect
      await (client1.crdt as any).provider.connect();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should synchronize
      expect(client1.crdt.getContent()).toBe(client2.crdt.getContent());
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 8000);

    it('should handle server restart', async () => {
      const documentId = 'test-restart';
      const client1 = await createTestClient(testPort, documentId);
      
      client1.crdt.setContent('Content before restart');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Restart server
      await collaborationServer.shutdown();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Server should be back up
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should maintain document state
      expect(client2.crdt.getContent()).toBe('Content before restart');
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 10000);
  });

  describe('Markdown Support Integration', () => {
    it('should render markdown in real-time collaboration', async () => {
      const documentId = 'test-markdown-live';
      const client1 = await createTestClient(testPort, documentId);
      const client2 = await createTestClient(testPort, documentId);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Collaborative markdown editing
      client1.crdt.setContent('# Title\n\nStart of document');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      client2.crdt.insert(20, '\n\n- List item 1\n- List item 2');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      client1.crdt.insert(40, '\n\n**Bold text** and *italic text*');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const finalContent = client1.crdt.getContent();
      expect(finalContent).toBe(client2.crdt.getContent());
      expect(finalContent).toContain('# Title');
      expect(finalContent).toContain('- List item');
      expect(finalContent).toContain('**Bold text**');
      expect(finalContent).toContain('*italic text*');
      
      client1.crdt.destroy();
      client2.crdt.destroy();
    }, 8000);
  });
});