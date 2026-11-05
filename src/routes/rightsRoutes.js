const router = require('express').Router();
const controller = require('../controllers/rightsController');
router.post('/', controller.createRight);
router.get('/', controller.listRights);
router.get('/:id', controller.getRight);
router.put('/:id', controller.updateRight);
router.delete('/:id', controller.deleteRight);
module.exports = router;
