const router = require('express').Router();
const controller = require('../controllers/collaborationController');
router.post('/', controller.createCollaboration);
router.get('/', controller.listCollaborations);
router.get('/:id', controller.getCollaboration);
module.exports = router;
