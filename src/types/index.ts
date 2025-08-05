/**
 * Core types for Codex-Live collaborative editor
 * Implements CRDT-based real-time collaboration
 */

export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: Cursor;
  selection?: Selection;
  lastSeen: Date;
  isOnline: boolean;
}

export interface Cursor {
  position: number;
  userId: string;
  timestamp: Date;
}

export interface Selection {
  start: number;
  end: number;
  userId: string;
  timestamp: Date;
}

export interface Document {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly lastModifiedBy?: string;
}

export interface DocumentUpdate {
  readonly documentId: string;
  readonly operations: Operation[];
  readonly userId: string;
  readonly timestamp: Date;
  readonly version: number;
}

export interface Operation {
  readonly type: OperationType;
  readonly position: number;
  readonly content?: string | undefined;
  readonly length?: number | undefined;
  readonly userId: string;
  readonly timestamp: Date;
  readonly operationId: string;
}

export enum OperationType {
  INSERT = 'insert',
  DELETE = 'delete',
  RETAIN = 'retain',
}

export interface CollaborationEvent {
  readonly type: EventType;
  readonly data: unknown;
  readonly userId: string;
  readonly timestamp: Date;
}

export enum EventType {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  CURSOR_CHANGED = 'cursor_changed',
  SELECTION_CHANGED = 'selection_changed',
  DOCUMENT_UPDATED = 'document_updated',
  OPERATION_RECEIVED = 'operation_received',
}

export interface CRDTState {
  readonly documentId: string;
  readonly operations: Operation[];
  readonly vectorClock: VectorClock;
  readonly siteId: string;
}

export interface VectorClock {
  [siteId: string]: number;
}

export interface PresenceInfo {
  readonly user: User;
  readonly cursors: Cursor[];
  readonly selections: Selection[];
}

export interface ConnectionInfo {
  readonly socketId: string;
  readonly userId: string;
  readonly documentId: string;
  readonly connectedAt: Date;
  readonly lastActivity: Date;
}

export interface PerformanceMetrics {
  readonly latency: number;
  readonly throughput: number;
  readonly concurrentUsers: number;
  readonly operationCount: number;
  readonly memoryUsage: number;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
}

export interface ErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly details?: unknown;
  readonly timestamp: Date;
}

export interface SuccessResponse<T> {
  readonly data: T;
  readonly timestamp: Date;
}

export type APIResponse<T> = SuccessResponse<T> | ErrorResponse;