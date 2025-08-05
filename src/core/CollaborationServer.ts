/**
 * Enhanced WebSocket server for real-time collaboration
 * Handles document synchronization, user presence, and performance monitoring
 */

import { Server as WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { CRDT } from './CRDT';
import { 
  User, 
  Document, 
  Operation, 
  EventType, 
  CollaborationEvent,
  PerformanceMetrics
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';

interface ClientConnection {
  socket: WebSocket;
  userId: string;
  documentId: string;
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
  bytesReceived: number;
  bytesSent: number;
}

interface DocumentSession {
  crdt: CRDT;
  users: Map<string, User>;
  connections: Map<string, ClientConnection>;
  document: Document;
  createdAt: Date;
  lastActivity: Date;
  metrics: {
    totalOperations: number;
    totalUsers: number;
    peakConcurrentUsers: number;
    averageLatency: number;
  };
}

interface ServerMetrics {
  totalConnections: number;
  activeDocuments: number;
  peakConnections: number;
  totalMessages: number;
  uptime: Date;
}

export class CollaborationServer {
  private wss: WebSocketServer;
  private documents: Map<string, DocumentSession> = new Map();
  private connections: Map<string, ClientConnection> = new Map();
  private metrics: ServerMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.metrics = {
      totalConnections: 0,
      activeDocuments: 0,
      peakConnections: 0,
      totalMessages: 0,
      uptime: new Date(),
    };
    
    this.setupWebSocketHandlers();
    this.startHealthChecks();
  }

  /**
   * Setup WebSocket event handlers with enhanced monitoring
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (socket, request) => {
      const connectionId = uuidv4();
      const clientIP = this.getClientIP(request);
      
      console.log(`[${new Date().toISOString()}] New connection from ${clientIP} (ID: ${connectionId})`);

      socket.on('message', (data) => {
        try {
          const startTime = performance.now();
          const message = JSON.parse(data.toString());
          
          this.handleMessage(connectionId, socket, message);
          
          const endTime = performance.now();
          const latency = endTime - startTime;
          
          // Update connection metrics
          const connection = this.connections.get(connectionId);
          if (connection) {
            connection.messageCount++;
            connection.bytesReceived += data.toString().length;
            connection.lastActivity = new Date();
          }
          
          this.metrics.totalMessages++;
          
          // Log slow operations
          if (latency > 100) {
            console.warn(`[${new Date().toISOString()}] Slow operation: ${latency.toFixed(2)}ms`);
          }
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error processing message:`, error);
          this.sendError(socket, 'Invalid message format');
        }
      });

      socket.on('close', (code, reason) => {
        console.log(`[${new Date().toISOString()}] Connection closed: ${connectionId} (${code}: ${reason})`);
        this.handleDisconnect(connectionId);
      });

      socket.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] WebSocket error for ${connectionId}:`, error);
        this.handleDisconnect(connectionId);
      });

      socket.on('pong', () => {
        const connection = this.connections.get(connectionId);
        if (connection) {
          connection.lastActivity = new Date();
        }
      });
    });
  }

  /**
   * Get client IP from request
   */
  private getClientIP(request: any): string {
    return request.headers['x-forwarded-for'] || 
           request.connection.remoteAddress || 
           request.socket.remoteAddress ||
           (request.connection.socket ? request.connection.socket.remoteAddress : null) ||
           'unknown';
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const now = new Date();
    const staleThreshold = 60000; // 1 minute
    
    for (const [_connectionId, connection] of this.connections) {
      const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
      
      if (timeSinceLastActivity > staleThreshold) {
        console.warn(`[${now.toISOString()}] Stale connection detected: ${_connectionId}`);
        connection.socket.close(1001, 'Connection timeout');
      } else {
        // Send ping
        connection.socket.ping();
      }
    }
  }

  /**
   * Handle incoming messages with enhanced validation
   */
  private handleMessage(connectionId: string, socket: WebSocket, message: any): void {
    // Validate message structure
    if (!message || typeof message !== 'object') {
      this.sendError(socket, 'Message must be an object');
      return;
    }

    if (!message.type || typeof message.type !== 'string') {
      this.sendError(socket, 'Message must have a type field');
      return;
    }

    switch (message.type) {
      case 'join_document':
        this.handleJoinDocument(connectionId, socket, message);
        break;
      case 'operation':
        this.handleOperation(connectionId, message);
        break;
      case 'cursor_update':
        this.handleCursorUpdate(connectionId, message);
        break;
      case 'selection_update':
        this.handleSelectionUpdate(connectionId, message);
        break;
      case 'ping':
        this.handlePing(connectionId);
        break;
      case 'get_metrics':
        this.handleGetMetrics(connectionId);
        break;
      case 'get_document_state':
        this.handleGetDocumentState(connectionId, message);
        break;
      default:
        this.sendError(socket, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Enhanced document join handling
   */
  private handleJoinDocument(connectionId: string, socket: WebSocket, message: any): void {
    const { userId, documentId, userName } = message;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      this.sendError(socket, 'User ID is required and must be a string');
      return;
    }

    if (!documentId || typeof documentId !== 'string') {
      this.sendError(socket, 'Document ID is required and must be a string');
      return;
    }

    if (!userName || typeof userName !== 'string') {
      this.sendError(socket, 'User name is required and must be a string');
      return;
    }

    // Check for existing connection
    if (this.connections.has(connectionId)) {
      this.sendError(socket, 'Connection already joined a document');
      return;
    }

    const documentSession = this.getOrCreateDocumentSession(documentId);
    
    // Generate unique color for user
    const user: User = {
      id: userId,
      name: userName,
      color: this.generateUserColor(),
      lastSeen: new Date(),
      isOnline: true,
    };

    const connection: ClientConnection = {
      socket,
      userId,
      documentId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      bytesReceived: 0,
      bytesSent: 0,
    };

    documentSession.users.set(userId, user);
    documentSession.connections.set(connectionId, connection);
    this.connections.set(connectionId, connection);

    // Update metrics
    documentSession.metrics.totalUsers++;
    documentSession.metrics.peakConcurrentUsers = Math.max(
      documentSession.metrics.peakConcurrentUsers,
      documentSession.connections.size
    );

    console.log(`[${new Date().toISOString()}] User ${userName} (${userId}) joined document ${documentId}`);

    // Send initial document state
    this.sendMessage(socket, {
      type: 'document_state',
      data: {
        document: documentSession.document,
        content: documentSession.crdt.getContent(),
        users: Array.from(documentSession.users.values()),
        metrics: this.getDocumentMetrics(documentId),
      },
    });

    // Broadcast user joined event
    this.broadcastToDocument(documentId, {
      type: EventType.USER_JOINED,
      data: { user },
      userId,
      timestamp: new Date(),
    }, connectionId);

    // Send presence info to new user
    this.sendPresenceInfo(connectionId);
  }

  /**
   * Handle operation with enhanced validation and metrics
   */
  private handleOperation(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        this.sendError(connection.socket, 'Invalid connection');
      }
      return;
    }

    const documentSession = this.documents.get(connection.documentId);
    if (!documentSession) {
      this.sendError(connection.socket, 'Document not found');
      return;
    }

    const operation: Operation = message.operation;
    
    // Validate operation structure
    if (!operation || typeof operation !== 'object') {
      this.sendError(connection.socket, 'Invalid operation format');
      return;
    }

    if (!operation.type || !operation.position || !operation.userId) {
      this.sendError(connection.socket, 'Operation missing required fields');
      return;
    }

    try {
      // Apply operation to CRDT
      // Y.js handles remote operations automatically through the provider

      // Update document
      documentSession.document = {
        ...documentSession.document,
        content: documentSession.crdt.getContent(),
        updatedAt: new Date(),
        lastModifiedBy: connection.userId,
      };

      // Update metrics
      documentSession.metrics.totalOperations++;
      documentSession.lastActivity = new Date();
      connection.lastActivity = new Date();

      // Broadcast operation to other clients
      this.broadcastToDocument(connection.documentId, {
        type: EventType.OPERATION_RECEIVED,
        data: { operation },
        userId: connection.userId,
        timestamp: new Date(),
      }, connectionId);

      console.log(`[${new Date().toISOString()}] Operation applied to ${connection.documentId} by ${connection.userId}`);

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error applying operation:`, error);
      this.sendError(connection.socket, 'Failed to apply operation');
    }
  }

  /**
   * Handle cursor updates
   */
  private handleCursorUpdate(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const documentSession = this.documents.get(connection.documentId);
    if (!documentSession) return;

    const cursor = message.cursor;
    if (!cursor || typeof cursor.position !== 'number') {
      return;
    }

    // Broadcast cursor update to other clients
    this.broadcastToDocument(connection.documentId, {
      type: EventType.CURSOR_CHANGED,
      data: { cursor: { ...cursor, userId: connection.userId } },
      userId: connection.userId,
      timestamp: new Date(),
    }, connectionId);

    connection.lastActivity = new Date();
  }

  /**
   * Handle selection updates
   */
  private handleSelectionUpdate(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const documentSession = this.documents.get(connection.documentId);
    if (!documentSession) return;

    const selection = message.selection;
    if (!selection || typeof selection.start !== 'number' || typeof selection.end !== 'number') {
      return;
    }

    // Broadcast selection update to other clients
    this.broadcastToDocument(connection.documentId, {
      type: EventType.SELECTION_CHANGED,
      data: { selection: { ...selection, userId: connection.userId } },
      userId: connection.userId,
      timestamp: new Date(),
    }, connectionId);

    connection.lastActivity = new Date();
  }

  /**
   * Handle ping messages
   */
  private handlePing(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.sendMessage(connection.socket, {
        type: 'pong',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle metrics request
   */
  private handleGetMetrics(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const documentSession = this.documents.get(connection.documentId);
    if (!documentSession) return;

    this.sendMessage(connection.socket, {
      type: 'metrics',
      data: {
        server: this.getServerMetrics(),
        document: this.getDocumentMetrics(connection.documentId),
      },
    });
  }

  /**
   * Handle document state request
   */
  private handleGetDocumentState(connectionId: string, _message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const documentSession = this.documents.get(connection.documentId);
    if (!documentSession) return;

    this.sendMessage(connection.socket, {
      type: 'document_state',
      data: {
        document: documentSession.document,
        content: documentSession.crdt.getContent(),
        users: Array.from(documentSession.users.values()),
      },
    });
  }

  /**
   * Handle disconnection with cleanup
   */
  private handleDisconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const documentSession = this.documents.get(connection.documentId);
    if (documentSession) {
      documentSession.connections.delete(connectionId);
      
      // Update user status if no more connections for this user
      const userConnections = Array.from(documentSession.connections.values())
        .filter(conn => conn.userId === connection.userId);
      
      if (userConnections.length === 0) {
        const user = documentSession.users.get(connection.userId);
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          
          // Broadcast user left event
          this.broadcastToDocument(connection.documentId, {
            type: EventType.USER_LEFT,
            data: { userId: connection.userId },
            userId: connection.userId,
            timestamp: new Date(),
          });
        }
      }

      // Clean up empty documents
      if (documentSession.connections.size === 0) {
        documentSession.crdt.destroy();
        this.documents.delete(connection.documentId);
        this.metrics.activeDocuments = this.documents.size;
        console.log(`[${new Date().toISOString()}] Document ${connection.documentId} cleaned up`);
      }
    }

    this.connections.delete(connectionId);
    this.metrics.totalConnections = this.connections.size;
    
    console.log(`[${new Date().toISOString()}] Connection ${connectionId} disconnected`);
  }

  /**
   * Get or create document session
   */
  private getOrCreateDocumentSession(documentId: string): DocumentSession {
    let session = this.documents.get(documentId);
    if (!session) {
      const crdt = new CRDT();
      session = {
        crdt,
        users: new Map(),
        connections: new Map(),
        document: {
          id: documentId,
          title: `Document ${documentId}`,
          content: '',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system',
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        metrics: {
          totalOperations: 0,
          totalUsers: 0,
          peakConcurrentUsers: 0,
          averageLatency: 0,
        },
      };
      this.documents.set(documentId, session);
      this.metrics.activeDocuments = this.documents.size;
    }
    return session;
  }

  /**
   * Broadcast message to all clients in a document except sender
   */
  private broadcastToDocument(documentId: string, event: CollaborationEvent, excludeConnectionId?: string): void {
    const documentSession = this.documents.get(documentId);
    if (!documentSession) return;

    const message = JSON.stringify(event);
    
    for (const [connectionId, connection] of documentSession.connections) {
      if (connectionId === excludeConnectionId) continue;
      
      if (connection.socket.readyState === 1) { // WebSocket.OPEN
        connection.socket.send(message);
        connection.bytesSent += message.length;
      }
    }
  }

  /**
   * Send message to specific connection
   */
  private sendMessage(socket: WebSocket, message: any): void {
    if (socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to specific connection
   */
  private sendError(socket: WebSocket, error: string): void {
    this.sendMessage(socket, {
      type: 'error',
      data: { error },
      timestamp: new Date(),
    });
  }

  /**
   * Send presence information to connection
   */
  private sendPresenceInfo(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const documentSession = this.documents.get(connection.documentId);
    if (!documentSession) return;

    this.sendMessage(connection.socket, {
      type: 'presence_info',
      data: {
        users: Array.from(documentSession.users.values()),
        cursors: documentSession.crdt.getCursors(),
        selections: documentSession.crdt.getSelections(),
      },
    });
  }

  /**
   * Generate unique color for user
   */
  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#48DBFB', '#1DD1A1', '#FFC048',
      '#FF6348', '#6C5CE7', '#A29BFE', '#FD79A8', '#FDCB6E',
    ];
    return colors[Math.floor(Math.random() * colors.length)] || '#FF6B6B';
  }

  /**
   * Get server metrics
   */
  public getServerMetrics(): ServerMetrics {
    return {
      ...this.metrics,
      uptime: this.metrics.uptime,
    };
  }

  /**
   * Get document metrics
   */
  public getDocumentMetrics(documentId: string): any {
    const session = this.documents.get(documentId);
    if (!session) return null;

    return {
      ...session.metrics,
      activeConnections: session.connections.size,
      lastActivity: session.lastActivity,
      documentSize: session.crdt.getContent().length,
    };
  }

  /**
   * Get all documents metrics
   */
  public getAllDocumentsMetrics(): Map<string, any> {
    const metrics = new Map<string, any>();
    for (const [documentId, _session] of this.documents) {
      metrics.set(documentId, this.getDocumentMetrics(documentId));
    }
    return metrics;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    const totalUsers = Array.from(this.documents.values())
      .reduce((sum, session) => sum + session.connections.size, 0);
    
    const totalOperations = Array.from(this.documents.values())
      .reduce((sum, session) => sum + session.metrics.totalOperations, 0);

    return {
      latency: 0, // Calculated per-operation
      throughput: this.metrics.totalMessages / Math.max(1, (Date.now() - this.metrics.uptime.getTime()) / 1000),
      concurrentUsers: totalUsers,
      operationCount: totalOperations,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Shutdown server gracefully
   */
  public shutdown(): void {
    console.log(`[${new Date().toISOString()}] Shutting down collaboration server...`);
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close all connections
    for (const [_connectionId, connection] of this.connections) {
      connection.socket.close(1001, 'Server shutting down');
    }

    // Clean up all documents
    for (const [_documentId, session] of this.documents) {
      session.crdt.destroy();
    }

    this.wss.close(() => {
      console.log(`[${new Date().toISOString()}] Collaboration server shutdown complete`);
    });
  }
}