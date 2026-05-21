const express = require('express');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const locks = require('./lockManager');
const { encrypt, decrypt } = require('./cryptoUtil');
const { hashPassword, verifyPassword, signToken, requireAuth, requireRole } = require('./auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const TEST_DELAY_MS = Number(process.env.TEST_DELAY_MS || 0);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTimeValue(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function getPatientByUserId(userId) {
  return db.prepare('SELECT * FROM patients WHERE user_id = ? AND activo = 1').get(userId);
}

function canAccessPatient(user, patientId) {
  if (user.rol === 'MEDICO') return true;
  const patient = getPatientByUserId(user.id);
  return patient && Number(patient.id) === Number(patientId);
}

function addNotification(userId, mensaje) {
  db.prepare('INSERT INTO notifications(user_id, mensaje) VALUES (?, ?)').run(userId, mensaje);
}

function publicPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    nombre: row.nombre,
    direccion: row.direccion,
    correo: row.correo,
    telefono: row.telefono,
    edad: row.edad,
    sexo: row.sexo
  };
}

app.post('/api/auth/register', (req, res) => {
  const { username, password, nombre, direccion, correo, telefono, edad, sexo } = req.body;
  if (!username || !password || !nombre || !direccion || !correo || !telefono || !edad || !sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const trx = db.transaction(() => {
    const userResult = db.prepare('INSERT INTO users(username, password_hash, rol) VALUES (?, ?, ?)')
      .run(username, hashPassword(password), 'PACIENTE');
    const userId = userResult.lastInsertRowid;
    const patientResult = db.prepare(`
      INSERT INTO patients(user_id, nombre, direccion, correo, telefono, edad, sexo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, nombre, direccion, correo, telefono, edad, sexo);
    return { userId, patientId: patientResult.lastInsertRowid };
  });

  try {
    const result = trx();
    res.status(201).json({ message: 'Paciente registrado', ...result });
  } catch (err) {
    res.status(409).json({ error: 'El nombre de usuario ya existe' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const patient = user.rol === 'PACIENTE' ? getPatientByUserId(user.id) : null;
  const token = signToken({ id: user.id, username: user.username, rol: user.rol, patientId: patient?.id || null });
  res.json({ token, user: { id: user.id, username: user.username, rol: user.rol, patientId: patient?.id || null } });
});

app.get('/api/me', requireAuth, (req, res) => {
  const patient = req.user.rol === 'PACIENTE' ? getPatientByUserId(req.user.id) : null;
  res.json({ user: req.user, patient: publicPatient(patient) });
});

app.get('/api/pacientes', requireAuth, requireRole('MEDICO'), (req, res) => {
  const rows = db.prepare('SELECT * FROM patients WHERE activo = 1 ORDER BY nombre').all();
  res.json(rows.map(publicPatient));
});

app.get('/api/pacientes/:id', requireAuth, (req, res) => {
  if (!canAccessPatient(req.user, req.params.id)) return res.status(403).json({ error: 'No autorizado' });
  const row = db.prepare('SELECT * FROM patients WHERE id = ? AND activo = 1').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json(publicPatient(row));
});

app.put('/api/pacientes/:id', requireAuth, (req, res) => {
  if (!canAccessPatient(req.user, req.params.id)) return res.status(403).json({ error: 'No autorizado' });
  const { nombre, direccion, correo, telefono, edad, sexo } = req.body;
  const result = db.prepare(`
    UPDATE patients
    SET nombre = COALESCE(?, nombre), direccion = COALESCE(?, direccion), correo = COALESCE(?, correo),
        telefono = COALESCE(?, telefono), edad = COALESCE(?, edad), sexo = COALESCE(?, sexo)
    WHERE id = ? AND activo = 1
  `).run(nombre, direccion, correo, telefono, edad, sexo, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json({ message: 'Paciente actualizado' });
});

app.delete('/api/pacientes/:id', requireAuth, (req, res) => {
  if (!canAccessPatient(req.user, req.params.id)) return res.status(403).json({ error: 'No autorizado' });
  const result = db.prepare('UPDATE patients SET activo = 0 WHERE id = ? AND activo = 1').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.json({ message: 'Paciente eliminado lógicamente' });
});

app.post('/api/citas', requireAuth, async (req, res) => {
  const fecha = String(req.body.fecha || '').trim();
  const hora = String(req.body.hora || '').trim();
  let pacienteId = req.body.paciente_id;

  if (!fecha || !hora) return res.status(400).json({ error: 'Fecha y hora son obligatorias' });
  if (!isValidDateValue(fecha) || !isValidTimeValue(hora)) {
    return res.status(400).json({ error: 'Formato de fecha u hora invÃ¡lido' });
  }

  if (req.user.rol === 'PACIENTE') {
    const patient = getPatientByUserId(req.user.id);
    pacienteId = patient?.id;
  }

  if (!pacienteId) return res.status(400).json({ error: 'Paciente obligatorio' });
  if (!canAccessPatient(req.user, pacienteId)) return res.status(403).json({ error: 'No autorizado' });

  const lockKey = `cita:${fecha}:${hora}`;
  const release = await locks.acquire(lockKey);
  try {
    if (TEST_DELAY_MS) await sleep(TEST_DELAY_MS);
    const existing = db.prepare('SELECT id FROM appointments WHERE fecha = ? AND hora = ? AND estado = ?')
      .get(fecha, hora, 'activa');
    if (existing) return res.status(409).json({ error: 'Horario no disponible' });

    const result = db.prepare(`
      INSERT INTO appointments(paciente_id, fecha, hora, estado, creada_por_user_id)
      VALUES (?, ?, ?, 'activa', ?)
    `).run(pacienteId, fecha, hora, req.user.id);

    const patient = db.prepare('SELECT user_id, nombre FROM patients WHERE id = ?').get(pacienteId);
    if (req.user.rol === 'MEDICO' && patient) {
      addNotification(patient.user_id, `El médico registró una cita para ti el ${fecha} a las ${hora}.`);
    }

    res.status(201).json({ message: 'Cita registrada', id: result.lastInsertRowid });
  } catch (err) {
    res.status(409).json({ error: 'No se pudo registrar la cita. Puede que el horario ya esté ocupado.' });
  } finally {
    release();
  }
});

app.get('/api/citas', requireAuth, (req, res) => {
  let rows;
  if (req.user.rol === 'MEDICO') {
    rows = db.prepare(`
      SELECT a.*, p.nombre AS paciente_nombre
      FROM appointments a
      JOIN patients p ON p.id = a.paciente_id
      WHERE p.activo = 1
      ORDER BY a.fecha, a.hora
    `).all();
  } else {
    const patient = getPatientByUserId(req.user.id);
    rows = db.prepare(`
      SELECT a.*, p.nombre AS paciente_nombre
      FROM appointments a
      JOIN patients p ON p.id = a.paciente_id
      WHERE a.paciente_id = ?
      ORDER BY a.fecha, a.hora
    `).all(patient?.id || 0);
  }
  res.json(rows);
});

app.put('/api/citas/:id', requireAuth, async (req, res) => {
  const cita = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
  if (!canAccessPatient(req.user, cita.paciente_id)) return res.status(403).json({ error: 'No autorizado' });

  const nuevaFecha = req.body.fecha || cita.fecha;
  const nuevaHora = req.body.hora || cita.hora;
  const nuevoEstado = req.body.estado || cita.estado;
  if (!isValidDateValue(nuevaFecha) || !isValidTimeValue(nuevaHora)) {
    return res.status(400).json({ error: 'Formato de fecha u hora invÃ¡lido' });
  }
  const lockKey = `cita:${nuevaFecha}:${nuevaHora}`;
  let release = () => {};

  try {
    release = await locks.acquire(lockKey);
    if (nuevoEstado === 'activa' && (nuevaFecha !== cita.fecha || nuevaHora !== cita.hora)) {
      const existing = db.prepare('SELECT id FROM appointments WHERE fecha = ? AND hora = ? AND estado = ? AND id <> ?')
        .get(nuevaFecha, nuevaHora, 'activa', cita.id);
      if (existing) return res.status(409).json({ error: 'Horario no disponible' });
    }

    db.prepare(`
      UPDATE appointments
      SET fecha = ?, hora = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nuevaFecha, nuevaHora, nuevoEstado, cita.id);

    if (req.user.rol === 'MEDICO') {
      const patient = db.prepare('SELECT user_id FROM patients WHERE id = ?').get(cita.paciente_id);
      if (patient) addNotification(patient.user_id, `El médico modificó tu cita. Nueva fecha: ${nuevaFecha}, hora: ${nuevaHora}.`);
    }
    res.json({ message: 'Cita actualizada' });
  } catch (err) {
    res.status(409).json({ error: 'No se pudo actualizar la cita. Puede que el horario ya estÃ© ocupado.' });
  } finally {
    release();
  }
});

app.delete('/api/citas/:id', requireAuth, (req, res) => {
  const cita = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
  if (!canAccessPatient(req.user, cita.paciente_id)) return res.status(403).json({ error: 'No autorizado' });

  db.prepare('UPDATE appointments SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('cancelada', cita.id);

  if (req.user.rol === 'MEDICO') {
    const patient = db.prepare('SELECT user_id FROM patients WHERE id = ?').get(cita.paciente_id);
    if (patient) addNotification(patient.user_id, `El médico canceló tu cita del ${cita.fecha} a las ${cita.hora}.`);
  }
  res.json({ message: 'Cita cancelada' });
});

app.post('/api/historial', requireAuth, requireRole('MEDICO'), (req, res) => {
  const { paciente_id, temperatura, peso, altura, presion_arterial, diagnostico, resultados, prescripciones } = req.body;
  if (!paciente_id || !temperatura || !peso || !altura || !presion_arterial || !diagnostico) {
    return res.status(400).json({ error: 'Faltan datos clínicos obligatorios' });
  }

  const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND activo = 1').get(paciente_id);
  if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

  const result = db.prepare(`
    INSERT INTO clinical_records(
      paciente_id, medico_user_id, temperatura_enc, peso_enc, altura_enc, presion_arterial_enc,
      diagnostico_enc, resultados_enc, prescripciones_enc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    paciente_id,
    req.user.id,
    encrypt(temperatura),
    encrypt(peso),
    encrypt(altura),
    encrypt(presion_arterial),
    encrypt(diagnostico),
    encrypt(resultados || ''),
    encrypt(prescripciones || '')
  );

  addNotification(patient.user_id, 'Se agregó un nuevo registro a tu historial clínico.');
  res.status(201).json({ message: 'Historial clínico registrado', id: result.lastInsertRowid });
});

app.get('/api/historial/paciente/:id', requireAuth, (req, res) => {
  if (!canAccessPatient(req.user, req.params.id)) return res.status(403).json({ error: 'No autorizado' });

  const records = db.prepare(`
    SELECT cr.*, p.nombre AS paciente_nombre, u.username AS medico_username
    FROM clinical_records cr
    JOIN patients p ON p.id = cr.paciente_id
    JOIN users u ON u.id = cr.medico_user_id
    WHERE cr.paciente_id = ?
    ORDER BY cr.fecha DESC, cr.id DESC
  `).all(req.params.id);

  res.json(records.map(r => ({
    id: r.id,
    paciente_id: r.paciente_id,
    paciente_nombre: r.paciente_nombre,
    medico: r.medico_username,
    fecha: r.fecha,
    temperatura: decrypt(r.temperatura_enc),
    peso: decrypt(r.peso_enc),
    altura: decrypt(r.altura_enc),
    presion_arterial: decrypt(r.presion_arterial_enc),
    diagnostico: decrypt(r.diagnostico_enc),
    resultados: decrypt(r.resultados_enc),
    prescripciones: decrypt(r.prescripciones_enc)
  })));
});

app.get('/api/reportes/pacientes', requireAuth, requireRole('MEDICO'), (req, res) => {
  const rows = db.prepare('SELECT id, nombre, correo, telefono, edad, sexo FROM patients WHERE activo = 1 ORDER BY nombre').all();
  res.json({ titulo: 'Lista de pacientes', pacientes: rows });
});

app.get('/api/reportes/calendario', requireAuth, requireRole('MEDICO'), (req, res) => {
  const rows = db.prepare(`
    SELECT a.fecha, a.hora, a.estado, p.nombre AS paciente
    FROM appointments a
    JOIN patients p ON p.id = a.paciente_id
    WHERE p.activo = 1
    ORDER BY a.fecha, a.hora
  `).all();
  res.json({ titulo: 'Calendario de citas', citas: rows });
});

app.get('/api/reportes/historial/:pacienteId', requireAuth, (req, res) => {
  if (!canAccessPatient(req.user, req.params.pacienteId)) return res.status(403).json({ error: 'No autorizado' });
  const paciente = db.prepare('SELECT id, nombre, direccion, correo, telefono, edad, sexo FROM patients WHERE id = ? AND activo = 1')
    .get(req.params.pacienteId);
  if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

  const records = db.prepare('SELECT * FROM clinical_records WHERE paciente_id = ? ORDER BY fecha DESC, id DESC')
    .all(req.params.pacienteId)
    .map(r => ({
      fecha: r.fecha,
      temperatura: decrypt(r.temperatura_enc),
      peso: decrypt(r.peso_enc),
      altura: decrypt(r.altura_enc),
      presion_arterial: decrypt(r.presion_arterial_enc),
      diagnostico: decrypt(r.diagnostico_enc),
      resultados: decrypt(r.resultados_enc),
      prescripciones: decrypt(r.prescripciones_enc)
    }));

  res.json({ titulo: 'Historial clínico', encabezado: paciente, cuerpo: records });
});

app.get('/api/notificaciones', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

app.put('/api/notificaciones/:id/leida', requireAuth, (req, res) => {
  const result = db.prepare('UPDATE notifications SET leida = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
  res.json({ message: 'Notificación marcada como leída' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Sistema del consultorio disponible en http://localhost:${PORT}`);
});
