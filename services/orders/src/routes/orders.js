const express = require('express');
const { createOrder, getOrders } = require('../controllers/ordersController');
const router = express.Router();

function validateCreateOrder(req, res, next) {
	const { customerId, items } = req.body;
	if (!customerId || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'customerId and non-empty items array are required' });
	for (const it of items) {
		if (!it.productId || typeof it.quantity !== 'number') return res.status(400).json({ error: 'each item must have productId and numeric quantity' });
	}
	next();
}

router.post('/', validateCreateOrder, createOrder);
router.get('/', getOrders);

module.exports = router;
