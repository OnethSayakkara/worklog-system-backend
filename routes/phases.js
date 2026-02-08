const express = require('express');
const router = express.Router();
const phaseController = require('../controllers/phaseController');
const auth = require('../middleware/auth');


router.get('/project/:project_id', auth, phaseController.getPhasesByProject);

router.get('/:id', auth, phaseController.getPhaseById);

router.post('/', auth, phaseController.createPhase);

router.put('/:id', auth, phaseController.updatePhase);

router.delete('/:id', auth, phaseController.deletePhase);

module.exports = router;
