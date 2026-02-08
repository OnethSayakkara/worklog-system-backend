const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../validators/authValidator');
const auth = require('../middleware/auth');


router.post('/register', validateRegister, authController.register);

router.post('/login', validateLogin, authController.login);

router.get('/me', auth, authController.getCurrentUser);

router.get('/verify', auth, authController.verifyToken);

module.exports = router;
