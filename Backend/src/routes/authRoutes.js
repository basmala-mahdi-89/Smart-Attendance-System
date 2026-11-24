const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.get('/reset-password/:token', authController.validateResetToken);
router.post('/reset-password/:token', authController.resetPassword);
router.get('/me', verifyToken, authController.me);

// Public: majors available for student self-registration.
// Always read fresh from the database so dean add/edit/delete is reflected immediately.
router.get('/majors', authController.getPublicMajors);

module.exports = router;