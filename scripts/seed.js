const db = require('../src/db');
const { hashPassword } = require('../src/auth');

function createUser(username, password, rol) {
  const result = db.prepare('INSERT INTO users(username, password_hash, rol) VALUES (?, ?, ?)')
    .run(username, hashPassword(password), rol);
  return result.lastInsertRowid;
}

function createPatient(userId, nombre, direccion, correo, telefono, edad, sexo) {
  return db.prepare(`
    INSERT INTO patients(user_id, nombre, direccion, correo, telefono, edad, sexo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, nombre, direccion, correo, telefono, edad, sexo).lastInsertRowid;
}

try {
  const guillermoId = createUser('guillermo', 'guillermo123', 'MEDICO');
  const davidUser = createUser('david', 'david123', 'PACIENTE');
  const cristianUser = createUser('cristian', 'cristian123', 'PACIENTE');

  createPatient(davidUser, 'David Chacón', 'Mérida, Yucatán', 'david@example.com', '9991000001', 21, 'Masculino');
  createPatient(cristianUser, 'Cristian Ramírez', 'Mérida, Yucatán', 'cristian@example.com', '9991000002', 22, 'Masculino');

  db.prepare('INSERT INTO notifications(user_id, mensaje) VALUES (?, ?)')
    .run(guillermoId, 'Bienvenido al sistema del consultorio.');

  console.log('Datos de prueba insertados.');
  console.log('Médico: guillermo / guillermo123');
  console.log('Paciente 1: david / david123');
  console.log('Paciente 2: cristian / cristian123');
} catch (err) {
  console.error('No se pudo insertar seed. Tal vez ya existen usuarios:', err.message);
}
