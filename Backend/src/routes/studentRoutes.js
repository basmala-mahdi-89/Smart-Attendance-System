const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentController');

router.post('/register', ctrl.register);
router.get('/verify-email/:token', ctrl.verifyEmail);
router.post('/verify-otp', ctrl.verifyOTP);

module.exports = router;