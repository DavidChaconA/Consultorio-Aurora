const db = require('../src/db');

db.exec(`
DROP TABLE IF EXISTS clinical_records;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS distributed_locks;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('MEDICO', 'PACIENTE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  correo TEXT NOT NULL,
  telefono TEXT NOT NULL,
  edad INTEGER NOT NULL,
  sexo TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada')),
  creada_por_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (creada_por_user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_cita_horario_activo
ON appointments(fecha, hora)
WHERE estado = 'activa';

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mensaje TEXT NOT NULL,
  leida INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE distributed_locks (
  lock_key TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinical_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER NOT NULL,
  medico_user_id INTEGER NOT NULL,
  fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  temperatura_enc TEXT NOT NULL,
  peso_enc TEXT NOT NULL,
  altura_enc TEXT NOT NULL,
  presion_arterial_enc TEXT NOT NULL,
  diagnostico_enc TEXT NOT NULL,
  resultados_enc TEXT NOT NULL,
  prescripciones_enc TEXT NOT NULL,
  FOREIGN KEY (paciente_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_user_id) REFERENCES users(id)
);
`);

console.log('Base de datos inicializada correctamente.');
