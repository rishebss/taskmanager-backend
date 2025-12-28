import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { db } from '../config/firebase.js';

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '30d' }
  );
};

// Register new user
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const userSnapshot = await db.collection('users')
      .where('email', '==', email.toLowerCase())
      .get();
    
    if (!userSnapshot.empty) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }
    
    // Create new user
    const user = new User({
      name,
      email,
      password
    });
    
    // Hash password
    await user.hashPassword();
    
    // Save to Firestore
    const userRef = await db.collection('users').add(user.toFirestore());
    
    // Get the saved user data
    const savedUser = await userRef.get();
    
    // Generate token
    const token = generateToken(userRef.id);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: userRef.id,
          ...savedUser.data()
        }
      }
    });
    
  } catch (error) {
    console.error('Register error:', error);
    
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Login user
// Login user - FIXED VERSION
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }
    
    // Find user by email
    const userSnapshot = await db.collection('users')
      .where('email', '==', email.toLowerCase())
      .get();
    
    if (userSnapshot.empty) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Get user data
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Check if user has a password (for users registered before password field was added)
    if (!userData.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Create user instance WITHOUT validation for the password
    const user = new User({
      name: userData.name,
      email: userData.email,
      password: userData.password, // This is the hashed password
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt
    });
    
    // Compare password - don't validate the hashed password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Generate token
    const token = generateToken(userDoc.id);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: userDoc.id,
          name: userData.name,
          email: userData.email,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        }
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle validation errors differently
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    // User is already attached to request by authMiddleware
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;
    
    // Check if email is being changed and if it's already taken
    if (email && email !== req.user.email) {
      const emailSnapshot = await db.collection('users')
        .where('email', '==', email.toLowerCase())
        .get();
      
      if (!emailSnapshot.empty) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use'
        });
      }
    }
    
    const updates = {
      ...(name && { name }),
      ...(email && { email: email.toLowerCase() }),
      updatedAt: new Date().toISOString()
    };
    
    // Update in Firestore
    await db.collection('users').doc(userId).update(updates);
    
    // Get updated user
    const updatedUser = await db.collection('users').doc(userId).get();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: userId,
          ...updatedUser.data()
        }
      }
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // Get user with password
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Create user instance to verify current password
    const user = new User({
      ...userData,
      password: userData.password
    });
    
    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    user.password = newPassword;
    await user.hashPassword();
    
    // Update password in Firestore
    await db.collection('users').doc(userId).update({
      password: user.password,
      updatedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
};