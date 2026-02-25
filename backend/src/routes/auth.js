const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');

// Register new user
router.post('/register', validateRegistration, async (req, res, next) => {
  try {
    const { email, password, role, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: { message: 'Email already registered' } });
    }

    // Create new user
    const userId = await User.create({
      email,
      password,
      role,
      firstName,
      lastName
    });

    // Get created user
    const user = await User.findById(userId);
    const token = generateToken(userId, role);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    const isValidPassword = await User.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    next(error);
  }
});

// Demo login for role selection
router.post('/demo-login', async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!role || (role !== 'doctor' && role !== 'patient')) {
      return res.status(400).json({ error: { message: 'Invalid role specified' } });
    }

    // Get demo user based on role
    const demoEmail = role === 'doctor' ? 'doctor@demo.com' : 'patient@demo.com';
    const user = await User.findByEmail(demoEmail);

    if (!user) {
      return res.status(404).json({ error: { message: 'Demo user not found' } });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Demo login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        firstName: req.user.first_name,
        lastName: req.user.last_name
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
