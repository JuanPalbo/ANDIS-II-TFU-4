const axios = require('axios');

const NGX = process.env.NGINX_URL || 'http://nginx';
const TIMEOUT = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForHealth(retries = 60) {
  const url = `${NGX}/healthz`;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { timeout: TIMEOUT });
      if (res.status === 200) return true;
    } catch (err) {
      // ignorar
    }
    await sleep(1000);
  }
  throw new Error('Timeout waiting for healthz');
}

async function runDemo() {
  console.log('valet-demo: waiting for services (nginx /healthz)');
  await waitForHealth();
  console.log('valet-demo: services up, running demo flow');

  // create product
  const prodRes = await axios.post(`${NGX}/products`, {
    name: 'Demo Product', price: 9, stock: 100
  }, { timeout: 5000 });
  const productId = prodRes.data._id;
  console.log('valet-demo: created product', productId);

  // create customer
  const custRes = await axios.post(`${NGX}/customers`, {
    name: 'Demo Customer', email: `demo+${Date.now()}@example.com`
  }, { timeout: 5000 });
  const customerId = custRes.data._id;
  console.log('valet-demo: created customer', customerId);

  // create order
  const orderRes = await axios.post(`${NGX}/orders`, {
    customerId,
    items: [{ productId, quantity: 2 }]
  }, { timeout: 10000 });
  const orderId = orderRes.data._id;
  console.log('valet-demo: created order', orderId);

  // request valet token
  const valetRes = await axios.post(`${NGX}/orders/${orderId}/valet`, { customerId }, { timeout: 5000 });
  const { token, url, expiresIn } = valetRes.data;
  console.log('valet-demo: issued valet token', token);
  console.log('valet-demo: url', url, 'expiresIn(s):', expiresIn);

  // use the token to GET the order
  const getRes = await axios.get(`${NGX}/orders/${orderId}?token=${encodeURIComponent(token)}`, { timeout: 5000 });
  console.log('valet-demo: GET order with token succeeded, order total:', getRes.data.total);

  console.log('valet-demo: demo finished successfully');
}

runDemo().catch(err => {
  console.error('valet-demo: demo failed:', err && err.message);
  process.exit(1);
});
