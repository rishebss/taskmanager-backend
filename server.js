import "dotenv/config";
import express from "express";
import todoRoutes from "./routes/todoRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cors from "cors";
import { authMiddleware } from "./middlewares/authMiddleware.js";

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration - More permissive
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://taskmanager-frontend-woad.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Temporarily allow all for debugging
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-JSON'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "✅ Task Manager API is running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development'
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
  });
}
```

## Fix 3: Check your frontend API URL

Also make sure your **frontend** is calling the correct backend URL. Your error shows:
```
'https://taskmanager-backend-one.vercel.app/auth/login'
```

But it should be:
```
'https://taskmanager-backend-one.vercel.app/api/auth/login'