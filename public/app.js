let token = localStorage.getItem('token');
let currentUser = null;
let currentPatient = null;
let cachedPatients = [];

const $ = selector => document.querySelector(selector);

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

function formToJson(form) {
  const data = new FormData(form);
  const obj = {};
  for (const [k, v] of data.entries()) {
    if (v !== '') obj[k] = v;
  }
  return obj;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function formatDate(dateText) {
  const [year, month, day] = String(dateText || '').split('-');
  if (!year || !month || !day) return escapeHtml(dateText || '');
  return `${day}/${month}/${year}`;
}

function formatParagraph(value, emptyLabel = 'Sin registro') {
  const text = String(value ?? '').trim();
  if (!text) return `<span class="hint">${emptyLabel}</span>`;
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function getHistoryTargetPatientId() {
  let patientId = currentPatient?.id;
  if (currentUser?.rol === 'MEDICO') patientId = $('#historyPatientSelect')?.value;
  return patientId;
}

function renderHistoryControls() {
  if (!currentUser) return;
  if (currentUser.rol === 'MEDICO') {
    const options = cachedPatients.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
    $('#historyControls').innerHTML = options
      ? `<label class="history-filter">Paciente <select id="historyPatientSelect">${options}</select></label>`
      : '<p class="hint">No hay pacientes disponibles.</p>';
    return;
  }

  const patientName = currentPatient?.nombre || currentUser.username || 'Paciente';
  $('#historyControls').innerHTML = `<p class="hint">Mostrando historial de ${escapeHtml(patientName)}.</p>`;
}

function renderHistory(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    $('#history').innerHTML = '<p class="hint">No hay registros clinicos para mostrar.</p>';
    return;
  }

  const sortedRows = [...rows].sort((a, b) => {
    const byDate = String(b.fecha || '').localeCompare(String(a.fecha || ''));
    if (byDate !== 0) return byDate;
    return Number(b.id || 0) - Number(a.id || 0);
  });

  $('#history').innerHTML = sortedRows.map((row, index) => `
    <article class="history-card">
      <div class="history-card-top">
        <p class="history-card-title">Consulta ${index + 1}</p>
        <p class="history-card-meta">Paciente: ${escapeHtml(row.paciente_nombre)} | Medico: ${escapeHtml(row.medico)} | Fecha: ${formatDate(row.fecha)}</p>
      </div>

      <div class="history-metrics">
        <div><span class="history-label">Temperatura</span><strong>${escapeHtml(row.temperatura)}</strong></div>
        <div><span class="history-label">Peso</span><strong>${escapeHtml(row.peso)}</strong></div>
        <div><span class="history-label">Altura</span><strong>${escapeHtml(row.altura)}</strong></div>
        <div><span class="history-label">Presion arterial</span><strong>${escapeHtml(row.presion_arterial)}</strong></div>
      </div>

      <div class="history-block">
        <h4>Diagnostico</h4>
        <p>${formatParagraph(row.diagnostico)}</p>
      </div>

      <div class="history-block">
        <h4>Resultados de analisis</h4>
        <p>${formatParagraph(row.resultados)}</p>
      </div>

      <div class="history-block">
        <h4>Prescripciones</h4>
        <p>${formatParagraph(row.prescripciones)}</p>
      </div>
    </article>
  `).join('');
}

function renderHistoryReport(report) {
  const header = report?.encabezado;
  const body = Array.isArray(report?.cuerpo) ? report.cuerpo : [];

  if (!header) {
    $('#history').innerHTML = '<p class="hint">No se pudo generar el reporte.</p>';
    return;
  }

  const headerHtml = `
    <section class="history-report">
      <h3>Encabezado del paciente</h3>
      <p><strong>Nombre:</strong> ${escapeHtml(header.nombre)}</p>
      <p><strong>Direccion:</strong> ${escapeHtml(header.direccion)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(header.correo)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(header.telefono)}</p>
      <p><strong>Edad:</strong> ${escapeHtml(header.edad)}</p>
      <p><strong>Sexo:</strong> ${escapeHtml(header.sexo)}</p>
    </section>
  `;

  if (body.length === 0) {
    $('#history').innerHTML = `${headerHtml}<p class="hint">No hay consultas en el cuerpo del reporte.</p>`;
    return;
  }

  const bodyHtml = body.map((row, index) => `
    <article class="history-card">
      <div class="history-card-top">
        <p class="history-card-title">Consulta ${index + 1}</p>
        <p class="history-card-meta">Fecha: ${formatDate(row.fecha)}</p>
      </div>
      <div class="history-metrics">
        <div><span class="history-label">Temperatura</span><strong>${escapeHtml(row.temperatura)}</strong></div>
        <div><span class="history-label">Peso</span><strong>${escapeHtml(row.peso)}</strong></div>
        <div><span class="history-label">Altura</span><strong>${escapeHtml(row.altura)}</strong></div>
        <div><span class="history-label">Presion arterial</span><strong>${escapeHtml(row.presion_arterial)}</strong></div>
      </div>
      <div class="history-block">
        <h4>Diagnostico</h4>
        <p>${formatParagraph(row.diagnostico)}</p>
      </div>
      <div class="history-block">
        <h4>Resultados de analisis</h4>
        <p>${formatParagraph(row.resultados)}</p>
      </div>
      <div class="history-block">
        <h4>Prescripciones</h4>
        <p>${formatParagraph(row.prescripciones)}</p>
      </div>
    </article>
  `).join('');

  $('#history').innerHTML = headerHtml + bodyHtml;
}

function setSession(data) {
  token = data.token;
  currentUser = data.user;
  localStorage.setItem('token', token);
  showApp();
}

async function showApp() {
  try {
    const data = await api('/api/me');
    currentUser = data.user;
    currentPatient = data.patient;
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#welcome').textContent = `Bienvenido, ${currentUser.username}`;
    $('#role').textContent = `Rol: ${currentUser.rol}`;

    $('#doctorPanel').classList.toggle('hidden', currentUser.rol !== 'MEDICO');
    $('#patientPanel').classList.toggle('hidden', currentUser.rol !== 'PACIENTE');
    renderHistoryControls();

    if (currentUser.rol === 'MEDICO') await loadPatients();
    if (currentUser.rol === 'PACIENTE' && currentPatient) fillMyPatientForm();
    await loadAppointments();
    await loadNotifications();
  } catch (err) {
    logout();
  }
}

function logout() {
  token = null;
  currentUser = null;
  currentPatient = null;
  cachedPatients = [];
  localStorage.removeItem('token');
  $('#auth').classList.remove('hidden');
  $('#app').classList.add('hidden');
  $('#historyControls').innerHTML = '';
  $('#history').innerHTML = '';
}

function fillMyPatientForm() {
  const form = $('#myPatientForm');
  for (const key of ['nombre', 'direccion', 'correo', 'telefono', 'edad', 'sexo']) {
    form.elements[key].value = currentPatient[key] || '';
  }
}

async function loadPatients() {
  if (currentUser.rol !== 'MEDICO') return;
  cachedPatients = await api('/api/pacientes');
  const options = cachedPatients.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  $('#doctorPatientSelect').innerHTML = options;
  $('#clinicalPatientSelect').innerHTML = options;
  renderHistoryControls();

  $('#patientsTable').innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Telefono</th><th>Edad</th><th>Sexo</th><th>Acciones</th></tr></thead>
      <tbody>${cachedPatients.map(p => `
        <tr>
          <td>${p.id}</td>
          <td>${escapeHtml(p.nombre)}</td>
          <td>${escapeHtml(p.correo)}</td>
          <td>${escapeHtml(p.telefono)}</td>
          <td>${escapeHtml(p.edad)}</td>
          <td>${escapeHtml(p.sexo)}</td>
          <td>
            <div class="inline-actions">
              <button class="small secondary" onclick="editPatient(${p.id})">Editar</button>
              <button class="small danger" onclick="deletePatient(${p.id})">Eliminar</button>
            </div>
          </td>
        </tr>
      `).join('')}</tbody>
    </table>`;
}

async function loadAppointments() {
  const rows = await api('/api/citas');
  $('#appointmentsTable').innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Paciente</th><th>Fecha</th><th>Hora</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${rows.map(c => `
        <tr>
          <td>${c.id}</td>
          <td>${escapeHtml(c.paciente_nombre)}</td>
          <td>${escapeHtml(c.fecha)}</td>
          <td>${escapeHtml(c.hora)}</td>
          <td>${escapeHtml(c.estado)}</td>
          <td>
            ${c.estado === 'activa'
              ? `<div class="inline-actions">
                  <button class="small secondary" onclick="editAppointment(${c.id}, '${c.fecha}', '${c.hora}')">Editar</button>
                  <button class="small danger" onclick="cancelAppointment(${c.id})">Cancelar</button>
                 </div>`
              : ''}
          </td>
        </tr>`).join('')}</tbody>
    </table>`;
}

async function editAppointment(id, currentDate, currentHour) {
  const fecha = prompt('Nueva fecha (YYYY-MM-DD):', currentDate);
  if (fecha === null) return;
  const hora = prompt('Nueva hora (HH:MM):', currentHour);
  if (hora === null) return;
  const fechaFinal = fecha.trim();
  const horaFinal = hora.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFinal)) return toast('Fecha invalida');
  if (!/^\d{2}:\d{2}$/.test(horaFinal)) return toast('Hora invalida');

  await api(`/api/citas/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ fecha: fechaFinal, hora: horaFinal })
  });

  toast('Cita actualizada');
  loadAppointments();
}

async function cancelAppointment(id) {
  if (!confirm('Cancelar cita?')) return;
  await api(`/api/citas/${id}`, { method: 'DELETE' });
  toast('Cita cancelada');
  loadAppointments();
}

async function editPatient(patientId) {
  const patient = cachedPatients.find(p => Number(p.id) === Number(patientId));
  if (!patient) return toast('Paciente no disponible');

  const nombre = prompt('Nombre:', patient.nombre);
  if (nombre === null) return;
  const direccion = prompt('Direccion:', patient.direccion);
  if (direccion === null) return;
  const correo = prompt('Correo:', patient.correo);
  if (correo === null) return;
  const telefono = prompt('Telefono:', patient.telefono);
  if (telefono === null) return;
  const edad = prompt('Edad:', String(patient.edad));
  if (edad === null) return;
  const sexo = prompt('Sexo:', patient.sexo);
  if (sexo === null) return;
  const edadValue = Number(edad);
  if (!Number.isFinite(edadValue) || edadValue <= 0) return toast('Edad invalida');

  await api(`/api/pacientes/${patientId}`, {
    method: 'PUT',
    body: JSON.stringify({
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      correo: correo.trim(),
      telefono: telefono.trim(),
      edad: edadValue,
      sexo: sexo.trim()
    })
  });

  toast('Paciente actualizado');
  await loadPatients();
  loadAppointments();
}

async function deletePatient(patientId) {
  if (!confirm('Eliminar logicamente este paciente?')) return;
  await api(`/api/pacientes/${patientId}`, { method: 'DELETE' });
  toast('Paciente eliminado');
  await loadPatients();
  loadAppointments();
}

async function loadNotifications() {
  const rows = await api('/api/notificaciones');
  $('#notifications').innerHTML = rows.length ? rows.map(n => `
    <div class="notification ${n.leida ? '' : 'unread'}">
      ${n.mensaje}<br><span class="hint">${n.created_at}</span>
      ${n.leida ? '' : `<button class="small secondary" onclick="markNotification(${n.id})">Marcar leída</button>`}
    </div>
  `).join('') : '<p class="hint">Sin notificaciones.</p>';
}

async function markNotification(id) {
  await api(`/api/notificaciones/${id}/leida`, { method: 'PUT' });
  loadNotifications();
}

async function loadHistory() {
  const patientId = getHistoryTargetPatientId();
  if (!patientId) return toast('No hay paciente seleccionado');
  const rows = await api(`/api/historial/paciente/${patientId}`);
  renderHistory(rows);
}

async function loadHistoryReport() {
  const patientId = getHistoryTargetPatientId();
  if (!patientId) return toast('No hay paciente seleccionado');
  const report = await api(`/api/reportes/historial/${patientId}`);
  renderHistoryReport(report);
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(formToJson(e.target))
    });
    setSession(data);
    toast('Sesión iniciada');
  } catch (err) {
    toast(err.message);
  }
});

$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(formToJson(e.target))
    });
    e.target.reset();
    toast('Paciente registrado. Ya puedes iniciar sesión.');
  } catch (err) {
    toast(err.message);
  }
});

$('#logoutBtn').addEventListener('click', logout);
$('#loadPatients')?.addEventListener('click', loadPatients);
$('#loadAppointments').addEventListener('click', loadAppointments);
$('#loadNotifications').addEventListener('click', loadNotifications);
$('#loadHistory').addEventListener('click', loadHistory);
$('#loadHistoryReport').addEventListener('click', loadHistoryReport);

$('#patientAppointmentForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/citas', { method: 'POST', body: JSON.stringify(formToJson(e.target)) });
    e.target.reset();
    toast('Cita reservada');
    loadAppointments();
  } catch (err) { toast(err.message); }
});

$('#doctorAppointmentForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const body = formToJson(e.target);
    body.paciente_id = Number(body.paciente_id);
    await api('/api/citas', { method: 'POST', body: JSON.stringify(body) });
    e.target.reset();
    toast('Cita registrada');
    loadAppointments();
  } catch (err) { toast(err.message); }
});

$('#myPatientForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api(`/api/pacientes/${currentPatient.id}`, { method: 'PUT', body: JSON.stringify(formToJson(e.target)) });
    toast('Datos actualizados');
    const me = await api('/api/me');
    currentPatient = me.patient;
  } catch (err) { toast(err.message); }
});

$('#clinicalForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const body = formToJson(e.target);
    body.paciente_id = Number(body.paciente_id);
    await api('/api/historial', { method: 'POST', body: JSON.stringify(body) });
    e.target.reset();
    toast('Historial registrado');
  } catch (err) { toast(err.message); }
});

$('#reportPatients').addEventListener('click', async () => {
  const data = await api('/api/reportes/pacientes');
  $('#reports').textContent = JSON.stringify(data, null, 2);
});

$('#reportCalendar').addEventListener('click', async () => {
  const data = await api('/api/reportes/calendario');
  $('#reports').textContent = JSON.stringify(data, null, 2);
});

$('#reportHistory')?.addEventListener('click', async () => {
  const patientId = getHistoryTargetPatientId();
  if (!patientId) return toast('Selecciona un paciente para el reporte');
  const data = await api(`/api/reportes/historial/${patientId}`);
  $('#reports').textContent = JSON.stringify(data, null, 2);
  renderHistoryReport(data);
});

if (token) showApp();
