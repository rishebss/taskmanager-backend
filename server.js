import "dotenv/config";
import express from "express";
import todoRoutes from "./routes/todoRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cors from "cors";
import { authMiddleware } from "./middlewares/authMiddleware.js";

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration - Updated with your frontend URL
const allowedOrigins = [
  'http://localhost:5173', // Local development
  'http://localhost:3000', // Alternative local port
  'https://taskmanager-frontend-woad.vercel.app', // Your deployed frontend (NO trailing slash)
  process.env.FRONTEND_URL // Optional: Add from environment variable
].filter(Boolean); // Remove any falsy values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if the origin is in the allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Exact match
      if (origin === allowedOrigin) return true;
      
      // Match with/without trailing slash
      if (origin === allowedOrigin.replace(/\/$/, '') || 
          origin === allowedOrigin + '/') {
        return true;
      }
      
      // Match localhost variations
      if (allowedOrigin.includes('localhost') && origin.includes('localhost')) {
        const originHost = origin.split(':')[0];
        const allowedHost = allowedOrigin.split(':')[0];
        return originHost === allowedHost;
      }
      
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error(`CORS policy: Origin ${origin} not allowed`), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Simple health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "✅ Task Manager API is running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development',
    cors: {
      allowedOrigins: allowedOrigins,
      note: "If you see CORS errors, check your origin is in the list above"
    }
  });
});

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/todos", authMiddleware, todoRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    requestedPath: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Handle CORS errors specifically
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      error: "CORS Error",
      message: err.message,
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin || 'No origin header'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Export for Vercel (serverless)
export default app;

// Only start server locally (not on Vercel)
if (process.env.VERCEL !== '1' && !process.env.VERCEL_URL) {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
  });
}