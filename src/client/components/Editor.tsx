import React, { useRef, useEffect, useState, useCallback } from 'react';
import { User, Cursor } from '../../types';

interface EditorProps {
  content: string;
  cursors: Cursor[];
  onInsert: (position: number, text: string) => void;
  onDelete: (position: number, length: number) => void;
  onCursorChange: (position: number) => void;
  onSelectionChange: (start: number, end: number) => void;
  currentUser: User;
}

export const Editor: React.FC<EditorProps> = ({
  content,
  cursors,
  onInsert,
  onDelete,
  onCursorChange,
  onSelectionChange,
  currentUser
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const oldContent = content;
    
    // Calculate the difference
    let position = 0;
    let insertedText = '';
    let deletedLength = 0;
    
    if (newContent.length > oldContent.length) {
      // Insertion
      position = e.target.selectionStart - (newContent.length - oldContent.length);
      insertedText = newContent.substring(position, position + (newContent.length - oldContent.length));
      onInsert(position, insertedText);
    } else if (newContent.length < oldContent.length) {
      // Deletion
      position = e.target.selectionStart;
      deletedLength = oldContent.length - newContent.length;
      onDelete(position, deletedLength);
    }
  }, [content, onInsert, onDelete]);

  const handleSelect = useCallback(() => {
    if (textareaRef.current) {
      const { selectionStart, selectionEnd } = textareaRef.current;
      setSelection({ start: selectionStart, end: selectionEnd });
      onSelectionChange(selectionStart, selectionEnd);
    }
  }, [onSelectionChange]);

  const handleCursorMove = useCallback(() => {
    if (textareaRef.current) {
      const position = textareaRef.current.selectionStart;
      onCursorChange(position);
    }
  }, [onCursorChange]);

  const renderCursors = () => {
    return cursors
      .filter(cursor => cursor.userId !== currentUser.id)
      .map((cursor, index) => {
        const lines = content.substring(0, cursor.position).split('\n');
        const currentLine = lines.length - 1;
        const currentColumn = lines[lines.length - 1].length;

        return (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none"
            style={{
              top: `${currentLine * 24 + 12}px`,
              left: `${currentColumn * 8}px`,
              width: '2px',
              height: '20px',
              backgroundColor: cursor.userId === currentUser.id ? 'transparent' : '#3b82f6',
              animation: 'blink 1s infinite'
            }}
          >
            <div
              className="absolute -top-6 left-2 px-2 py-1 rounded text-xs text-white"
              style={{
                backgroundColor: cursor.userId === currentUser.id ? 'transparent' : '#3b82f6'
              }}
            >
              {cursor.userId}
            </div>
          </div>
        );
      });
  };

  return (
    <div className="relative">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Collaborative Document</h2>
          <div className="text-sm text-gray-600">
            Characters: {content.length}
          </div>
        </div>
      </div>
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onSelect={handleSelect}
          onKeyUp={handleCursorMove}
          onClick={handleCursorMove}
          className="w-full min-h-96 p-4 font-mono text-sm resize-none focus:outline-none"
          placeholder="Start typing to collaborate..."
          spellCheck={false}
        />
        
        {/* Cursor overlays */}
        <div className="absolute inset-0 pointer-events-none">
          {renderCursors()}
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div>
            Cursor: {selection.start}:{selection.end}
          </div>
          <div>
            {cursors.length - 1} other users editing
          </div>
        </div>
      </div>
    </div>
  );
};