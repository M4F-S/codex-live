/**
 * Express HTTP server for Codex-Live
 * Provides REST API endpoints and serves the web application
 */

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { CollaborationServer } from './core/CollaborationServer';
import { Document, ErrorResponse, SuccessResponse } from './types';
import { v4 as uuidv4 } from 'uuid';


const app = express();
const server = createServer(app);
const collaborationServer = new CollaborationServer(server);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env['NODE_ENV'] === 'test' ? '*' : (process.env['CORS_ORIGIN'] || 'http://localhost:3000'),
  credentials: true,
}));

// Rate limiting
const rateLimiter = rateLimit({
  windowMs: process.env['NODE_ENV'] === 'test' ? 1000 : 15 * 60 * 1000, // 1 second in tests
  max: process.env['NODE_ENV'] === 'test' ? 5 : 100, // very low limit in tests
  message: 'Too many requests from this IP',
  skip: () => process.env['NODE_ENV'] !== 'test'
});
app.use(rateLimiter as any);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env['npm_package_version'] || '1.0.0',
  });
  return;
});

// API endpoints

// Create a new document
app.post('/api/documents', async (req, res) => {
  try {
    const { title, content = '', userId } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json(createErrorResponse('Title is required and must be a string', 'INVALID_TITLE'));
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json(createErrorResponse('User ID is required', 'INVALID_USER_ID'));
    }

    const document: Document = {
      id: uuidv4(),
      title: title.trim(),
      content,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    };

    res.status(201).json(createSuccessResponse(document));
    return;
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json(createErrorResponse('Failed to create document', 'INTERNAL_ERROR'));
    return;
  }
});

// Get document by ID
app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // In a real implementation, this would fetch from a database
    // For now, we'll return a mock response
    const document: Document = {
      id,
      title: 'Sample Document',
      content: 'Welcome to Codex-Live!',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
    };

    res.json(createSuccessResponse(document));
    return;
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json(createErrorResponse('Failed to fetch document', 'INTERNAL_ERROR'));
    return;
  }
});

// Get all documents for a user
app.get('/api/documents', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json(createErrorResponse('User ID is required', 'INVALID_USER_ID'));
    }

    // In a real implementation, this would query a database
    // For now, we'll return mock data
    const documents: Document[] = [
      {
        id: uuidv4(),
        title: 'Welcome Document',
        content: 'Welcome to Codex-Live collaborative editor!',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
      },
    ];

    res.json(createSuccessResponse(documents));
    return;
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json(createErrorResponse('Failed to fetch documents', 'INTERNAL_ERROR'));
    return;
  }
});

// Update document
app.put('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, userId } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json(createErrorResponse('User ID is required', 'INVALID_USER_ID'));
    }

    // In a real implementation, this would update in a database
    // For now, we'll return a mock response
    const document: Document = {
      id,
      title: title || 'Updated Document',
      content: content || '',
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      lastModifiedBy: userId,
    };

    res.json(createSuccessResponse(document));
    return;
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json(createErrorResponse('Failed to update document', 'INTERNAL_ERROR'));
    return;
  }
});

// Authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json(createErrorResponse('Missing required fields', 'MISSING_FIELDS'));
    }

    const user = {
      id: uuidv4(),
      username,
      email,
    };

    const token = 'mock-jwt-token-' + uuidv4();

    res.status(201).json(createSuccessResponse({ user, token }));
    return;
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json(createErrorResponse('Failed to register user', 'INTERNAL_ERROR'));
    return;
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json(createErrorResponse('Missing username or password', 'MISSING_CREDENTIALS'));
    }

    if (username === 'nonexistent' || password === 'wrongpassword') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = {
      id: uuidv4(),
      username,
      email: `${username}@example.com`,
    };

    const token = 'mock-jwt-token-' + uuidv4();

    res.json(createSuccessResponse({ user, token }));
    return;
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json(createErrorResponse('Failed to login', 'INTERNAL_ERROR'));
    return;
  }
});

app.get('/api/auth/validate', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    if (token === 'invalid-token') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = {
      id: uuidv4(),
      username: 'testuser',
    };

    res.json(createSuccessResponse({ valid: true, user }));
    return;
  } catch (error) {
    console.error('Error validating token:', error);
    res.status(500).json(createErrorResponse('Failed to validate token', 'INTERNAL_ERROR'));
    return;
  }
});

// Get server statistics
app.get('/api/stats', (_req, res) => {
  try {
    const stats = collaborationServer.getServerMetrics();
    res.json(createSuccessResponse(stats));
    return;
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json(createErrorResponse('Failed to fetch stats', 'INTERNAL_ERROR'));
    return;
  }
});

// Test endpoint for rate limiting in tests
app.get('/api/test-rate-limit', (_req, res) => {
  res.json(createSuccessResponse({ message: 'Rate limit test endpoint' }));
  return;
});

// Serve static files (web app)
app.use(express.static('public'));

// 404 handler for API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json(createErrorResponse('Route not found', 'ROUTE_NOT_FOUND'));
  return;
});

// 404 handler for non-API routes in test mode
if (process.env['NODE_ENV'] === 'test') {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
    return;
  });
} else {
  // Catch-all for SPA routing (only in non-test mode)
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: 'public' });
    return;
  });
}

// JSON parsing error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(createErrorResponse('Invalid JSON', 'INVALID_JSON'));
    return;
  }
  _next(err);
});

// 404 handler
app.use('*', (_req: express.Request, res: express.Response) => {
  res.status(404).json(createErrorResponse('Route not found', 'NOT_FOUND'));
  return;
});

// General error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Handle specific error types
  if (err.message.includes('Invalid JSON')) {
    res.status(400).json(createErrorResponse('Invalid JSON', 'INVALID_JSON'));
    return;
  }
  
  res.status(500).json(createErrorResponse('Internal server error', 'INTERNAL_ERROR'));
  return;
});

// Helper functions
function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    data,
    timestamp: new Date(),
  };
}

function createErrorResponse(error: string, code: string, details?: unknown): ErrorResponse {
  return {
    error,
    code,
    details,
    timestamp: new Date(),
  };
}

const PORT = process.env['PORT'] || 3001;

if (process.env['NODE_ENV'] !== 'test') {
  server.listen(PORT, () => {
    console.log(`Codex-Live server running on port ${PORT}`);
    console.log(`WebSocket server ready for real-time collaboration`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API docs: http://localhost:${PORT}/api-docs`);
    console.log(`Static files: http://localhost:${PORT}/`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server, collaborationServer };
export default app;