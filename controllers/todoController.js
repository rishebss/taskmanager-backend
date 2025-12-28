import Todo from '../models/Todo.js';
import { db } from '../config/firebase.js';

// Helper function to handle Firestore operations
const handleFirestoreError = (error) => {
  console.error('Firestore error:', error);
  
  if (error.code === 'permission-denied') {
    throw new Error('Permission denied. Check your Firebase rules.');
  } else if (error.code === 'not-found') {
    throw new Error('Resource not found.');
  } else if (error.code === 'already-exists') {
    throw new Error('Resource already exists.');
  } else {
    throw new Error(`Database error: ${error.message}`);
  }
};

// Create a new todo - UPDATED
export const createTodo = async (req, res) => {
  try {
    const { title, description, status, deadline } = req.body;
    const userId = req.user.id; // Get user ID from auth middleware
    
    // Create new Todo instance
    const todo = new Todo({
      title,
      description,
      status,
      deadline,
      userId // Add user ID
    });
    
    // Add to Firestore
    const docRef = await db.collection('todos').add(todo.toFirestore());
    
    res.status(201).json({
      success: true,
      message: 'Todo created successfully',
      data: {
        id: docRef.id,
        ...todo.toFirestore()
      }
    });
  } catch (error) {
    console.error('Create todo error:', error);
    
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create todo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all todos with optional filters - OPTIMIZED VERSION - UPDATED
export const getAllTodos = async (req, res) => {
  try {
    const { 
      status, 
      search,
      sortBy = 'createdAt', 
      order = 'desc',
      limit = 6,  
      page = 1
    } = req.query;
    
    const userId = req.user.id; // Get user ID from auth middleware
    
    // Parse parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = 6;
    
    console.log(`📊 Backend: Requested page=${pageNum}, limit=${limitNum}, status=${status || 'all'}`);
    
    // Step 1: Create base query - Filter by userId
    let query = db.collection('todos').where('userId', '==', userId);
    
    // Apply filter if provided
    if (status && ['pending', 'in-progress', 'completed'].includes(status)) {
      query = query.where('status', '==', status);
    }
    
    // Apply sorting
    const sortOrder = order === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(sortBy, sortOrder);
    
    // IMPORTANT: For Firestore, we need to handle pagination carefully
    
    // Step 2: If not on first page, get the offset document
    if (pageNum > 1) {
      // Create a separate query to get documents up to the offset
      let offsetQuery = db.collection('todos').where('userId', '==', userId);
      
      // Reapply filters
      if (status && ['pending', 'in-progress', 'completed'].includes(status)) {
        offsetQuery = offsetQuery.where('status', '==', status);
      }
      
      // Reapply sorting
      offsetQuery = offsetQuery.orderBy(sortBy, sortOrder);
      
      // Get the last document of the previous page
      const offset = (pageNum - 1) * limitNum;
      const offsetSnapshot = await offsetQuery.limit(offset).get();
      
      if (!offsetSnapshot.empty && offsetSnapshot.docs.length >= offset) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }
    
    // Step 3: Apply limit for current page
    query = query.limit(limitNum);
    
    // Step 4: Execute the paginated query
    const snapshot = await query.get();
    
    // Step 5: Get total count for this user
    let countQuery = db.collection('todos').where('userId', '==', userId);
    if (status && ['pending', 'in-progress', 'completed'].includes(status)) {
      countQuery = countQuery.where('status', '==', status);
    }
    
    // Apply search filter to count query as well
    if (search && search.trim() !== '') {
      const searchTerm = search.trim().toLowerCase();
      
      // For search, we need to get all user's documents and filter them
      const userTodosSnapshot = await db.collection('todos')
        .where('userId', '==', userId)
        .get();
      
      let allTodos = [];
      userTodosSnapshot.forEach(doc => {
        allTodos.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Filter based on search term
      allTodos = allTodos.filter(todo => 
        todo.title.toLowerCase().includes(searchTerm) || 
        todo.description.toLowerCase().includes(searchTerm)
      );
      
      // Apply status filter to search results
      if (status && ['pending', 'in-progress', 'completed'].includes(status)) {
        allTodos = allTodos.filter(todo => todo.status === status);
      }
      
      const total = allTodos.length;
      
      // Calculate total pages based on filtered results
      const totalPages = Math.ceil(total / limitNum);
      
      // Apply pagination to the filtered results
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedTodos = allTodos.slice(startIndex, endIndex);
      
      // Calculate deadlines for paginated results
      const todosWithDeadlineStatus = paginatedTodos.map(todo => {
        let deadlineStatus = 'none';
        if (todo.deadline) {
          const now = new Date();
          const deadline = new Date(todo.deadline);
          const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
          
          if (daysUntilDeadline < 0) {
            deadlineStatus = 'overdue';
          } else if (daysUntilDeadline === 0) {
            deadlineStatus = 'due-today';
          } else if (daysUntilDeadline <= 3) {
            deadlineStatus = 'due-soon';
          }
        }
        
        return {
          ...todo,
          deadlineStatus
        };
      });
      
      res.json({
        success: true,
        data: todosWithDeadlineStatus,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      });
      
      return; // Early return to avoid the rest of the logic
    }
    
    const countSnapshot = await countQuery.get();
    const total = countSnapshot.size;
    
    // Calculate total pages
    const totalPages = Math.ceil(total / limitNum);
    
    const todos = [];
    snapshot.forEach(doc => {
      todos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`📊 Backend: Total items=${total}, Returning ${todos.length} items`);
    
    // Calculate deadlines
    const todosWithDeadlineStatus = todos.map(todo => {
      let deadlineStatus = 'none';
      if (todo.deadline) {
        const now = new Date();
        const deadline = new Date(todo.deadline);
        const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntilDeadline < 0) {
          deadlineStatus = 'overdue';
        } else if (daysUntilDeadline === 0) {
          deadlineStatus = 'due-today';
        } else if (daysUntilDeadline <= 3) {
          deadlineStatus = 'due-soon';
        }
      }
      
      return {
        ...todo,
        deadlineStatus
      };
    });
    
    res.json({
      success: true,
      data: todosWithDeadlineStatus,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get all todos error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch todos'
    });
  }
};

// Get single todo by ID - UPDATED
export const getTodoById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const doc = await db.collection('todos').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found'
      });
    }
    
    const todo = doc.data();
    
    // Check if todo belongs to user
    if (todo.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this todo'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...todo
      }
    });
  } catch (error) {
    console.error('Get todo by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch todo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update todo - UPDATED
export const updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;
    
    // Check if todo exists and belongs to user
    const todoRef = db.collection('todos').doc(id);
    const doc = await todoRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found'
      });
    }
    
    const existingTodo = doc.data();
    
    // Check if todo belongs to user
    if (existingTodo.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this todo'
      });
    }
    
    // Create updated todo with validation
    const updatedTodo = new Todo({
      ...existingTodo,
      ...updates,
      userId, // Keep the same userId
      updatedAt: new Date().toISOString()
    });
    
    // Update in Firestore
    await todoRef.update(updatedTodo.toFirestore());
    
    res.json({
      success: true,
      message: 'Todo updated successfully',
      data: {
        id,
        ...updatedTodo.toFirestore()
      }
    });
  } catch (error) {
    console.error('Update todo error:', error);
    
    if (error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update todo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete todo - UPDATED
export const deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const todoRef = db.collection('todos').doc(id);
    const doc = await todoRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found'
      });
    }
    
    const todo = doc.data();
    
    // Check if todo belongs to user
    if (todo.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this todo'
      });
    }
    
    await todoRef.delete();
    
    res.json({
      success: true,
      message: 'Todo deleted successfully'
    });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete todo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get todos statistics - UPDATED
export const getTodoStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const snapshot = await db.collection('todos').where('userId', '==', userId).get();
    
    let total = 0;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    
    const now = new Date();
    
    snapshot.forEach(doc => {
      const todo = doc.data();
      total++;
      
      // Count by status
      if (todo.status === 'pending') pending++;
      if (todo.status === 'in-progress') inProgress++;
      if (todo.status === 'completed') completed++;
      
      // Check for overdue
      if (todo.deadline && new Date(todo.deadline) < now && todo.status !== 'completed') {
        overdue++;
      }
    });
    
    res.json({
      success: true,
      data: {
        total,
        pending,
        inProgress,
        completed,
        overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get todo stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};