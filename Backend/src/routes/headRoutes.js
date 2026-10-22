const express = require('express');
const router = express.Router();
const headController = require('../controllers/headController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.use(verifyToken);
router.use(allowRoles('head'));

// Staff
router.get('/staff', headController.getStaff);

// Courses
router.get('/courses', headController.getCourses);
router.post('/courses', headController.createCourse);

// Assign Staff
router.post('/courses/:course_id/staff', headController.assignStaffToCourse);
router.delete('/courses/:course_id/staff/:assignment_id', headController.removeStaffFromCourse);

// Students
router.get('/students/pending', headController.getPendingStudents);
router.get('/students', headController.getAllStudents);
router.post('/students/:student_id/approve', headController.approveStudent);
router.post('/students/:student_id/reject', headController.rejectStudent);

// Reports
router.get('/major/overview', require('../controllers/reportsController').headMajorOverview);

module.exports = router;