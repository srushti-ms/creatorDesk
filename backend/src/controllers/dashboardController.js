const { asyncHandler, sendDbError } = require('./helpers');
const { getRightsRadarData } = require('../services/rightsRadarService');

exports.getRightsRadar = asyncHandler(async (_req, res) => {
  try {
    return res.json(await getRightsRadarData());
  } catch (error) {
    return sendDbError(error, res, 'Rights Radar dashboard');
  }
});
