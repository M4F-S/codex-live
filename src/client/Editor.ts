/**
 * Client-side collaborative editor for Codex-Live
 * Provides real-time collaborative editing with Markdown support
 */

import { CRDT } from '../core/CRDT';
import { User, Cursor, Selection } from '../types';

export interface EditorConfig {
  containerId: string;
  documentId: string;
  serverUrl: string;
  user: User;
  useWebRTC?: boolean;
  enableMarkdown?: boolean;
  theme?: 'light' | 'dark';
}

export interface EditorCallbacks {
  onContentChange?: (content: string) => void;
  onUserJoin?: (user: User) => void;
  onUserLeave?: (userId: string) => void;
  onCursorUpdate?: (cursor: Cursor) => void;
  onSelectionUpdate?: (selection: Selection) => void;
  onError?: (error: Error) => void;
}

export class CollaborativeEditor {
  private crdt!: CRDT;
  private container!: HTMLElement;
  private editor!: HTMLTextAreaElement;
  private cursorsContainer!: HTMLElement;
  private usersList!: HTMLElement;
  private config: EditorConfig;
  private callbacks: EditorCallbacks = {};
  private isUpdating = false;
  private lastContent = '';
  private userCursors: Map<string, HTMLElement> = new Map();

  constructor(config: EditorConfig, callbacks?: EditorCallbacks) {
    this.config = config;
    this.callbacks = callbacks || {};
    
    this.initializeDOM();
    this.initializeCRDT();
    this.setupEventListeners();
    this.render();
  }

  /**
   * Initialize DOM elements
   */
  private initializeDOM(): void {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      throw new Error(`Container with id '${this.config.containerId}' not found`);
    }
    this.container = container;

    this.container.innerHTML = `
      <div class="editor-container">
        <div class="editor-header">
          <div class="document-info">
            <h2 class="document-title">Document: ${this.config.documentId}</h2>
            <div class="connection-status" id="connection-status">
              <span class="status-indicator"></span>
              <span class="status-text">Connecting...</span>
            </div>
          </div>
          <div class="users-list" id="users-list">
            <h3>Active Users</h3>
            <ul class="users-ul"></ul>
          </div>
        </div>
        <div class="editor-content">
          <div class="cursors-layer" id="cursors-layer"></div>
          <textarea 
            class="editor-textarea" 
            id="editor-textarea"
            placeholder="Start typing..."
            spellcheck="false"
          ></textarea>
        </div>
        <div class="editor-footer">
          <div class="stats">
            <span id="char-count">0 characters</span>
            <span id="user-count">0 users</span>
          </div>
        </div>
      </div>
    `;

    this.editor = this.container.querySelector('#editor-textarea') as HTMLTextAreaElement;
    this.cursorsContainer = this.container.querySelector('#cursors-layer') as HTMLElement;
    this.usersList = this.container.querySelector('.users-ul') as HTMLElement;
  }

  /**
   * Initialize CRDT with callbacks
   */
  private initializeCRDT(): void {
    this.crdt = new CRDT(
      this.config.user.id,
      this.config.documentId,
      this.config.serverUrl,
      this.config.useWebRTC
    );

    this.crdt.setUser(this.config.user);
    this.crdt.setCallbacks({
      onContentChange: this.handleContentChange.bind(this),
      onUserJoin: this.handleUserJoin.bind(this),
      onUserLeave: this.handleUserLeave.bind(this),
      onCursorUpdate: this.handleCursorUpdate.bind(this),
      onSelectionUpdate: this.handleSelectionUpdate.bind(this),
      onError: this.handleError.bind(this),
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.editor.addEventListener('input', this.handleInput.bind(this));
    this.editor.addEventListener('keydown', this.handleKeydown.bind(this));
    this.editor.addEventListener('keyup', this.handleCursorActivity.bind(this));
    this.editor.addEventListener('mouseup', this.handleCursorActivity.bind(this));
    this.editor.addEventListener('focus', this.handleFocus.bind(this));
    this.editor.addEventListener('blur', this.handleBlur.bind(this));
    
    // Handle window resize for cursor positioning
    window.addEventListener('resize', this.updateCursorPositions.bind(this));
  }

  /**
   * Handle content changes from CRDT
   */
  private handleContentChange(content: string): void {
    if (this.isUpdating) return;
    
    this.isUpdating = true;
    const cursorPos = this.editor.selectionStart;
    const newContent = content;
    
    this.editor.value = newContent;
    this.lastContent = newContent;
    
    // Restore cursor position
    this.editor.setSelectionRange(cursorPos, cursorPos);
    
    this.updateStats();
    this.callbacks.onContentChange?.(content);
    
    this.isUpdating = false;
  }

  /**
   * Handle user input
   */
  private handleInput(_event: Event): void {
    if (this.isUpdating) return;
    
    const newContent = this.editor.value;
    const oldContent = this.lastContent;
    
    if (newContent === oldContent) return;
    
    // Calculate diff and apply to CRDT
    const diff = this.calculateDiff(oldContent, newContent);
    this.applyDiffToCRDT(diff);
    
    this.lastContent = newContent;
    this.updateStats();
    this.updateCursorActivity();
  }

  /**
   * Calculate text diff between old and new content
   */
  private calculateDiff(oldContent: string, newContent: string): Array<{
    type: 'insert' | 'delete';
    position: number;
    content?: string;
    length?: number;
  }> {
    const diffs: Array<{
      type: 'insert' | 'delete';
      position: number;
      content?: string;
      length?: number;
    }> = [];

    // Simple diff algorithm - can be enhanced with more sophisticated approach
    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldContent.length && newIndex < newContent.length) {
      if (oldContent[oldIndex] === newContent[newIndex]) {
        oldIndex++;
        newIndex++;
      } else {
        // Check for insertion
        let insertPos = newIndex;
        let insertContent = '';
        while (newIndex < newContent.length && oldContent[oldIndex] !== newContent[newIndex]) {
          insertContent += newContent[newIndex];
          newIndex++;
        }
        diffs.push({ type: 'insert', position: insertPos, content: insertContent });

        // Check for deletion
        if (oldIndex < oldContent.length && newIndex < newContent.length) {
          let deletePos = oldIndex;
          let deleteLength = 0;
          while (oldIndex < oldContent.length && oldContent[oldIndex] !== newContent[newIndex]) {
            deleteLength++;
            oldIndex++;
          }
          if (deleteLength > 0) {
            diffs.push({ type: 'delete', position: deletePos, length: deleteLength });
          }
        }
      }
    }

    // Handle remaining insertions
    if (newIndex < newContent.length) {
      diffs.push({
        type: 'insert',
        position: newIndex,
        content: newContent.slice(newIndex),
      });
    }

    // Handle remaining deletions
    if (oldIndex < oldContent.length) {
      diffs.push({
        type: 'delete',
        position: oldIndex,
        length: oldContent.length - oldIndex,
      });
    }

    return diffs;
  }

  /**
   * Apply diff operations to CRDT
   */
  private applyDiffToCRDT(diffs: Array<{
    type: 'insert' | 'delete';
    position: number;
    content?: string;
    length?: number;
  }>): void {
    // Apply in reverse order to maintain correct positions
    const sortedDiffs = [...diffs].sort((a, b) => b.position - a.position);
    
    for (const diff of sortedDiffs) {
      if (diff.type === 'insert' && diff.content) {
        this.crdt.insert(diff.position, diff.content);
      } else if (diff.type === 'delete' && diff.length) {
        this.crdt.delete(diff.position, diff.length);
      }
    }
  }

  /**
   * Handle keyboard events
   */
  private handleKeydown(event: KeyboardEvent): void {
    // Handle special keys like Tab, Enter, etc.
    if (event.key === 'Tab') {
      event.preventDefault();
      this.insertAtCursor('  ');
    }
  }

  /**
   * Handle cursor and selection activity
   */
  private handleCursorActivity(): void {
    this.updateCursorActivity();
  }

  /**
   * Update cursor activity to CRDT
   */
  private updateCursorActivity(): void {
    const cursorPos = this.editor.selectionStart;
    this.crdt.updateCursor(cursorPos);
    
    const selectionStart = this.editor.selectionStart;
    const selectionEnd = this.editor.selectionEnd;
    
    if (selectionStart !== selectionEnd) {
      this.crdt.updateSelection(selectionStart, selectionEnd);
    }
  }

  /**
   * Handle focus event
   */
  private handleFocus(): void {
    this.updateCursorActivity();
  }

  /**
   * Handle blur event
   */
  private handleBlur(): void {
    // Clear cursor when editor loses focus
    this.crdt.updateCursor(0);
  }

  /**
   * Handle user joining
   */
  private handleUserJoin(user: User): void {
    this.renderUsersList();
    this.callbacks.onUserJoin?.(user);
  }

  /**
   * Handle user leaving
   */
  private handleUserLeave(userId: string): void {
    this.removeUserCursor(userId);
    this.renderUsersList();
    this.callbacks.onUserLeave?.(userId);
  }

  /**
   * Handle cursor updates
   */
  private handleCursorUpdate(cursor: Cursor): void {
    this.renderUserCursor(cursor);
    this.callbacks.onCursorUpdate?.(cursor);
  }

  /**
   * Handle selection updates
   */
  private handleSelectionUpdate(selection: Selection): void {
    this.renderUserSelection(selection);
    this.callbacks.onSelectionUpdate?.(selection);
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('Editor error:', error);
    this.updateConnectionStatus('error', error.message);
    this.callbacks.onError?.(error);
  }

  /**
   * Insert text at cursor position
   */
  private insertAtCursor(text: string): void {
    const cursorPos = this.editor.selectionStart;
    this.crdt.insert(cursorPos, text);
  }

  /**
   * Render users list
   */
  private renderUsersList(): void {
    const users = this.crdt.getConnectedUsers();
    this.usersList.innerHTML = '';
    
    users.forEach(user => {
      const li = document.createElement('li');
      li.className = 'user-item';
      li.innerHTML = `
        <span class="user-color" style="background-color: ${user.color}"></span>
        <span class="user-name">${user.name}</span>
        <span class="user-status ${user.isOnline ? 'online' : 'offline'}"></span>
      `;
      this.usersList.appendChild(li);
    });
    
    this.updateStats();
  }

  /**
   * Render user cursor
   */
  private renderUserCursor(cursor: Cursor): void {
    this.removeUserCursor(cursor.userId);
    
    const cursorEl = document.createElement('div');
    cursorEl.className = 'user-cursor';
    cursorEl.dataset['userId'] = cursor.userId;
    cursorEl.style.left = `${this.getCursorPixelPosition(cursor.position)}px`;
    cursorEl.style.top = '0px';
    cursorEl.style.height = '20px';
    cursorEl.style.backgroundColor = this.getUserColor(cursor.userId);
    
    this.cursorsContainer.appendChild(cursorEl);
    this.userCursors.set(cursor.userId, cursorEl);
  }

  /**
   * Render user selection
   */
  private renderUserSelection(_selection: Selection): void {
    // Implementation for rendering selection highlights
    // This would involve creating overlay elements for selection ranges
  }

  /**
   * Remove user cursor
   */
  private removeUserCursor(userId: string): void {
    const cursorEl = this.userCursors.get(userId);
    if (cursorEl) {
      cursorEl.remove();
      this.userCursors.delete(userId);
    }
  }

  /**
   * Get cursor pixel position from character position
   */
  private getCursorPixelPosition(position: number): number {
    // Simplified calculation - would need more sophisticated approach for real implementation
    return position * 8; // Approximate character width
  }

  /**
   * Update cursor positions on window resize
   */
  private updateCursorPositions(): void {
    // Recalculate cursor positions based on new layout
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(status: string, message?: string): void {
    const statusEl = this.container.querySelector('#connection-status') as HTMLElement;
    const indicator = statusEl.querySelector('.status-indicator') as HTMLElement;
    const text = statusEl.querySelector('.status-text') as HTMLElement;
    
    indicator.className = `status-indicator ${status}`;
    text.textContent = message || status;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    const charCount = this.crdt.getContent().length;
    const userCount = this.crdt.getConnectedUsers().length;
    
    this.container.querySelector('#char-count')!.textContent = `${charCount} characters`;
    this.container.querySelector('#user-count')!.textContent = `${userCount} users`;
  }

  /**
   * Get user color
   */
  private getUserColor(userId: string): string {
    const users = this.crdt.getConnectedUsers();
    const user = users.find(u => u.id === userId);
    return user?.color || '#007bff';
  }

  /**
   * Render the editor
   */
  private render(): void {
    this.updateConnectionStatus('connected');
    this.renderUsersList();
    
    // Load initial content
    this.editor.value = this.crdt.getContent();
    this.lastContent = this.editor.value;
    this.updateStats();
  }

  /**
   * Get current content
   */
  public getContent(): string {
    return this.crdt.getContent();
  }

  /**
   * Set content
   */
  public setContent(content: string): void {
    this.crdt.setContent(content);
  }

  /**
   * Focus the editor
   */
  public focus(): void {
    this.editor.focus();
  }

  /**
   * Destroy the editor
   */
  public destroy(): void {
    this.crdt.destroy();
    this.container.innerHTML = '';
  }

  /**
   * Wait for synchronization
   */
  public async waitForSync(): Promise<void> {
    await this.crdt.waitForSync();
  }
}