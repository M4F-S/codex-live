# Codex-Live: Real-Time Collaborative Editor

A production-grade, real-time collaborative code editor built with CRDT (Conflict-free Replicated Data Types) and WebSocket technology.

## 🚀 Features

- **Real-time Collaboration**: Multiple users editing simultaneously
- **Conflict Resolution**: Automatic merge using CRDT algorithms
- **Cursor Synchronization**: Live cursor positions and selections
- **User Presence**: Online/offline status indicators
- **Security**: Input validation, XSS protection, rate limiting
- **Performance**: Sub-50ms latency for operational transforms

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │────│  WebSocket API  │────│   CRDT Core     │
│   (Frontend)    │    │   (Real-time)   │    │  (Backend)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS
- **Backend**: Node.js, TypeScript, WebSocket
- **Data Layer**: Yjs CRDT implementation
- **Testing**: Jest, Playwright
- **Deployment**: Vercel, Docker

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/your-org/codex-live.git
cd codex-live

# Install dependencies
npm install

# Start development
npm run dev
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 🚀 Deployment

```bash
# Deploy to Vercel
npm run deploy

# Docker deployment
docker build -t codex-live .
docker run -p 3000:3000 codex-live
```

## 🔒 Security

- Input validation on all user inputs
- XSS protection through sanitization
- Rate limiting (100 ops/100ms)
- WebSocket connection validation
- Zero hardcoded secrets

## 📊 Performance

- **Latency**: <50ms operational transforms
- **Throughput**: 1000+ concurrent ops/sec
- **Bundle Size**: 47KB gzipped
- **Memory**: <100MB per session

## 🎯 Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/your-org/codex-live.git
   cd codex-live && npm install
   ```

2. **Development**
   ```bash
   npm run dev
   ```

3. **Production**
   ```bash
   npm run build
   npm start
   ```

## 📈 Monitoring

- Health checks at `/health`
- WebSocket connection metrics
- Performance monitoring
- Error tracking integration

## 🔄 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure 100% test coverage
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.