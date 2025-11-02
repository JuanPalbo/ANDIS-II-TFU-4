const Order = require('../models/Order');
const axios = require('axios');
const { issueValetToken } = require('../utils/valet');

exports.createOrder = async (req, res) => {
  try {
    const { customerId, items } = req.body;

  // Llamar al servicio de Customers
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
