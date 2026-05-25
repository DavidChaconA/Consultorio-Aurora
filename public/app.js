let token = localStorage.getItem('token');
let currentUser = null;
let currentPatient = null;
let cachedPatients = [];
const APPOINTMENT_TIME_MINUTES_MIN = 9 * 60;
const APPOINTMENT_TIME_MINUTES_MAX = 19 * 60;

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

function formatParagraph(value, emptyLabel = '') {
  const text = String(value ?? '').trim();
  if (!text) return emptyLabel ? `<span class="hint">${emptyLabel}</span>` : '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function isValidAppointmentTimeSlot(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  const totalMinutes = (hours * 60) + minutes;
  return totalMinutes >= APPOINTMENT_TIME_MINUTES_MIN
    && totalMinutes <= APPOINTMENT_TIME_MINUTES_MAX
    && minutes % 30 === 0;
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
      : '';
    return;
  }

  $('#historyControls').innerHTML = '';
}

function renderHistory(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    $('#history').innerHTML = '';
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
        <p class="history-card-meta">Paciente: ${escapeHtml(row.paciente_nombre)} | Médico: ${escapeHtml(row.medico)} | Fecha: ${formatDate(row.fecha)}</p>
      </div>

      <div class="history-metrics">
        <div><span class="history-label">Temperatura</span><strong>${escapeHtml(row.temperatura)}</strong></div>
        <div><span class="history-label">Peso</span><strong>${escapeHtml(row.peso)}</strong></div>
        <div><span class="history-label">Altura</span><strong>${escapeHtml(row.altura)}</strong></div>
        <div><span class="history-label">Presión arterial</span><strong>${escapeHtml(row.presion_arterial)}</strong></div>
      </div>

      <div class="history-block">
        <h4>Diagnóstico</h4>
        <p>${formatParagraph(row.diagnostico)}</p>
      </div>

      <div class="history-block">
        <h4>Resultados de análisis</h4>
        <p>${formatParagraph(row.resultados)}</p>
      </div>

      <div class="history-block">
        <h4>Prescripciones</h4>
        <p>${formatParagraph(row.prescripciones)}</p>
      </div>
    </article>
  `).join('');
}

function buildHistoryReportHtml(report) {
  const header = report?.encabezado;
  const body = Array.isArray(report?.cuerpo) ? report.cuerpo : [];

  if (!header) return '';

  const headerHtml = `
    <section class="history-report">
      <h3>Encabezado del paciente</h3>
      <div class="report-summary">
        <span><strong>Nombre:</strong> ${escapeHtml(header.nombre)}</span>
        <span><strong>Dirección:</strong> ${escapeHtml(header.direccion)}</span>
        <span><strong>Correo:</strong> ${escapeHtml(header.correo)}</span>
        <span><strong>Teléfono:</strong> ${escapeHtml(header.telefono)}</span>
        <span><strong>Edad:</strong> ${escapeHtml(header.edad)}</span>
        <span><strong>Sexo:</strong> ${escapeHtml(header.sexo)}</span>
      </div>
    </section>
  `;

  if (body.length === 0) return headerHtml;

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
        <div><span class="history-label">Presión arterial</span><strong>${escapeHtml(row.presion_arterial)}</strong></div>
      </div>
      <div class="history-block">
        <h4>Diagnóstico</h4>
        <p>${formatParagraph(row.diagnostico)}</p>
      </div>
      <div class="history-block">
        <h4>Resultados de análisis</h4>
        <p>${formatParagraph(row.resultados)}</p>
      </div>
      <div class="history-block">
        <h4>Prescripciones</h4>
        <p>${formatParagraph(row.prescripciones)}</p>
      </div>
    </article>
  `).join('');

  return headerHtml + bodyHtml;
}

function renderHistoryReport(report) {
  $('#history').innerHTML = buildHistoryReportHtml(report);
}

function renderPatientsReport(report) {
  const patients = Array.isArray(report?.pacientes) ? report.pacientes : [];

  if (patients.length === 0) {
    $('#reports').innerHTML = '';
    return;
  }

  $('#reports').innerHTML = `
    <section class="report-card">
      <div class="report-header">
        <div>
          <h3>${escapeHtml(report.titulo || 'Lista de pacientes')}</h3>
        </div>
        <span class="report-badge">${patients.length} paciente(s)</span>
      </div>
      <table>
        <thead>
          <tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Edad</th><th>Sexo</th></tr>
        </thead>
        <tbody>
          ${patients.map(p => `
            <tr>
              <td>${escapeHtml(p.id)}</td>
              <td>${escapeHtml(p.nombre)}</td>
              <td>${escapeHtml(p.correo)}</td>
              <td>${escapeHtml(p.telefono)}</td>
              <td>${escapeHtml(p.edad)}</td>
              <td>${escapeHtml(p.sexo)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderCalendarReport(report) {
  const appointments = Array.isArray(report?.citas) ? report.citas : [];
  const activeCount = appointments.filter(c => c.estado === 'activa').length;
  const cancelledCount = appointments.filter(c => c.estado === 'cancelada').length;

  if (appointments.length === 0) {
    $('#reports').innerHTML = '';
    return;
  }

  $('#reports').innerHTML = `
    <section class="report-card">
      <div class="report-header">
        <div>
          <h3>${escapeHtml(report.titulo || 'Calendario de citas')}</h3>
        </div>
        <div class="report-badges">
          <span class="report-badge">${appointments.length} total</span>
          <span class="report-badge ok">${activeCount} activas</span>
          <span class="report-badge muted">${cancelledCount} canceladas</span>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Estado</th></tr>
        </thead>
        <tbody>
          ${appointments.map(c => `
            <tr>
              <td>${formatDate(c.fecha)}</td>
              <td>${escapeHtml(c.hora)}</td>
              <td>${escapeHtml(c.paciente)}</td>
              <td><span class="status-pill ${c.estado === 'activa' ? 'active' : 'cancelled'}">${escapeHtml(c.estado)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderMedicalHistoryReport(report) {
  $('#reports').innerHTML = `
    <section class="report-card">
      <div class="report-header">
        <div>
          <h3>${escapeHtml(report?.titulo || 'Historial clínico')}</h3>
        </div>
        <span class="report-badge">${Array.isArray(report?.cuerpo) ? report.cuerpo.length : 0} consulta(s)</span>
      </div>
      ${buildHistoryReportHtml(report)}
    </section>
  `;
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
  const reports = $('#reports');
  if (reports) reports.innerHTML = '';
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
  const reportSelect = $('#reportHistoryPatientSelect');
  if (reportSelect) reportSelect.innerHTML = options;
  renderHistoryControls();

  $('#patientsTable').innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Edad</th><th>Sexo</th><th>Acciones</th></tr></thead>
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFinal)) return toast('Fecha inválida');
  if (!/^\d{2}:\d{2}$/.test(horaFinal)) return toast('Hora inválida');
  if (!isValidAppointmentTimeSlot(horaFinal)) {
    return toast('La hora debe ser de 09:00 a 19:00 en intervalos de 30 minutos');
  }

  await api(`/api/citas/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ fecha: fechaFinal, hora: horaFinal })
  });

  toast('Cita actualizada');
  loadAppointments();
}

async function cancelAppointment(id) {
  if (!confirm('¿Cancelar cita?')) return;
  await api(`/api/citas/${id}`, { method: 'DELETE' });
  toast('Cita cancelada');
  loadAppointments();
}

async function editPatient(patientId) {
  const patient = cachedPatients.find(p => Number(p.id) === Number(patientId));
  if (!patient) return toast('Paciente no disponible');

  const nombre = prompt('Nombre:', patient.nombre);
  if (nombre === null) return;
  const direccion = prompt('Dirección:', patient.direccion);
  if (direccion === null) return;
  const correo = prompt('Correo:', patient.correo);
  if (correo === null) return;
  const telefono = prompt('Teléfono:', patient.telefono);
  if (telefono === null) return;
  const edad = prompt('Edad:', String(patient.edad));
  if (edad === null) return;
  const sexo = prompt('Sexo:', patient.sexo);
  if (sexo === null) return;
  const edadValue = Number(edad);
  if (!Number.isFinite(edadValue) || edadValue <= 0) return toast('Edad inválida');

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
  if (!confirm('¿Eliminar lógicamente este paciente?')) return;
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
  `).join('') : '';

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
    const body = formToJson(e.target);
    if (!isValidAppointmentTimeSlot(String(body.hora || '').trim())) {
      return toast('La hora debe ser de 09:00 a 19:00 en intervalos de 30 minutos');
    }
    await api('/api/citas', { method: 'POST', body: JSON.stringify(body) });
    e.target.reset();
    toast('Cita reservada');
    loadAppointments();
  } catch (err) { toast(err.message); }
});

$('#doctorAppointmentForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const body = formToJson(e.target);
    if (!isValidAppointmentTimeSlot(String(body.hora || '').trim())) {
      return toast('La hora debe ser de 09:00 a 19:00 en intervalos de 30 minutos');
    }
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
  renderPatientsReport(data);
});

$('#reportCalendar').addEventListener('click', async () => {
  const data = await api('/api/reportes/calendario');
  renderCalendarReport(data);
});

$('#reportHistory')?.addEventListener('click', async () => {
  const patientId = $('#reportHistoryPatientSelect')?.value || getHistoryTargetPatientId();
  if (!patientId) return toast('Selecciona un paciente para el reporte');
  const data = await api(`/api/reportes/historial/${patientId}`);
  renderMedicalHistoryReport(data);
  renderHistoryReport(data);
});

if (token) showApp();
