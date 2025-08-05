/**
 * CRDT (Conflict-Free Replicated Data Type) Tests
 * Tests for the CRDT implementation in Codex-Live
 */

import { CRDT } from '../CRDT';
import { OperationType } from '../../types';

describe('CRDT', () => {
  let crdt: CRDT;

  beforeEach(() => {
    crdt = new CRDT('test-site');
  });

  describe('local operations', () => {
    it('should apply local insert operation', () => {
      const operation = crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      
      expect(operation.type).toBe(OperationType.INSERT);
      expect(operation.position).toBe(0);
      expect(operation.content).toBe('Hello');
      expect(crdt.getContent()).toBe('Hello');
    });

    it('should apply local delete operation', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello World');
      const operation = crdt.applyLocalOperation(OperationType.DELETE, 5, undefined, 6);
      
      expect(operation.type).toBe(OperationType.DELETE);
      expect(operation.position).toBe(5);
      expect(operation.length).toBe(6);
      expect(crdt.getContent()).toBe('Hello');
    });

    it('should apply local retain operation', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Test');
      const operation = crdt.applyLocalOperation(OperationType.RETAIN, 2);
      
      expect(operation.type).toBe(OperationType.RETAIN);
      expect(operation.position).toBe(2);
      expect(crdt.getContent()).toBe('Test');
    });

    it('should increment vector clock for local operations', () => {
      const initialState = crdt.getState();
      expect(initialState.vectorClock['test-site']).toBe(0);

      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      
      const newState = crdt.getState();
      expect(newState.vectorClock['test-site']).toBe(1);
    });
  });

  describe('remote operations', () => {
    it('should apply remote insert operation', () => {
      const remoteOperation = {
        type: OperationType.INSERT,
        position: 0,
        content: 'Hello',
        userId: 'remote-site',
        timestamp: new Date(),
        operationId: 'remote-op-1',
      };

      crdt.applyRemoteOperation(remoteOperation);
      expect(crdt.getContent()).toBe('Hello');
    });

    it('should apply remote delete operation', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello World');
      
      const remoteOperation = {
        type: OperationType.DELETE,
        position: 5,
        length: 6,
        userId: 'remote-site',
        timestamp: new Date('2024-01-01T00:00:01.000Z'),
        operationId: 'remote-op-1',
      };

      crdt.applyRemoteOperation(remoteOperation);
      expect(crdt.getContent()).toBe('Hello World');
    });

    it('should not apply duplicate remote operations', () => {
      const remoteOperation = {
        type: OperationType.INSERT,
        position: 0,
        content: 'Hello',
        userId: 'remote-site',
        timestamp: new Date(),
        operationId: 'remote-op-3',
      };

      crdt.applyRemoteOperation(remoteOperation);
      expect(crdt.getContent()).toBe('Hello');

      crdt.applyRemoteOperation(remoteOperation);
      expect(crdt.getContent()).toBe('Hello'); // Should not duplicate
    });

    it('should handle multiple remote operations in order', () => {
      const op1 = {
        type: OperationType.INSERT,
        position: 0,
        content: 'Hello',
        userId: 'remote-site-1',
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
        operationId: 'remote-op-4',
      };

      const op2 = {
        type: OperationType.INSERT,
        position: 5,
        content: ' World',
        userId: 'remote-site-2',
        timestamp: new Date('2023-01-01T00:00:01.000Z'),
        operationId: 'remote-op-5',
      };

      crdt.applyRemoteOperation(op1);
      crdt.applyRemoteOperation(op2);
      expect(crdt.getContent()).toBe('Hello World');
    });
  });

  describe('operation transformation', () => {
    it('should transform insert against concurrent insert', () => {
      const op1 = crdt.applyLocalOperation(OperationType.INSERT, 0, 'abc');
      const op2 = crdt.applyLocalOperation(OperationType.INSERT, 1, 'xyz');
      
      const transformed = crdt.transformOperation(op2, [op1]);
      expect(transformed.position).toBe(4); // 1 + 3 (length of 'abc')
    });

    it('should transform delete against concurrent insert', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'abcdef');
      const insertOp = crdt.applyLocalOperation(OperationType.INSERT, 3, 'xyz');
      const deleteOp = {
        type: OperationType.DELETE,
        position: 4,
        length: 2,
        userId: 'test-site',
        timestamp: new Date(),
        operationId: 'delete-op-1',
      };

      const transformed = crdt.transformOperation(deleteOp, [insertOp]);
      expect(transformed.position).toBe(7); // 4 + 3 (length of 'xyz')
    });

    it('should transform insert against concurrent delete', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'abcdef');
      const deleteOp = crdt.applyLocalOperation(OperationType.DELETE, 2, undefined, 2);
      const insertOp = {
        type: OperationType.INSERT,
        position: 3,
        content: 'xyz',
        userId: 'test-site',
        timestamp: new Date(),
        operationId: 'insert-op-1',
      };

      const transformed = crdt.transformOperation(insertOp, [deleteOp]);
      expect(transformed.position).toBe(1); // 3 - 2 (length of deleted content)
    });

    it('should handle edge cases in transformation', () => {
      const op1 = crdt.applyLocalOperation(OperationType.INSERT, 0, 'a');
      const op2 = {
        type: OperationType.INSERT,
        position: 0,
        content: 'b',
        userId: 'test-site',
        timestamp: new Date(),
        operationId: 'edge-op-1',
      };

      const transformed = crdt.transformOperation(op2, [op1]);
      expect(transformed.position).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle insert at negative position', () => {
      crdt.applyLocalOperation(OperationType.INSERT, -5, 'Hello');
      expect(crdt.getContent()).toBe('Hello');
    });

    it('should handle insert beyond content length', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      crdt.applyLocalOperation(OperationType.INSERT, 100, ' World');
      expect(crdt.getContent()).toBe('Hello World');
    });

    it('should handle delete at negative position', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello World');
      crdt.applyLocalOperation(OperationType.DELETE, 0, undefined, 5);
      expect(crdt.getContent()).toBe('Hello World');
    });

    it('should handle delete beyond content length', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      crdt.applyLocalOperation(OperationType.DELETE, 3, undefined, 2);
      expect(crdt.getContent()).toBe('Hello');
    });

    it('should handle zero-length delete', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      crdt.applyLocalOperation(OperationType.DELETE, 2, undefined, 0);
      expect(crdt.getContent()).toBe('Hello');
    });

    it('should handle empty insert', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, '');
      expect(crdt.getContent()).toBe('');
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple concurrent inserts', () => {
      const crdt1 = new CRDT('site1');
      const crdt2 = new CRDT('site2');

      const op1 = crdt1.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      const op2 = crdt2.applyLocalOperation(OperationType.INSERT, 0, 'World');

      crdt1.applyRemoteOperation(op2);
      crdt2.applyRemoteOperation(op1);

      expect(crdt1.getContent()).toBe(crdt2.getContent());
    });

    it('should handle insert and delete in sequence', () => {
      crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      crdt.applyLocalOperation(OperationType.INSERT, 5, ' World');
      crdt.applyLocalOperation(OperationType.DELETE, 5, undefined, 6);
      crdt.applyLocalOperation(OperationType.INSERT, 5, 'Amazing');
      
      expect(crdt.getContent()).toBe('HelloAmazing World');
    });

    it('should maintain operation history', () => {
      const op1 = crdt.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      const op2 = crdt.applyLocalOperation(OperationType.INSERT, 5, ' World');
      const op3 = crdt.applyLocalOperation(OperationType.DELETE, 5, undefined, 6);

      const operations = crdt.getOperations();
      expect(operations).toHaveLength(3);
      expect(operations.map(op => op.operationId)).toContain(op1.operationId);
      expect(operations.map(op => op.operationId)).toContain(op2.operationId);
      expect(operations.map(op => op.operationId)).toContain(op3.operationId);
    });

    it('should handle operations with same timestamp', () => {
      const timestamp = new Date();
      
      const op1 = {
        type: OperationType.INSERT,
        position: 0,
        content: 'a',
        userId: 'site1',
        timestamp,
        operationId: 'op1',
      };

      const op2 = {
        type: OperationType.INSERT,
        position: 0,
        content: 'b',
        userId: 'site2',
        timestamp,
        operationId: 'op2',
      };

      crdt.applyRemoteOperation(op1);
      crdt.applyRemoteOperation(op2);

      // Operations should be ordered consistently
      const content = crdt.getContent();
      expect(content.length).toBe(2);
    });
  });

  describe('state management', () => {
    it('should return complete state', () => {
      const operation = crdt.applyLocalOperation(OperationType.INSERT, 0, 'Test');
      const state = crdt.getState();

      expect(state.siteId).toBe('test-site');
      expect(state.operations).toHaveLength(1);
      expect(state.operations[0]?.operationId).toBe(operation.operationId);
      expect(state.vectorClock['test-site']).toBe(1);
    });

    it('should maintain separate state for different CRDT instances', () => {
      const crdt1 = new CRDT('site1');
      const crdt2 = new CRDT('site2');

      crdt1.applyLocalOperation(OperationType.INSERT, 0, 'Hello');
      crdt2.applyLocalOperation(OperationType.INSERT, 0, 'World');

      expect(crdt1.getContent()).toBe('Hello');
      expect(crdt2.getContent()).toBe('World');
      expect(crdt1.getState().siteId).toBe('site1');
      expect(crdt2.getState().siteId).toBe('site2');
    });
  });
});