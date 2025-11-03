const Order = require('../models/Order');
const axiosRetry = require('axios-retry');
const { createAxiosConCB } = require('../lib/circuitBreaker');

// Clientes axios con breaker y reintentos (todo por env, sin parámetros)
const { client: httpCustomers } = createAxiosConCB();
const { client: httpProducts } = createAxiosConCB();

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

exports.createOrder = async (req, res) => {
  try {
    const { customerId, items } = req.body;

  const customerRes = await httpCustomers.get(`${process.env.CUSTOMERS_SERVICE_URL || 'http://localhost:3002'}/customers/${customerId}`);
    if (!customerRes.data) return res.status(404).json({ error: 'Customer not found' });

    let total = 0;
    for (const item of items) {
  const productRes = await httpProducts.get(`${process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3001'}/products/${item.productId}`);
      if (!productRes.data) return res.status(404).json({ error: 'Product not found' });
      total += (productRes.data.price || 0) * item.quantity;
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
