import express from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
} from '../controllers/authControllers.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.put('/change-password', authMiddleware, changePassword);

export default router;