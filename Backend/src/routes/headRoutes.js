const express = require('express');
const router = express.Router();
const headController = require('../controllers/headController');
const reportsCtrl = require('../controllers/reportsController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.use(verifyToken);
router.use(allowRoles('head'));

// Major & Term
router.get('/major/info', headController.getMajorInfo);
router.put('/major/current-term', headController.updateCurrentTerm);

// Staff
router.get('/staff', headController.getStaff);

// Courses
router.get('/courses', headController.getCourses);
router.get('/courses/:course_id/students', headController.getCourseStudents);
router.post('/courses', headController.createCourse);
router.put('/courses/:course_id', headController.updateCourse);
router.post('/courses/:course_id/staff', headController.assignStaffToCourse);
router.delete('/courses/:course_id/staff/:assignment_id', headController.removeStaffFromCourse);

// Students
router.get('/students/pending', headController.getPendingStudents);
router.get('/students', headController.getAllStudents);
router.post('/students/pending/accept-all', headController.acceptAllPendingStudents);
router.post('/students/:student_id/approve', headController.approveStudent);
router.post('/students/:student_id/reject', headController.rejectStudent);

// Reports
router.get('/major/overview', reportsCtrl.headMajorOverview);

// Invitations
router.get('/invitations/pending', headController.getPendingInvites);
router.delete('/invitations/:id', headController.cancelInvite);

// Students Management
router.put('/students/:student_id/status', headController.toggleStudentStatus);
router.get('/students/risk', headController.getRiskStudents);
router.post('/students/warning', headController.sendWarningToStudents);

// Sessions & Performance
router.get('/sessions/active', headController.getActiveSessions);
router.get('/sessions/:session_id/attendance', headController.getSessionAttendance);
router.post('/sessions/:id/close', headController.closeSession);
router.get('/staff/performance', headController.getStaffPerformance);

module.exports = router;