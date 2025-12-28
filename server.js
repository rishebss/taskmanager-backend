import "dotenv/config";
import express from "express";
import todoRoutes from "./routes/todoRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cors from "cors";
import { authMiddleware } from "./middlewares/authMiddleware.js";

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
  'https://taskmanager-frontend-woad.vercel.app', // Your web frontend
  'http://localhost:8081',                        // Expo web development
  'http://localhost:19006',                       // Expo web alternative port
  /^http:\/\/localhost:\d+$/,                     // All localhost ports
  /^exp:\/\/.*$/,                                 // ALL Expo URLs
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,        // Local network IPs (for mobile testing)
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,         // More local IP ranges
  'http://10.0.2.2:3000',                        // Android emulator
  'http://localhost:3000',  
   null,                                          // ← ADD THIS to allow mobile apps
   undefined,                      // iOS simulator/localhost
];

// Mobile app requests often have null or no origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow requests with no origin (mobile apps, curl, postman)
  if (!origin) {
    return next();
  }
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => {
    if (typeof allowed === 'string') {
      return origin === allowed;
    }
    if (allowed instanceof RegExp) {
      return allowed.test(origin);
    }
    return false;
  });

  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    console.log('CORS blocked origin:', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  next();
});

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    cors: {
      note: "Mobile-friendly CORS enabled",
      yourOrigin: req.headers.origin || 'No origin header'
    }
  });
});

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "✅ Task Manager API is running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development',
    cors: "Mobile-friendly CORS enabled"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/todos", authMiddleware, todoRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found"
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Export for Vercel (serverless)
export default app;

// Only start server locally
if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`🌐 CORS enabled for mobile development`);
  });
}