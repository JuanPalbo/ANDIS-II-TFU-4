// Backward-compatible combined controller: re-export separate command/query controllers
exports.createProduct = require('./productsCommandController').createProduct;
exports.getProducts = require('./productsQueryController').getProducts;
exports.getProduct = require('./productsQueryController').getProduct;
