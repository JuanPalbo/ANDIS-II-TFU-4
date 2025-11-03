const Order = require('../models/Order');
const axios = require('axios');
const { issueValetToken } = require('../utils/valet')
const axiosRetry = require('axios-retry');
const { createAxiosWithBreaker } = require('../lib/circuitBreaker');


// Clientes axios con breaker y reintentos (todo por env, sin parámetros)
const { client: httpCustomers } = createAxiosWithBreaker();
const { client: httpProducts } = createAxiosWithBreaker();

axiosRetry(httpCustomers, {
  retries: Number(process.env.HTTP_RETRIES || 2),
  retryDelay: axiosRetry.exponentialDelay,
  shouldResetTimeout: true,
  retryCondition: (error) => {
    // Reintentos en errores de red o respuestas 5xx
    return axiosRetry.isNetworkError(error)
      || axiosRetry.isRetryableError(error)
      || (error.response && error.response.status >= 500);
  },
});

axiosRetry(httpProducts, {
  retries: Number(process.env.HTTP_RETRIES || 2),
  retryDelay: axiosRetry.exponentialDelay,
  shouldResetTimeout: true,
  retryCondition: (error) => {
    return axiosRetry.isNetworkError(error)
      || axiosRetry.isRetryableError(error)
      || (error.response && error.response.status >= 500);
  },
});

// Cache-Aside para productos
const { Cache } = require('../lib/cache');
const productsCache = new Cache();
const PRODUCTS_CACHE_TTL_MS = Number(process.env.PRODUCTS_CACHE_TTL_MS || 30000); // 30s por defecto
exports.createOrder = async (req, res) => {
  try {
    const { customerId, items } = req.body;

  const customerRes = await httpCustomers.get(`${process.env.CUSTOMERS_SERVICE_URL || 'http://localhost:3002'}/customers/${customerId}`);
    if (!customerRes.data) return res.status(404).json({ error: 'Customer not found' });

    let total = 0;
    for (const item of items) {
      const cacheKey = `product:${item.productId}`;
      let product = productsCache.get(cacheKey);

      if (!product) {
        const productRes = await httpProducts.get(`${process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3001'}/products/${item.productId}`);
        if (!productRes.data) return res.status(404).json({ error: 'Product not found' });
        product = productRes.data;
        // Guardamos en caché
        productsCache.set(cacheKey, product, PRODUCTS_CACHE_TTL_MS);
      }

      total += (product.price || 0) * item.quantity;
    }

    const order = new Order({ customerId, items, total });
    await order.save();

    res.json(order);
  } catch (err) {
    if (err && (err.name === 'OpenCircuitError' || err.code === 'CIRCUIT_OPEN')) {
      return res.status(503).json({ error: 'Servicio no disponible' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getOrders = async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /orders/:id/valet
exports.createValet = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { customerId } = req.body || {};

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Comprobación de propiedad
    if (!customerId || String(order.customerId) !== String(customerId)) {
      return res.status(403).json({ error: 'Not allowed to issue valet for this order' });
    }

    const { token, expiresIn } = await issueValetToken(orderId);

  // Construir una URL que incluya el token como parámetro query (opcional)
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || '3003'}`;
  const url = `${publicUrl.replace(/\/$/, '')}/orders/${orderId}?token=${token}`;

  res.json({ token, url, expiresIn });
  } catch (err) {
    console.error('createValet error', err);
    res.status(500).json({ error: err.message });
  }
};
