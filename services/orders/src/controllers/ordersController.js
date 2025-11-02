const Order = require('../models/Order');
const axios = require('axios');
const axiosRetry = require('axios-retry');

// Create a dedicated axios client with retry + timeout
const http = axios.create({
  timeout: Number(process.env.HTTP_TIMEOUT || 3000),
});

axiosRetry(http, {
  retries: Number(process.env.HTTP_RETRIES || 2),
  retryDelay: axiosRetry.exponentialDelay,
  shouldResetTimeout: true,
  retryCondition: (error) => {
    // Retry on network errors, timeouts and idempotent 5xx
    return axiosRetry.isNetworkError(error)
      || axiosRetry.isRetryableError(error)
      || (error.response && error.response.status >= 500);
  },
});

exports.createOrder = async (req, res) => {
  try {
    const { customerId, items } = req.body;

  const customerRes = await http.get(`${process.env.CUSTOMERS_SERVICE_URL || 'http://localhost:3002'}/customers/${customerId}`);
    if (!customerRes.data) return res.status(404).json({ error: 'Customer not found' });

    let total = 0;
    for (const item of items) {
  const productRes = await http.get(`${process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3001'}/products/${item.productId}`);
      if (!productRes.data) return res.status(404).json({ error: 'Product not found' });
      total += (productRes.data.price || 0) * item.quantity;
    }

    const order = new Order({ customerId, items, total });
    await order.save();

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrders = async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
};
