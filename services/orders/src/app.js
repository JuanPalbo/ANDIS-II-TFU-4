const express = require('express');
const mongoose = require('mongoose');
const ordersRoutes = require('./routes/orders');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Orders DB connected'))
  .catch(err => console.error(err));

app.use('/orders', ordersRoutes);

app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Products Service running on port ${process.env.PORT}`);
});
