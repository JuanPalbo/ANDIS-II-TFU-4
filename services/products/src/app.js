const express = require('express');
const mongoose = require('mongoose');
const productsRoutes = require('./routes/products');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Products DB connected'))
  .catch(err => console.error(err));

app.use('/products', productsRoutes);

app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Products Service running on port ${process.env.PORT}`);
});