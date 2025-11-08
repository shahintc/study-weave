const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/database'); // ADD THIS LINE
const User = require('../models/User');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = await User.create({ name, email, password, role });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Update User
router.put('/update', async (req, res) => {
  try {
    const { id, name, email, password } = req.body;

    const updatedUser = await User.update(id, { name, email, password });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Server error during update' });
  }
});

// Delete User
router.delete('/delete', async (req, res) => {
  try {
    const { id } = req.body;

    const deletedUser = await User.delete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Server error during deletion' });
  }
});

// getting all users 
router.get('/users', async (req, res) => {
  try {
    const query = 'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC';
    const result = await pool.query(query); // Now pool is defined
    
    res.json({
      message: 'Users fetched successfully',
      users: result.rows
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

//getting user by id
// router.get('/users/:id', async (req, res) => {
//   try {
//     const userId = req.params.id;        // id is the 1st element so: $1
//     const query = 'SELECT * FROM users WHERE id = $1';      //return only one row where the user is so row[0]
//     const result = await pool.query(query, [userId]); 
    
//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: `User with id=${userId} not found` });
//     }
//     res.json({
//       message: `User with id=${userId} fetched successfully`,
//       user: result.rows[0],
//     });
//   } catch (error) {
//     console.error(`Error fetching user id=${req.params.id}:`, error);
//     res.status(500).json({ message: 'Server error while fetching user' });
//   }
// });



module.exports = router;