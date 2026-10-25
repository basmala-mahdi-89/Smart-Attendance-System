const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// كل Routes هنا محتاجة دكتور أو مهندس أو رئيس قسم
// ⚡ ضفنا 'head' عشان الـ Head يقدر يفتح محاضرات ويشوف كورساته
router.use(verifyToken);
router.use(allowRoles('doctor', 'engineer', 'head'));

// Courses
router.get('/courses', doctorController.getMyCourses);

// Sessions
router.post('/sessions', doctorController.startSession);
router.get('/sessions/course/:course_id/active', doctorController.getActiveSession);
router.post('/sessions/:session_id/end', doctorController.endSession);

// QR
router.get('/sessions/:session_id/qr', doctorController.generateQR);

// Attendance
router.get('/sessions/:session_id/attendance', doctorController.getSessionAttendance);
router.post('/sessions/:session_id/manual-scan', doctorController.manualScan);
router.post('/sessions/:session_id/manual-add', doctorController.manualAdd);
router.get('/active-session', doctorController.getCurrentActiveSession);

module.exports = router;