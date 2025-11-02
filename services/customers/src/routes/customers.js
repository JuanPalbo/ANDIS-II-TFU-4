const express = require('express');
const { createCustomer, getCustomers, getCustomer } = require('../controllers/customersController');
const router = express.Router();

router.post('/', createCustomer);
router.get('/', getCustomers);
router.get('/:id', getCustomer);

module.exports = router;
