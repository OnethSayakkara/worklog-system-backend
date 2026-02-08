const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');

// Register user
const register = async (req, res) => {
    try {
        const { email, password, full_name, role, sub_category } = req.body;

        // Check if user exists
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (userExists.rows.length > 0) {
            return errorResponse(res, 400, 'User with this email already exists');
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Insert user
        const newUser = await pool.query(
            'INSERT INTO users (email, password_hash, full_name, role, sub_category) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, sub_category, created_at',
            [
                email.toLowerCase(),
                password_hash,
                full_name,
                role || 'software_engineer',
                sub_category || 'intern'
            ]
        );

        return successResponse(
            res,
            201,
            'User registered successfully. Please login to continue.',
            { user: newUser.rows[0] }
        );

    } catch (err) {
        console.error('Register error:', err.message);
        return errorResponse(res, 500, 'Server error during registration');
    }
};

// Login user
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (user.rows.length === 0) {
            return errorResponse(res, 400, 'Invalid email or password');
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);

        if (!isMatch) {
            return errorResponse(res, 400, 'Invalid email or password');
        }

        // Create JWT payload
        const payload = {
            user: {
                id: user.rows[0].id,
                email: user.rows[0].email,
                role: user.rows[0].role
            }
        };

        // Sign token
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.rows[0].id,
                email: user.rows[0].email,
                full_name: user.rows[0].full_name,
                role: user.rows[0].role,
                sub_category: user.rows[0].sub_category
            }
        });

    } catch (err) {
        console.error('Login error:', err.message);
        return errorResponse(res, 500, 'Server error during login');
    }
};

// Get current user
const getCurrentUser = async (req, res) => {
    try {
        const user = await pool.query(
            'SELECT id, email, full_name, role, sub_category, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return errorResponse(res, 404, 'User not found');
        }

        return successResponse(res, 200, 'User retrieved successfully', { user: user.rows[0] });

    } catch (err) {
        console.error('Get user error:', err.message);
        return errorResponse(res, 500, 'Server error');
    }
};

// Verify token
const verifyToken = (req, res) => {
    return successResponse(res, 200, 'Token is valid', { user: req.user });
};

module.exports = {
    register,
    login,
    getCurrentUser,
    verifyToken
};
