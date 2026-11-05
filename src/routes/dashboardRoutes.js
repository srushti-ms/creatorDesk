const router = require('express').Router();
const controller = require('../controllers/dashboardController');

router.get('/rights-radar', controller.getRightsRadar);

module.exports = router;
