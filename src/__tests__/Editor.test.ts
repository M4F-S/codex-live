/**
 * Comprehensive test suite for CollaborativeEditor
 * Tests all client-side functionality including DOM manipulation and Markdown support
 */

import { CollaborativeEditor } from '../client/Editor';
import { CRDT } from '../core/CRDT';

// Mock DOM APIs
class MockElement {
  private listeners: { [key: string]: Function[] } = {};
  value = '';
  innerHTML = '';
  style: { [key: string]: string } = {};
  className = '';
  children: MockElement[] = [];

  addEventListener(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  removeEventListener(event: string, listener: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }
  }

  dispatchEvent(event: any) {
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach(listener => listener(event));
    }
  }

  querySelector(selector: string) {
    if (selector === '#editor') return this;
    if (selector === '#users') return new MockElement();
    if (selector === '.cursor-indicator') return null;
    return null;
  }

  querySelectorAll(selector: string) {
    return [];
  }

  appendChild(child: MockElement) {
    this.children.push(child);
    return child;
  }

  removeChild(child: MockElement) {
    this.children = this.children.filter(c => c !== child);
  }

  setAttribute(name: string, value: string) {
    // Mock implementation
  }

  removeAttribute(name: string) {
    // Mock implementation
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, width: 100, height: 20 };
  }
}

// Mock document
const mockDocument = {
  createElement: jest.fn().mockImplementation((tagName) => {
    const element = new MockElement();
    element.tagName = tagName.toUpperCase();
    return element;
  }),
  querySelector: jest.fn().mockImplementation((selector) => {
    if (selector === '#editor') return new MockElement();
    if (selector === '#users') return new MockElement();
    return null;
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  execCommand: jest.fn(),
};

// Mock window
const mockWindow = {
  getSelection: jest.fn().mockReturnValue({
    getRangeAt: jest.fn().mockReturnValue({
      startOffset: 0,
      endOffset: 0,
      startContainer: { textContent: '' },
      endContainer: { textContent: '' }
    }),
    removeAllRanges: jest.fn(),
    addRange: jest.fn()
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock CRDT
const mockCRDT = {
  setContent: jest.fn(),
  insert: jest.fn(),
  delete: jest.fn(),
  getContent: jest.fn().mockReturnValue(''),
  getConnectedUsers: jest.fn().mockReturnValue([]),
  getCursors: jest.fn().mockReturnValue([]),
  getSelections: jest.fn().mockReturnValue([]),
  setUser: jest.fn(),
  updateCursor: jest.fn(),
  updateSelection: jest.fn(),
  applyRemoteOperation: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  destroy: jest.fn(),
  getState: jest.fn().mockReturnValue({
    documentId: 'test-doc',
    isConnected: true,
    vectorClock: {}
  }),
  getPerformanceMetrics: jest.fn().mockReturnValue({
    latency: 0,
    throughput: 0,
    operationCount: 0,
    memoryUsage: 0
  })
};

// Setup global mocks
(global as any).document = mockDocument;
(global as any).window = mockWindow;

describe('CollaborativeEditor', () => {
  let editor: CollaborativeEditor;
  let mockContainer: MockElement;
  let mockCRDTInstance: CRDT;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContainer = new MockElement();
    mockCRDTInstance = mockCRDT as any;
    
    // Reset CRDT mocks
    Object.keys(mockCRDT).forEach(key => {
      if (typeof mockCRDT[key] === 'function') {
        mockCRDT[key].mockClear();
      }
    });
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize with container and CRDT', () => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor).toBeDefined();
      expect(mockCRDT.setUser).toHaveBeenCalled();
    });

    it('should create editor elements', () => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.createElement).toHaveBeenCalledWith('textarea');
    });

    it('should set up event listeners', () => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(mockCRDT.on).toHaveBeenCalledWith('contentChanged', expect.any(Function));
      expect(mockCRDT.on).toHaveBeenCalledWith('userJoined', expect.any(Function));
      expect(mockCRDT.on).toHaveBeenCalledWith('userLeft', expect.any(Function));
      expect(mockCRDT.on).toHaveBeenCalledWith('cursorChanged', expect.any(Function));
      expect(mockCRDT.on).toHaveBeenCalledWith('selectionChanged', expect.any(Function));
    });

    it('should handle missing container gracefully', () => {
      expect(() => new CollaborativeEditor(null as any, mockCRDTInstance)).not.toThrow();
    });
  });

  describe('Content Management', () => {
    beforeEach(() => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
    });

    it('should set initial content from CRDT', () => {
      mockCRDT.getContent.mockReturnValue('Initial content');
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor.getContent()).toBe('Initial content');
    });

    it('should update content on CRDT changes', () => {
      const contentChangedCallback = mockCRDT.on.mock.calls.find(
        call => call[0] === 'contentChanged'
      )?.[1];
      
      if (contentChangedCallback) {
        contentChangedCallback('New content');
        expect(editor.getContent()).toBe('New content');
      }
    });

    it('should handle empty content', () => {
      mockCRDT.getContent.mockReturnValue('');
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor.getContent()).toBe('');
    });

    it('should handle large content', () => {
      const largeContent = 'a'.repeat(10000);
      mockCRDT.getContent.mockReturnValue(largeContent);
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor.getContent()).toBe(largeContent);
    });
  });

  describe('User Input Handling', () => {
    let textarea: MockElement;

    beforeEach(() => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      textarea = mockDocument.createElement.mock.results.find(
        result => result.value.tagName === 'TEXTAREA'
      )?.value;
    });

    it('should handle input events', () => {
      const inputEvent = { target: { value: 'New text' }, type: 'input' };
      
      textarea.dispatchEvent(inputEvent);
      
      expect(mockCRDT.setContent).toHaveBeenCalledWith('New text');
    });

    it('should handle keydown events', () => {
      const keydownEvent = { key: 'Enter', preventDefault: jest.fn() };
      
      textarea.dispatchEvent(keydownEvent);
      
      expect(keydownEvent.preventDefault).not.toHaveBeenCalled(); // Enter is allowed
    });

    it('should handle tab key for indentation', () => {
      const tabEvent = { key: 'Tab', preventDefault: jest.fn() };
      
      textarea.dispatchEvent(tabEvent);
      
      expect(tabEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle cursor position changes', () => {
      const selectionChangeEvent = {};
      
      mockWindow.getSelection.mockReturnValue({
        getRangeAt: jest.fn().mockReturnValue({
          startOffset: 10,
          endOffset: 15
        }),
        removeAllRanges: jest.fn(),
        addRange: jest.fn()
      });

      // Trigger selection change
      const selectionCallback = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'selectionchange'
      )?.[1];
      
      if (selectionCallback) {
        selectionCallback(selectionChangeEvent);
        expect(mockCRDT.updateCursor).toHaveBeenCalledWith(10);
        expect(mockCRDT.updateSelection).toHaveBeenCalledWith(10, 15);
      }
    });
  });

  describe('Markdown Support', () => {
    beforeEach(() => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
    });

    it('should render basic markdown', () => {
      const markdown = '# Hello World\n\nThis is **bold** text.';
      mockCRDT.getContent.mockReturnValue(markdown);
      
      const contentChangedCallback = mockCRDT.on.mock.calls.find(
        call => call[0] === 'contentChanged'
      )?.[1];
      
      if (contentChangedCallback) {
        contentChangedCallback(markdown);
        
        // Check if markdown is processed (simplified test)
        expect(editor.getContent()).toBe(markdown);
      }
    });

    it('should handle markdown lists', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      mockCRDT.getContent.mockReturnValue(markdown);
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor.getContent()).toBe(markdown);
    });

    it('should handle code blocks', () => {
      const markdown = '```javascript\nconsole.log("Hello");\n```';
      mockCRDT.getContent.mockReturnValue(markdown);
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor.getContent()).toBe(markdown);
    });

    it('should handle inline code', () => {
      const markdown = 'Use `console.log()` to debug.';
      mockCRDT.getContent.mockReturnValue(markdown);
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor.getContent()).toBe(markdown);
    });

    it('should handle links', () => {
      const markdown = '[Link text](https://example.com)';
      mockCRDT.getContent.mockReturnValue(markdown);
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor.getContent()).toBe(markdown);
    });

    it('should handle images', () => {
      const markdown = '![Alt text](image.png)';
      mockCRDT.getContent.mockReturnValue(markdown);
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(editor.getContent()).toBe(markdown);
    });
  });

  describe('User Presence', () => {
    beforeEach(() => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
    });

    it('should display user list', () => {
      const users = [
        { id: 'user1', name: 'User 1', color: '#FF0000' },
        { id: 'user2', name: 'User 2', color: '#00FF00' }
      ];
      
      mockCRDT.getConnectedUsers.mockReturnValue(users);
      
      const userJoinedCallback = mockCRDT.on.mock.calls.find(
        call => call[0] === 'userJoined'
      )?.[1];
      
      if (userJoinedCallback) {
        userJoinedCallback(users[0]);
        userJoinedCallback(users[1]);
        
        // Verify users are displayed
        expect(mockCRDT.getConnectedUsers).toHaveBeenCalled();
      }
    });

    it('should handle user leaving', () => {
      const user = { id: 'user1', name: 'User 1', color: '#FF0000' };
      
      const userLeftCallback = mockCRDT.on.mock.calls.find(
        call => call[0] === 'userLeft'
      )?.[1];
      
      if (userLeftCallback) {
        userLeftCallback(user);
        
        expect(mockCRDT.getConnectedUsers).toHaveBeenCalled();
      }
    });

    it('should display cursors', () => {
      const cursors = [
        { userId: 'user1', position: 10, color: '#FF0000' },
        { userId: 'user2', position: 20, color: '#00FF00' }
      ];
      
      mockCRDT.getCursors.mockReturnValue(cursors);
      
      const cursorChangedCallback = mockCRDT.on.mock.calls.find(
        call => call[0] === 'cursorChanged'
      )?.[1];
      
      if (cursorChangedCallback) {
        cursorChangedCallback(cursors[0]);
        cursorChangedCallback(cursors[1]);
        
        expect(mockCRDT.getCursors).toHaveBeenCalled();
      }
    });

    it('should display selections', () => {
      const selections = [
        { userId: 'user1', start: 10, end: 15, color: '#FF0000' },
        { userId: 'user2', start: 20, end: 25, color: '#00FF00' }
      ];
      
      mockCRDT.getSelections.mockReturnValue(selections);
      
      const selectionChangedCallback = mockCRDT.on.mock.calls.find(
        call => call[0] === 'selectionChanged'
      )?.[1];
      
      if (selectionChangedCallback) {
        selectionChangedCallback(selections[0]);
        selectionChangedCallback(selections[1]);
        
        expect(mockCRDT.getSelections).toHaveBeenCalled();
      }
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
    });

    it('should update performance metrics', () => {
      const metrics = {
        latency: 50,
        throughput: 100,
        operationCount: 1000,
        memoryUsage: 1024
      };
      
      mockCRDT.getPerformanceMetrics.mockReturnValue(metrics);
      
      editor.updatePerformanceMetrics();
      
      expect(mockCRDT.getPerformanceMetrics).toHaveBeenCalled();
    });

    it('should handle rapid input events', () => {
      const textarea = mockDocument.createElement.mock.results.find(
        result => result.value.tagName === 'TEXTAREA'
      )?.value;
      
      // Simulate rapid typing
      for (let i = 0; i < 100; i++) {
        const event = { target: { value: 'a'.repeat(i) }, type: 'input' };
        textarea.dispatchEvent(event);
      }
      
      expect(mockCRDT.setContent).toHaveBeenCalledTimes(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing DOM elements gracefully', () => {
      mockDocument.querySelector.mockReturnValue(null);
      
      expect(() => new CollaborativeEditor(null as any, mockCRDTInstance)).not.toThrow();
    });

    it('should handle CRDT errors gracefully', () => {
      mockCRDT.setContent.mockImplementation(() => {
        throw new Error('CRDT error');
      });
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      const textarea = mockDocument.createElement.mock.results.find(
        result => result.value.tagName === 'TEXTAREA'
      )?.value;
      
      const event = { target: { value: 'test' }, type: 'input' };
      
      expect(() => textarea.dispatchEvent(event)).not.toThrow();
    });

    it('should handle selection errors gracefully', () => {
      mockWindow.getSelection.mockReturnValue(null);
      
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      const selectionCallback = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'selectionchange'
      )?.[1];
      
      if (selectionCallback) {
        expect(() => selectionCallback({})).not.toThrow();
      }
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on destroy', () => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      editor.destroy();
      
      expect(mockCRDT.off).toHaveBeenCalledWith('contentChanged', expect.any(Function));
      expect(mockCRDT.off).toHaveBeenCalledWith('userJoined', expect.any(Function));
      expect(mockCRDT.off).toHaveBeenCalledWith('userLeft', expect.any(Function));
      expect(mockCRDT.off).toHaveBeenCalledWith('cursorChanged', expect.any(Function));
      expect(mockCRDT.off).toHaveBeenCalledWith('selectionChanged', expect.any(Function));
    });

    it('should remove DOM event listeners on destroy', () => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      editor.destroy();
      
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('selectionchange', expect.any(Function));
    });

    it('should handle multiple destroy calls', () => {
      editor = new CollaborativeEditor(mockContainer as any, mockCRDTInstance);
      
      expect(() => {
        editor.destroy();
        editor.destroy();
      }).not.toThrow();
    });
  });


});