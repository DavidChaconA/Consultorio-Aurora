const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(username, password) {
  const { status, data } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (status !== 200) throw new Error(`No se pudo iniciar sesión con ${username}. Ejecuta primero: npm run init-db && npm run seed`);
  return data.token;
}

function printSection(title) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

(async () => {
  printSection('Prueba de concurrencia: reserva simultánea de un mismo horario');
  console.log('Objetivo: demostrar que dos pacientes no pueden reservar la misma fecha y hora.');
  console.log('Mecanismo esperado: el backend usa lock distribuido por horario (tabla distributed_locks) y la base de datos tiene una restriccion UNIQUE para citas activas.');
  console.log(`Servidor usado: ${BASE}`);

  const tokenDavid = await login('david', 'david123');
  const tokenCristian = await login('cristian', 'cristian123');

  const now = new Date();
  const fecha = '2026-05-24';
  const hora = `${String(8 + (now.getSeconds() % 10)).padStart(2, '0')}:${String((now.getMinutes() + 5) % 60).padStart(2, '0')}`;

  printSection('Escenario');
  console.log(`Paciente 1: David intentará reservar ${fecha} a las ${hora}.`);
  console.log(`Paciente 2: Cristian intentará reservar ${fecha} a las ${hora}.`);
  console.log('Ambas solicitudes se enviarán al mismo tiempo con Promise.all().');

  const attempts = [
    {
      paciente: 'David',
      promise: request('/api/citas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenDavid}` },
        body: JSON.stringify({ fecha, hora })
      })
    },
    {
      paciente: 'Cristian',
      promise: request('/api/citas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenCristian}` },
        body: JSON.stringify({ fecha, hora })
      })
    }
  ];

  printSection('Ejecución');
  console.log('Enviando solicitudes concurrentes...');
  const rawResults = await Promise.all(attempts.map(a => a.promise));
  const results = rawResults.map((r, i) => ({ paciente: attempts[i].paciente, ...r }));
  const accepted = results.filter(r => r.status === 201);
  const rejected = results.filter(r => r.status === 409);

  printSection('Resultado');
  console.table(results.map((r, i) => ({
    intento: i + 1,
    paciente: r.paciente,
    status: r.status,
    resultado: r.status === 201 ? 'ACEPTADA' : r.status === 409 ? 'RECHAZADA' : 'OTRO',
    respuesta: JSON.stringify(r.data)
  })));

  if (accepted.length === 1 && rejected.length === 1) {
    console.log(`OK: solo se registró una cita para el horario ${fecha} ${hora}.`);
    console.log(`Cita aceptada para: ${accepted[0].paciente}. ID generado: ${accepted[0].data.id}.`);
    console.log(`Cita rechazada para: ${rejected[0].paciente}. Motivo: ${rejected[0].data.error}.`);
    console.log('\nPuedes verlo en la interfaz web:');
    console.log('1. Entra a http://localhost:3000');
    console.log('2. Inicia sesión como guillermo / guillermo123');
    console.log('3. Presiona "Cargar citas" y busca la fecha y hora mostradas arriba.');
    console.log('También lo puede ver el paciente que obtuvo la cita al iniciar sesión y cargar sus citas.');
    process.exit(0);
  }

  console.error('FALLO: el resultado esperado era exactamente 1 cita aceptada y 1 cita rechazada.');
  console.error('Revisa que hayas inicializado la base de datos y que el servidor esté corriendo.');
  process.exit(1);
})();
