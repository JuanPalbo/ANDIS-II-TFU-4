const express = require('express');
const { createProduct, getProducts, getProduct } = require('../controllers/productsController');
const router = express.Router();

function validateCreate(req, res, next) {
	const { name, price, stock } = req.body;
	if (!name || price == null || stock == null) return res.status(400).json({ error: 'name, price and stock are required' });
	next();
}

router.post('/', validateCreate, createProduct);
router.get('/', getProducts);
router.get('/:id', getProduct);

module.exports = router;
