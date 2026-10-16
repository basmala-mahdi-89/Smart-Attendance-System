const express = require('express');
const router = express.Router();
const headController = require('../controllers/headController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// All routes here require Head role
router.use(verifyToken);
router.use(allowRoles('head'));

// Staff
router.get('/staff', headController.getStaff);

// Courses
router.get('/courses', headController.getCourses);
router.post('/courses', headController.createCourse);
router.get('/courses/:course_id', headController.getCourseDetails);

// Course Staff
router.post('/courses/:course_id/staff', headController.assignStaffToCourse);
router.delete('/courses/:course_id/staff/:staff_id', headController.removeStaffFromCourse);

// Students
router.get('/students/pending', headController.getPendingStudents);
router.get('/students', headController.getAllStudents);
router.post('/students/:student_id/approve', headController.approveStudent);
router.post('/students/:student_id/reject', headController.rejectStudent);

// Enrollments
router.post('/students/:student_id/enroll', headController.enrollStudent);
router.get('/students/:student_id/enrollments', headController.getStudentEnrollments);
router.delete('/students/:student_id/enrollments/:course_id', headController.removeEnrollment);

module.exports = router;

