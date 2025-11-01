const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  customerId: { type: String, required: true },
  items: [
    {
      productId: String,
      quantity: Number,
      price: Number
    }
  ],
  total: { type: Number, required: true }
});

module.exports = mongoose.model('Order', OrderSchema);
