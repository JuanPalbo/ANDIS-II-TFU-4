const express = require('express');
const { createCustomer, getCustomers } = require('../controllers/customersController');
const router = express.Router();

router.post('/', createCustomer);
router.get('/', getCustomers);

module.exports = router;
