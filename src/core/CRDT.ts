/**
 * Enhanced CRDT (Conflict-Free Replicated Data Type) implementation for Codex-Live
 * Uses Y.js for production-grade CRDT functionality with conflict-free concurrent editing
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import { CRDTState, User, Cursor, Selection, OperationType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface CRDTOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: Date;
  operationId: string;
}

export interface CRDTCallbacks {
  onContentChange?: (content: string) => void;
  onUserJoin?: (user: User) => void;
  onUserLeave?: (userId: string) => void;
  onCursorUpdate?: (cursor: Cursor) => void;
  onSelectionUpdate?: (selection: Selection) => void;
  onError?: (error: Error) => void;
}

export class CRDT {
  private readonly siteId: string;
  private doc: Y.Doc;
  private yText: Y.Text;
  private awareness: Awareness;
  private provider: WebsocketProvider | WebrtcProvider | null = null;
  private user: User | null = null;
  private callbacks: CRDTCallbacks = {};

  constructor(
    siteId?: string,
    documentId?: string,
    serverUrl?: string,
    useWebRTC = false
  ) {
    this.siteId = siteId || uuidv4();
    this.doc = new Y.Doc();
    this.yText = this.doc.getText('content');
    this.awareness = new Awareness(this.doc);
    
    this.setupAwarenessHandlers();
    this.setupYTextHandlers();
    
    if (documentId && serverUrl) {
      this.initializeProvider(documentId, serverUrl, useWebRTC);
    }
  }

  /**
   * Initialize WebSocket or WebRTC provider for real-time collaboration
   */
  private initializeProvider(documentId: string, serverUrl: string, useWebRTC: boolean): void {
    try {
      if (useWebRTC) {
        this.provider = new WebrtcProvider(documentId, this.doc, {
          signaling: [serverUrl],
          awareness: this.awareness,
          maxConns: 20 + Math.floor(Math.random() * 15),
          filterBcConns: true,
          peerOpts: {}
        });
      } else {
        this.provider = new WebsocketProvider(serverUrl, documentId, this.doc);
        this.provider.awareness = this.awareness;
      }
    } catch (error) {
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Setup awareness handlers for user presence and cursors
   */
  private setupAwarenessHandlers(): void {
    this.awareness.on('change', (changes: any) => {
      const states = this.awareness.getStates() as Map<number, any>;
      
      changes.added.forEach((clientId: number) => {
        const state = states.get(clientId);
        if (state?.user) {
          this.callbacks.onUserJoin?.(state.user);
        }
      });
      
      changes.removed.forEach((clientId: number) => {
        const state = states.get(clientId);
        if (state?.user?.id) {
          this.callbacks.onUserLeave?.(state.user.id);
        }
      });
      
      changes.updated.forEach((clientId: number) => {
        const state = states.get(clientId);
        if (state?.cursor) {
          this.callbacks.onCursorUpdate?.(state.cursor);
        }
        if (state?.selection) {
          this.callbacks.onSelectionUpdate?.(state.selection);
        }
      });
    });
  }

  /**
   * Setup Y.Text change handlers for content synchronization
   */
  private setupYTextHandlers(): void {
    this.yText.observe(() => {
      this.callbacks.onContentChange?.(this.yText.toString());
    });
  }

  /**
   * Set callbacks for CRDT events
   */
  public setCallbacks(callbacks: CRDTCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get the current CRDT state
   */
  public getState(): CRDTState {
    const operations = this.getOperations().map(op => ({
      type: op.type as OperationType,
      position: op.position,
      content: op.content,
      length: op.length,
      userId: op.userId,
      timestamp: op.timestamp,
      operationId: op.operationId,
    }));
    
    return {
      documentId: this.doc.guid,
      operations,
      vectorClock: {}, // Y.js handles vector clocks internally
      siteId: this.siteId,
    };
  }

  /**
   * Get current document content
   */
  public getContent(): string {
    return this.yText.toString();
  }

  /**
   * Set document content (replaces entire content)
   */
  public setContent(content: string): void {
    this.doc.transact(() => {
      this.yText.delete(0, this.yText.length);
      this.yText.insert(0, content);
    });
  }

  /**
   * Insert content at position
   */
  public insert(position: number, content: string): void {
    this.doc.transact(() => {
      this.yText.insert(Math.max(0, Math.min(position, this.yText.length)), content);
    });
  }

  /**
   * Delete content at position
   */
  public delete(position: number, length: number): void {
    this.doc.transact(() => {
      const validPosition = Math.max(0, Math.min(position, this.yText.length));
      const validLength = Math.max(0, Math.min(length, this.yText.length - validPosition));
      this.yText.delete(validPosition, validLength);
    });
  }

  /**
   * Get all operations as a simplified representation
   */
  public getOperations(): CRDTOperation[] {
    // Y.js handles operations internally, we provide a simplified view
    return [{
      type: 'retain',
      position: 0,
      userId: this.siteId,
      timestamp: new Date(),
      operationId: uuidv4(),
    }];
  }

  /**
   * Set current user information
   */
  public setUser(user: User): void {
    this.user = user;
    this.awareness.setLocalStateField('user', user);
  }

  /**
   * Update cursor position
   */
  public updateCursor(position: number): void {
    if (this.user) {
      const cursor: Cursor = {
        position,
        userId: this.user.id,
        timestamp: new Date(),
      };
      this.awareness.setLocalStateField('cursor', cursor);
    }
  }

  /**
   * Update text selection
   */
  public updateSelection(start: number, end: number): void {
    if (this.user) {
      const selection: Selection = {
        start,
        end,
        userId: this.user.id,
        timestamp: new Date(),
      };
      this.awareness.setLocalStateField('selection', selection);
    }
  }

  /**
   * Get all connected users
   */
  public getConnectedUsers(): User[] {
    const states = this.awareness.getStates() as Map<number, any>;
    return Array.from(states.values())
      .filter(state => state?.user)
      .map(state => state.user);
  }

  /**
   * Get all cursors from connected users
   */
  public getCursors(): Cursor[] {
    const states = this.awareness.getStates() as Map<number, any>;
    return Array.from(states.values())
      .filter(state => state?.cursor)
      .map(state => state.cursor);
  }

  /**
   * Get all selections from connected users
   */
  public getSelections(): Selection[] {
    const states = this.awareness.getStates() as Map<number, any>;
    return Array.from(states.values())
      .filter(state => state?.selection)
      .map(state => state.selection);
  }

  /**
   * Export document as Uint8Array for persistence
   */
  public exportState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  /**
   * Import document state from Uint8Array
   */
  public importState(state: Uint8Array): void {
    Y.applyUpdate(this.doc, state);
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return {
      documentSize: this.yText.length,
      connectedUsers: this.getConnectedUsers().length,
      isConnected: this.provider !== null,
    };
  }

  /**
   * Destroy the CRDT instance and cleanup resources
   */
  public destroy(): void {
    if (this.provider) {
      this.provider.destroy();
    }
    this.awareness.destroy();
    this.doc.destroy();
  }

  /**
   * Check if the CRDT is ready for operations
   */
  public isReady(): boolean {
    return this.doc !== null && this.yText !== null;
  }

  /**
   * Wait for synchronization to complete
   */
  public async waitForSync(): Promise<void> {
    if (!this.provider) return;
    
    if ('synced' in this.provider) {
      return new Promise((resolve) => {
        if ((this.provider as any).synced) {
          resolve();
        } else {
          this.provider!.once('synced', () => resolve());
        }
      });
    }
  }
}