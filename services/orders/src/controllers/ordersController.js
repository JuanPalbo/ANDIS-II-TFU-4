const Order = require('../models/Order');
const axios = require('axios');

exports.createOrder = async (req, res) => {
  try {
    const { customerId, items } = req.body;

    // Call Customers Service
    const customerRes = await axios.get(`${process.env.CUSTOMERS_SERVICE_URL || 'http://localhost:3002'}/customers/${customerId}`);
    if (!customerRes.data) return res.status(404).json({ error: 'Customer not found' });

    let total = 0;
    for (const item of items) {
      const productRes = await axios.get(`${process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3001'}/products/${item.productId}`);
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
