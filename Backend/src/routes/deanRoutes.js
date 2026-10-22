const express = require('express');
const router = express.Router();
const deanController = require('../controllers/deanController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

router.use(verifyToken);
router.use(allowRoles('dean'));

// Majors
router.post('/majors', deanController.addMajor);
router.get('/majors', deanController.getMajors);
router.put('/majors/:id', deanController.updateMajor);
router.delete('/majors/:id', deanController.deleteMajor);

router.post('/heads', deanController.addHead);
router.get('/heads', deanController.getHeads);
router.put('/heads/:id', deanController.updateHead);
router.delete('/heads/:id', deanController.deleteHead);

module.exports = router;