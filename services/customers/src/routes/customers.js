const express = require('express');
const { createCustomer } = require('../controllers/customersCommandController');
const { getCustomers } = require('../controllers/customersQueryController');
const router = express.Router();

function validateCreate(req, res, next) {
	const { name, email } = req.body;
	if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
	next();
}

router.post('/commands', validateCreate, createCustomer);
router.get('/queries', getCustomers);

module.exports = router;
