const router = require('express').Router();
const controller = require('../controllers/brandController');
router.post('/', controller.createBrand);
router.get('/', controller.listBrands);
router.get('/:id', controller.getBrand);
module.exports = router;
