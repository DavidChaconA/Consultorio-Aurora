# Especificación de servicios web

La capa de lógica de negocio expone servicios web mediante una API REST. Todas las rutas protegidas requieren el encabezado:

```text
Authorization: Bearer <token>
```

## Autenticación

### POST /api/auth/register
Registra un paciente.

Parámetros JSON:

```json
{
  "username": "juan",
  "password": "juan123",
  "nombre": "Juan Pérez",
  "direccion": "Mérida, Yucatán",
  "correo": "juan@example.com",
  "telefono": "9991234567",
  "edad": 21,
  "sexo": "Masculino"
}
```

### POST /api/auth/login
Inicia sesión.

```json
{
  "username": "guillermo",
  "password": "guillermo123"
}
```

Respuesta:

```json
{
  "token": "...",
  "user": {
    "id": 1,
    "username": "guillermo",
    "rol": "MEDICO"
  }
}
```

## Pacientes

### GET /api/pacientes
Lista pacientes. Solo médico.

### GET /api/pacientes/:id
Consulta un paciente. Médico o el propio paciente.

### PUT /api/pacientes/:id
Modifica datos del paciente.

### DELETE /api/pacientes/:id
Eliminación lógica del paciente.

## Citas

### POST /api/citas
Crea una cita. El paciente crea para sí mismo; el médico puede crear para un paciente.

```json
{
  "paciente_id": 1,
  "fecha": "2026-05-24",
  "hora": "10:00"
}
```

Si el horario ya está ocupado, responde 409.

### GET /api/citas
Consulta citas. Médico ve todas; paciente ve solo las suyas.

### PUT /api/citas/:id
Modifica fecha, hora o estado de una cita.

### DELETE /api/citas/:id
Cancela una cita.

## Historial clínico

### POST /api/historial
Registra historial clínico. Solo médico. Los datos sensibles se almacenan cifrados.

```json
{
  "paciente_id": 1,
  "temperatura": "36.5",
  "peso": "70 kg",
  "altura": "1.75 m",
  "presion_arterial": "120/80",
  "diagnostico": "Consulta general",
  "resultados": "Sin observaciones",
  "prescripciones": "Reposo"
}
```

### GET /api/historial/paciente/:id
Consulta historial clínico. Médico o el propio paciente.

## Reportes

### GET /api/reportes/pacientes
Lista de pacientes. Solo médico.

### GET /api/reportes/calendario
Calendario de citas. Solo médico.

### GET /api/reportes/historial/:pacienteId
Historial clínico de un paciente. Médico o el propio paciente.

## Notificaciones

### GET /api/notificaciones
Lista notificaciones del usuario autenticado.

### PUT /api/notificaciones/:id/leida
Marca una notificación como leída.
