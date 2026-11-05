const router = require('express').Router();
const controller = require('../controllers/exclusivityController');
router.post('/', controller.createExclusivity);
router.get('/', controller.listExclusivity);
router.get('/:id', controller.getExclusivity);
router.put('/:id', controller.updateExclusivity);
router.delete('/:id', controller.deleteExclusivity);
module.exports = router;
