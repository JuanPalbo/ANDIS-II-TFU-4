const jwt = require('jsonwebtoken');
const redis = require('../lib/redisClient');

const SECRET = process.env.VALET_SECRET || 'change-this-secret';

async function verifyValetToken(req, res, next) {
  try {
    const auth = req.headers.authorization;
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || null);
    if (!token) return res.status(401).json({ error: 'No token' });

    const payload = jwt.verify(token, SECRET);

    if (payload.scope !== 'order:view') return res.status(403).json({ error: 'Invalid scope' });
    if (payload.orderId !== req.params.id) return res.status(403).json({ error: 'Token not for this order' });

  // comprobar que el jti existe en redis (revocación / TTL)
  const exists = await redis.get(`valet:${payload.jti}`);
    if (!exists) return res.status(410).json({ error: 'Token revoked or expired' });

  // adjuntar payload para handlers posteriores
    req.valet = payload;
    next();
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') return res.status(410).json({ error: 'Token expired' });
    console.error('Valet token verify error', err && err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = verifyValetToken;
