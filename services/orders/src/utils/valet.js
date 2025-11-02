const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const redis = require('../lib/redisClient');

const SECRET = process.env.VALET_SECRET || 'change-this-secret';
const TTL_SECONDS = parseInt(process.env.VALET_TTL_SECONDS || '600', 10); // por defecto 10 minutos

async function issueValetToken(orderId, opts = {}) {
  const jti = uuidv4();
  const payload = {
    orderId,
    scope: 'order:view',
    jti,
  };

  const token = jwt.sign(payload, SECRET, { expiresIn: `${TTL_SECONDS}s` });

  // Almacenar jti en Redis para permitir revocación / uso único
  try {
    await redis.set(`valet:${jti}`, '1', 'EX', TTL_SECONDS);
  } catch (err) {
    console.error('Failed to persist valet token jti in redis', err);
    // continuar: el token sigue siendo válido por su firma pero la revocación no funcionará
  }

  return { token, jti, expiresIn: TTL_SECONDS };
}

module.exports = { issueValetToken };

// Verifica un token valet: firma, scope, orderId y existencia del jti en Redis.
// Si `consume` es true (por defecto), eliminará el jti de Redis para hacerlo de un solo uso.
async function verifyValetToken(token, orderId, opts = { consume: true }) {
  try {
    const payload = jwt.verify(token, SECRET);

    if (payload.scope !== 'order:view') {
      const e = new Error('Invalid scope');
      e.status = 403;
      throw e;
    }
    if (payload.orderId !== orderId) {
      const e = new Error('Token not for this order');
      e.status = 403;
      throw e;
    }

    const key = `valet:${payload.jti}`;
    const exists = await redis.get(key);
    if (!exists) {
      const e = new Error('Token revoked or expired');
      e.status = 410;
      throw e;
    }

    if (opts.consume) {
      try {
        await redis.del(key);
      } catch (err) {
        // no bloquear si falla el borrado, el token aún se considera válido
        console.error('Failed to delete valet jti from redis', err);
      }
    }

    return payload;
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      const e = new Error('Token expired');
      e.status = 410;
      throw e;
    }
    if (err && err.status) throw err;
    const e = new Error('Invalid token');
    e.status = 401;
    throw e;
  }
}

module.exports = { issueValetToken, verifyValetToken };
