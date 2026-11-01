const express = require('express');
const router = express.Router();
const deanController = require('../controllers/deanController');
const warnCtrl = require('../controllers/warningsController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.use(verifyToken);
router.use(allowRoles('dean'));

// Majors
router.post('/majors', deanController.addMajor);
router.get('/majors', deanController.getMajors);
router.put('/majors/:id', deanController.updateMajor);
router.delete('/majors/:id', deanController.deleteMajor);

// Heads
router.post('/heads', deanController.addHead);
router.get('/heads', deanController.getHeads);
router.put('/heads/:id', deanController.updateHead);
router.delete('/heads/:id', deanController.deleteHead);

// Dashboard & Overview
router.get('/dashboard-data', deanController.getDeanDashboardData);
router.put('/current-term', deanController.updateCurrentTerm);

// Staff Warnings
router.post('/send-staff-warning', warnCtrl.sendStaffWarning);

// Broadcast Warnings to Students
router.post('/broadcast-warning', deanController.broadcastWarning);

// Invitations
router.get('/invitations', deanController.getInvitations);
router.delete('/invitations/:id', deanController.cancelInvitation);

// User Management
router.put('/users/:type/:id/status', deanController.toggleUserStatus);
router.delete('/users/:type/:id', deanController.deleteUser);

// Advanced Reports
router.get('/reports/attendance-overview', deanController.getAttendanceOverview);
router.get('/reports/high-risk-students', deanController.getHighRiskStudents);
router.get('/reports/staff-activity', deanController.getStaffActivity);

// Live Sessions Monitor
router.get('/active-sessions', deanController.getActiveSessions);
router.post('/sessions/:id/force-close', deanController.forceCloseSession);

// Analytics
router.get('/analytics', deanController.getAnalytics);

// Audit Logs
router.get('/audit-logs', deanController.getAuditLogs);

module.exports = router;
