const express = require('express');
const router = express.Router();
const workLogController = require('../controllers/worklogController');
const auth = require('../middleware/auth');


router.use(auth);

router.get('/', workLogController.getAllWorkLogs);

router.get('/my-logs', workLogController.getMyWorkLogs);

router.get('/stats', workLogController.getWorkLogStats);

router.get('/:id', workLogController.getWorkLogById);

router.post('/', workLogController.createWorkLog);

router.put('/:id', workLogController.updateWorkLog);

router.delete('/:id', workLogController.deleteWorkLog);

router.get('/user/:userId', workLogController.getWorkLogsByUserId);

module.exports = router;
