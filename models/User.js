import bcrypt from 'bcryptjs';

class User {
  constructor({
    name,
    email,
    password,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }) {
    this.name = name;
    this.email = email;
    this.password = password;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    
    this.validate();
  }

  validate() {
    const errors = [];
    
    // Name validation
    if (!this.name || this.name.trim() === '') {
      errors.push('Name is required');
    } else if (this.name.length > 100) {
      errors.push('Name cannot exceed 100 characters');
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.email || !emailRegex.test(this.email)) {
      errors.push('Valid email is required');
    }
    
    // Password validation - skip if already hashed (starts with $2a$)
    if (this.password && !this.password.startsWith('$2a$') && this.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    // Trim fields
    this.name = this.name.trim();
    this.email = this.email.toLowerCase().trim();
  }

  // Hash password
  async hashPassword() {
    // Only hash if not already hashed
    if (!this.password.startsWith('$2a$')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  // Compare password
  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  // Convert to Firestore document format - FIXED: Includes password!
  toFirestore() {
    return {
      name: this.name,
      email: this.email,
      password: this.password, // CRITICAL: This was missing!
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Convert to JSON response (without password for security)
  toJSON() {
    return {
      name: this.name,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Create from Firestore document
  static fromFirestore(doc) {
    const data = doc.data();
    return new User({
      ...data
    });
  }
}

export default User;