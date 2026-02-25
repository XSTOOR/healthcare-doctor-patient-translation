const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, '../audio')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Socket.IO configuration
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Import routes
const authRoutes = require('./routes/auth');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const summaryRoutes = require('./routes/summaries');
const searchRoutes = require('./routes/search');
const translationRoutes = require('./routes/translation');
const aiSummaryRoutes = require('./routes/ai-summary');
const audioRoutes = require('./routes/audio');
const conversationLogRoutes = require('./routes/conversation-log');
const realtimeRoutes = require('./routes/realtime');

// Import WebSocket handler
const setupWebSocket = require('./websocket/socketHandler');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes - make io available to routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', (req, res, next) => {
  req.io = io;
  next();
}, messageRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/ai-summary', aiSummaryRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/conversation-log', conversationLogRoutes);
app.use('/api/realtime', realtimeRoutes);

// Setup WebSocket
setupWebSocket(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Make io accessible to routes
app.set('io', io);

module.exports = { app, server, io };
