
// Backward-compatible combined controller: re-export separate command/query controllers
exports.createCustomer = require('./customersCommandController').createCustomer;
exports.getCustomers = require('./customersQueryController').getCustomers;
