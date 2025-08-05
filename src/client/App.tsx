import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from './components/Editor';
import { UserList } from './components/UserList';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useCollaboration } from './hooks/useCollaboration';
import { User } from '../types';

export default function App() {
  const [documentId] = useState('demo-document');
  const [user] = useState<User>(() => ({
    id: Math.random().toString(36).substr(2, 9),
    name: `User-${Math.random().toString(36).substr(2, 4)}`,
    color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
    lastSeen: new Date(),
    isOnline: true
  }));

  const {
    content,
    users,
    cursors,
    isConnected,
    insertText,
    deleteText,
    updateCursor,
    updateSelection
  } = useCollaboration(documentId, user);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Codex-Live: Real-Time Collaborative Editor
          </h1>
          <div className="flex items-center justify-between">
            <ConnectionStatus isConnected={isConnected} />
            <UserList users={users} />
          </div>
        </header>

        <div className="bg-white rounded-lg shadow-lg">
          <Editor
            content={content}
            cursors={cursors}
            onInsert={insertText}
            onDelete={deleteText}
            onCursorChange={updateCursor}
            onSelectionChange={updateSelection}
            currentUser={user}
          />
        </div>

        <footer className="mt-8 text-center text-gray-600">
          <p>Document ID: {documentId} | User: {user.name}</p>
        </footer>
      </div>
    </div>
  );
}