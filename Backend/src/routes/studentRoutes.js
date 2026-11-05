const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentController');
const warnCtrl = require('../controllers/warningsController');
const pointsCtrl = require('../controllers/pointsController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// Public routes
router.post('/register', ctrl.register);
router.get('/verify-email/:token', ctrl.verifyEmail);
router.post('/verify-otp', ctrl.verifyOTP);

// Protected routes (Student only)
router.use(verifyToken);
router.use(allowRoles('student'));

router.get('/me', ctrl.getMyProfile);
router.get('/me/courses', ctrl.getMyCourses);
router.get('/me/attendance', ctrl.getMyAttendance);
router.get('/me/personal-qr', ctrl.getMyPersonalQR);
router.get('/me/points', pointsCtrl.getMyPoints);
router.post('/scan', ctrl.scanQR);

// ⚡ Warnings Route
router.get('/me/warnings', warnCtrl.getMyWarnings);

module.exports = router;