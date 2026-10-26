const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const reportsCtrl = require('../controllers/reportsController'); // ⚡ ضفنا ده عشان التقارير
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// كل Routes هنا محتاجة دكتور أو مهندس أو Head
router.use(verifyToken);
router.use(allowRoles('doctor', 'engineer', 'head'));

// Courses
router.get('/courses', doctorController.getMyCourses);

// Sessions
router.post('/sessions', doctorController.startSession);
router.get('/sessions/course/:course_id/active', doctorController.getActiveSession);
router.get('/active-session', doctorController.getCurrentActiveSession); // ⚡ عشان الـ Refresh
router.post('/sessions/:session_id/end', doctorController.endSession);

// QR
router.get('/sessions/:session_id/qr', doctorController.generateQR);

// Attendance
router.get('/sessions/:session_id/attendance', doctorController.getSessionAttendance);
router.post('/sessions/:session_id/manual-scan', doctorController.manualScan);
router.post('/sessions/:session_id/manual-add', doctorController.manualAdd);

// ⚡ Reports (اللي إحنا ضفناه دلوقتي)
router.get('/courses/:course_id/report', reportsCtrl.doctorCourseReport);
router.get('/courses/:course_id/export', reportsCtrl.exportCourseCSV);

module.exports = router;