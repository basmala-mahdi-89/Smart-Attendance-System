const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/doctorController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// All routes require Doctor or Engineer
router.use(verifyToken);
router.use(allowRoles('doctor', 'engineer'));

// Courses
router.get('/courses', ctrl.getMyCourses);

// Sessions
router.post('/sessions', ctrl.startSession);
router.get('/sessions/course/:course_id/active', ctrl.getActiveSession);
router.post('/sessions/:session_id/end', ctrl.endSession);

// QR
router.get('/sessions/:session_id/qr', ctrl.generateQR);

// Attendance
router.get('/sessions/:session_id/attendance', ctrl.getSessionAttendance);
router.post('/sessions/:session_id/manual-scan', ctrl.manualScan);

module.exports = router;