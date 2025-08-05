/**
 * Unit tests for Express HTTP server
 * Ensures 100% test coverage for REST API endpoints and security features
 */

import request from 'supertest';
import app from '../server';

describe('Express Server', () => {
  let server: any;

  beforeEach(() => {
    // Server is already created in the imported app
  });

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('health check endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
      });
    });
  });

  describe('document endpoints', () => {
    it('should create a new document', async () => {
      const response = await request(app)
        .post('/api/documents')
        .send({ title: 'Test Document', userId: 'test-user' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Test Document',
        content: '',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should create document with default title', async () => {
      const response = await request(app)
        .post('/api/documents')
        .send({ userId: 'test-user' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Untitled Document');
    });

    it('should retrieve document by ID', async () => {
      const createResponse = await request(app)
        .post('/api/documents')
        .send({ title: 'Test Document', userId: 'test-user' });

      const documentId = createResponse.body.id;
      const response = await request(app).get(`/api/documents/${documentId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: documentId,
        title: 'Test Document',
        content: '',
      });
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app).get('/api/documents/nonexistent-id');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Document not found',
      });
    });

    it('should update document content', async () => {
      const createResponse = await request(app)
        .post('/api/documents')
        .send({ title: 'Test Document', userId: 'test-user' });

      const documentId = createResponse.body.id;
      const response = await request(app)
        .put(`/api/documents/${documentId}`)
        .send({ content: 'Updated content', userId: 'test-user' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: documentId,
        content: 'Updated content',
        updatedAt: expect.any(String),
      });
    });

    it('should return 404 when updating non-existent document', async () => {
      const response = await request(app)
        .put('/api/documents/nonexistent-id')
        .send({ content: 'Updated content' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Document not found',
      });
    });

    it('should list all documents', async () => {
      await request(app).post('/api/documents').send({ title: 'Document 1', userId: 'test-user' });
      await request(app).post('/api/documents').send({ title: 'Document 2', userId: 'test-user' });

      const response = await request(app).get('/api/documents?userId=test-user');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return empty array when no documents exist', async () => {
      const response = await request(app).get('/api/documents?userId=test-user');
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('authentication endpoints', () => {
    it('should register new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        user: {
          id: expect.any(String),
          username: 'testuser',
          email: 'test@example.com',
        },
        token: expect.any(String),
      });
    });

    it('should not register user with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Missing required fields',
      });
    });

    it('should login with valid credentials', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: {
          id: expect.any(String),
          username: 'testuser',
          email: 'test@example.com',
        },
        token: expect.any(String),
      });
    });

    it('should not login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Invalid credentials',
      });
    });

    it('should validate JWT token', async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      const token = registerResponse.body.token;
      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        valid: true,
        user: {
          id: expect.any(String),
          username: 'testuser',
        },
      });
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Invalid token',
      });
    });

    it('should reject missing authorization header', async () => {
      const response = await request(app).get('/api/auth/validate');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'No token provided',
      });
    });
  });

  describe('security middleware', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers).toMatchObject({
        'x-frame-options': expect.any(String),
        'x-content-type-options': expect.any(String),
        'x-xss-protection': expect.any(String),
        'strict-transport-security': expect.any(String),
      });
    });

    it('should enable CORS', async () => {
      const response = await request(app)
        .options('/api/documents')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should rate limit requests', async () => {
      const promises = [];
      for (let i = 0; i < 110; i++) {
        promises.push(request(app).get('/health'));
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      if (rateLimitedResponses.length > 0 && rateLimitedResponses[0]) {
        expect(rateLimitedResponses[0].body).toMatchObject({
          error: expect.stringContaining('Too many requests'),
        });
      }
    });
  });

  describe('error handling', () => {
    it('should handle 404 routes', async () => {
      const response = await request(app).get('/nonexistent-route');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Route not found',
      });
    });

    it('should handle malformed JSON in POST requests', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Invalid JSON'),
      });
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/documents')
        .send({ title: 123 }); // Invalid type

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.any(String),
      });
    });
  });

  describe('server statistics', () => {
    it('should return server statistics', async () => {
      const response = await request(app).get('/api/stats');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        documents: expect.any(Number),
        connections: expect.any(Number),
        uptime: expect.any(Number),
      });
    });
  });

  describe('content-type validation', () => {
    it('should accept application/json', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Content-Type', 'application/json')
        .send({ title: 'Test', userId: 'test-user' });

      expect(response.status).toBe(201);
    });

    it('should reject unsupported content types', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('Content-Type', 'text/plain')
        .send('plain text');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: expect.any(String),
      });
    });
  });
});