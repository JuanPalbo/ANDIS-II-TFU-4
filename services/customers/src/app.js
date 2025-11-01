const express = require('express');
const mongoose = require('mongoose');
const customersRoutes = require('./routes/customers');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Customers DB connected'))
  .catch(err => console.error(err));

app.use('/customers', customersRoutes);

app.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Products Service running on port ${process.env.PORT}`);
});
