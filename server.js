import "dotenv/config";
import express from "express";
import todoRoutes from "./routes/todoRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cors from "cors";
import { authMiddleware } from "./middlewares/authMiddleware.js";

const app = express();
const port = process.env.PORT || 3000;

// Simple CORS - Allow all for now
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://taskmanager-frontend-woad.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  next();
});

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