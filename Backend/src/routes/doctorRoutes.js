const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const reportsCtrl = require('../controllers/reportsController');
const warnCtrl = require('../controllers/warningsController'); // ⚡ استدعاء الإنذارات
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// كل Routes هنا محتاجة دكتور أو مهندس أو Head
router.use(verifyToken);
router.use(allowRoles('doctor', 'engineer', 'head', 'dean'));

// Stats & Sessions
router.get('/stats', doctorController.getDoctorStats);
router.get('/sessions/history', doctorController.getMySessions);

// Courses
router.get('/courses', doctorController.getMyCourses);

// Sessions
router.post('/sessions', doctorController.startSession);
router.get('/sessions/course/:course_id/active', doctorController.getActiveSession);
router.get('/active-session', doctorController.getCurrentActiveSession);
router.post('/sessions/:session_id/end', doctorController.endSession);

// QR
router.get('/sessions/:session_id/qr', doctorController.generateQR);

// Attendance
router.get('/sessions/:session_id/attendance', doctorController.getSessionAttendance);
router.get('/sessions/:session_id/attendance-list', doctorController.getSessionAttendanceList);
router.delete('/sessions/:session_id/attendance/:attendance_id', doctorController.removeAttendance);
router.post('/sessions/:session_id/manual-scan', doctorController.manualScan);
router.post('/sessions/:session_id/manual-add', doctorController.manualAdd);
router.post('/sessions/:session_id/scan-student-qr', doctorController.scanStudentPersonalQR);

// Reports
router.get('/courses/:course_id/report', reportsCtrl.doctorCourseReport);
router.get('/courses/:course_id/export', reportsCtrl.exportCourseCSV);

// ⚡ Warnings (اللي إحنا بنصلحه دلوقتي)
router.post('/courses/:course_id/send-warnings', warnCtrl.sendWarnings);

module.exports = router;