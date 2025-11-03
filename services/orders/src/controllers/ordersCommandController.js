const Order = require('../models/Order');
const axiosRetry = require('axios-retry');
const { createAxiosWithBreaker } = require('../lib/circuitBreaker');
const { Cache } = require('../lib/cache');

// Clientes axios con breaker y reintentos (todo por env, sin parámetros)
const { client: httpCustomers } = createAxiosWithBreaker();
const { client: httpProducts } = createAxiosWithBreaker();

axiosRetry(httpCustomers, {
  retries: Number(process.env.HTTP_RETRIES || 2),
  retryDelay: axiosRetry.exponentialDelay,
  shouldResetTimeout: true,
  retryCondition: (error) => {
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
