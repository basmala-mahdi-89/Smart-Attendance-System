const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/invitationsController');
const { verifyToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// Public routes (no auth)
router.get('/:token', ctrl.getInvitationByToken);
router.post('/:token/accept', ctrl.acceptInvitation);

// Protected routes
router.post('/', verifyToken, allowRoles('dean', 'head', 'doctor'), ctrl.createInvitation);
router.get('/', verifyToken, allowRoles('dean', 'head', 'doctor'), ctrl.getInvitations);

module.exports = router;