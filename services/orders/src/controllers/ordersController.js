// Backward-compatible combined controller: re-export separate command/query controllers
exports.createOrder = require('./ordersCommandController').createOrder;
exports.getOrders = require('./ordersQueryController').getOrders;
