const express = require('express');
const router = express.Router();
const deanController = require('../controllers/deanController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const reportsCtrl = require('../controllers/reportsController');

// كل Routes هنا محتاجة Dean
router.use(verifyToken);
router.use(allowRoles('dean'));

// Majors
router.post('/majors', deanController.addMajor);
router.get('/majors', deanController.getMajors);
router.put('/majors/:id', deanController.updateMajor);
router.delete('/majors/:id', deanController.deleteMajor);

// Reports
router.get('/overview', reportsCtrl.deanOverview);
router.get('/overview/export', reportsCtrl.exportDeanOverviewCSV);
module.exports = router;