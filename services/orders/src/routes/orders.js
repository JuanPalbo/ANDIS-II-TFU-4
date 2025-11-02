const express = require('express');
const { createOrder, getOrders, getOrder, createValet } = require('../controllers/ordersController');
const verifyValetToken = require('../middleware/valetMiddleware');
const router = express.Router();

router.post('/', createOrder);

// Create / list
router.get('/', getOrders);

// Leer orden individual (soporta token valet via Authorization Bearer o ?token=...)
router.get('/:id', (req, res, next) => {
	// si se proporciona token via header o query param, verificarlo
	if (req.headers.authorization || req.query.token) {
		return verifyValetToken(req, res, () => getOrder(req, res));
	}
	// de lo contrario proceder al handler normal (se asume que habrá otra autenticación)
	return getOrder(req, res);
});

// Emitir un token valet para esta orden (el llamante debe probar la propiedad via body.customerId por ahora)
router.post('/:id/valet', createValet);

module.exports = router;
