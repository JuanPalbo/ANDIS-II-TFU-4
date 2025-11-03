const axios = require('axios');

// Errores definidos a manopla para que sean reconocibles cuando lleguen a ordersControllers
class OpenCircuitError extends Error {
  constructor(message = 'Circuit open') {
    super(message);
    this.name = 'OpenCircuitError';
    this.code = 'CIRCUIT_OPEN';
  }
}

function createCircuitBreaker() {
  const failureThreshold = Number(process.env.CB_FAILURE_THRESHOLD || 3);
  const resetTimeout = Number(process.env.CB_RESET_TIMEOUT || 10000);

  const state = {
    status: 'closed',
    consecutiveFailures: 0,
    nextTry: 0,
    ProbeSent: false,
  };

  const now = () => Date.now();

  const open = () => {
    state.status = 'open';
    state.nextTry = now() + resetTimeout;
    state.consecutiveFailures = 0;
    state.ProbeSent = false;
  };

  const close = () => {
    state.status = 'closed';
    state.consecutiveFailures = 0;
    state.nextTry = 0;
    state.ProbeSent = false;
  };

  const halfOpen = () => {
    state.status = 'half-open';
    state.ProbeSent = false;
  };

  // acquirePermission controla si la petición puede salir según el estado del circuito
  // y devuelve un callback release(result) para notificar éxito o fallo al finalizar.
function acquirePermission() {
    const t = now();

    // Si está abierto y todavía no terminó el cooldown la rechazamos
    if (state.status === 'open') {
      if (t < state.nextTry) {
        throw new OpenCircuitError();
      }
      // Cuando termina el cooldown pasa a semi abierto
      halfOpen();
    }

    // Cuando está semi abierto dejamos pasar solo un probe a la vez
    if (state.status === 'half-open') {
      if (state.ProbeSent) throw new OpenCircuitError();
      state.ProbeSent = true;
    }

    let released = false;
    return (result) => {
      if (released) return; // evita doble liberación
      released = true;

      if (result === 'success') {
        // Si el éxito fue el probe en semi abierto cerramos el circuito
        if (state.status === 'half-open') { 
            close(); 
            return; 
        }
        // En cerrado solo reiniciamos el contador de fallos
        state.consecutiveFailures = 0; 
        return;
      }

      // Caso de fallo
      // Si el fallo fue el probe en semi abierto, se abre y arranca de nuevo el cooldown.
      if (state.status === 'half-open') { 
        open();
        return; 
    }
      // En cerrado incrementamos fallos consecutivos y se abre el CB si se pasan del threshold.
      state.consecutiveFailures += 1;
      if (state.consecutiveFailures >= failureThreshold) open();
    };
  }

  return { acquirePermission };
}

function createAxiosConCB() {
  const breaker = createCircuitBreaker();
  const client = axios.create({
    timeout: Number(process.env.HTTP_TIMEOUT || 3000),
  });
  client.interceptors.request.use((config) => {
    const release = breaker.acquirePermission();
    config.__cbRelease = release;
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      const release = response.config && response.config.__cbRelease; if (release) release('success');
      return response;
    },
    (error) => {
      const cfg = error.config || {}; const release = cfg.__cbRelease; if (release) release('failure');
      return Promise.reject(error);
    }
  );
  return { client };
}

module.exports = { OpenCircuitError, createCircuitBreaker, createAxiosConCB };
