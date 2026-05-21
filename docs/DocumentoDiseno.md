# Documento de diseño

## Sistema Distribuido para la Gestión de Citas de un Consultorio Médico

## 1. Descripción general

El sistema permite la gestión de pacientes, citas médicas, historial clínico y reportes dentro de un consultorio médico. La aplicación fue diseñada como un sistema distribuido de tres capas: presentación, lógica de negocio y datos.

El objetivo principal es permitir que los pacientes puedan reservar citas y que el médico pueda administrar pacientes, consultar el calendario de citas y registrar el historial clínico. Además, el sistema incorpora mecanismos de seguridad y control de concurrencia para evitar inconsistencias en la reserva de horarios.

## 2. Arquitectura de tres capas

### 2.1 Capa de presentación

La capa de presentación está formada por una interfaz web construida con HTML, CSS y JavaScript. Esta interfaz permite a los usuarios iniciar sesión, registrarse, consultar citas, reservar horarios y visualizar notificaciones.

El médico, además, puede consultar la lista de pacientes, registrar citas para pacientes, agregar historial clínico y generar reportes.

### 2.2 Capa de lógica de negocio

La lógica de negocio está implementada con Node.js y Express. Esta capa expone servicios web mediante una API REST. Aquí se aplican las reglas del sistema, por ejemplo:

- Validar usuarios y roles.
- Controlar qué información puede consultar cada usuario.
- Registrar y modificar citas.
- Aplicar exclusión mutua al reservar horarios.
- Cifrar y descifrar información clínica.
- Generar reportes.
- Crear notificaciones.

### 2.3 Capa de datos

La capa de datos utiliza SQLite. En esta capa se almacenan usuarios, pacientes, citas, notificaciones e historial clínico. La base de datos también incluye una restricción única para evitar que existan dos citas activas en el mismo día y hora.

## 3. Diseño de la base de datos

### users

Almacena las cuentas del sistema.

- id
- username
- password_hash
- rol
- created_at

### patients

Almacena la información de los pacientes.

- id
- user_id
- nombre
- direccion
- correo
- telefono
- edad
- sexo
- activo

### appointments

Almacena las citas médicas.

- id
- paciente_id
- fecha
- hora
- estado
- creada_por_user_id
- created_at
- updated_at

La tabla tiene una restricción única para impedir dos citas activas en el mismo horario.

### clinical_records

Almacena el historial clínico. Los campos médicos sensibles se guardan cifrados.

- id
- paciente_id
- medico_user_id
- fecha
- temperatura_enc
- peso_enc
- altura_enc
- presion_arterial_enc
- diagnostico_enc
- resultados_enc
- prescripciones_enc

### notifications

Almacena notificaciones para los usuarios.

- id
- user_id
- mensaje
- leida
- created_at

## 4. Servicios web

La comunicación entre la presentación y la lógica de negocio se realiza mediante servicios web REST. Las rutas principales son:

- `/api/auth/register`
- `/api/auth/login`
- `/api/pacientes`
- `/api/citas`
- `/api/historial`
- `/api/reportes/pacientes`
- `/api/reportes/calendario`
- `/api/reportes/historial/:pacienteId`
- `/api/notificaciones`

Todas las operaciones sensibles requieren autenticación.

## 5. Seguridad

El sistema implementa varias medidas de seguridad:

1. Las contraseñas no se almacenan en texto plano. Se guardan usando hash con sal mediante `crypto.scrypt`.
2. Las sesiones se manejan con tokens firmados.
3. Las rutas protegidas verifican autenticación.
4. Las operaciones se restringen por rol: médico o paciente.
5. El historial clínico se almacena cifrado con AES-256-GCM.
6. El paciente solo puede consultar su propia información e historial.
7. El médico puede acceder a la información administrativa del sistema.

## 6. Control de concurrencia

Para la reserva de citas se implemento exclusion mutua distribuida en la capa de logica de negocio. Cada horario tiene un lock asociado a la combinacion de fecha y hora y se almacena en la tabla compartida `distributed_locks`, por lo que el control se mantiene aun cuando existen multiples instancias del backend.

El flujo es el siguiente:

1. El usuario solicita una cita.
2. El sistema obtiene el lock correspondiente al horario.
3. Se verifica si el horario está disponible.
4. Si está disponible, se registra la cita.
5. Se libera el lock.

Además, la base de datos cuenta con una restricción única sobre fecha y hora para citas activas. Esta restricción funciona como respaldo en caso de solicitudes concurrentes.

## 7. Interfaz de usuario

La interfaz web permite dos tipos de uso:

### Paciente

- Registrarse.
- Iniciar sesión.
- Modificar sus datos.
- Reservar citas.
- Consultar sus citas.
- Ver sus notificaciones.
- Consultar su historial clínico.

### Medico

- Iniciar sesion.
- Consultar, actualizar y eliminar logicamente pacientes.
- Registrar, modificar y cancelar citas para pacientes.
- Registrar historial clinico.
- Consultar reportes.
- Consultar calendario de citas.

## 8. Reportes

El sistema genera los reportes solicitados:

- Lista de pacientes.
- Calendario de citas.
- Historial clínico de un paciente.

El historial clínico incluye encabezado con datos generales del paciente y cuerpo con los datos de cada consulta.

## 9. Conclusión

La implementación cumple con los requisitos principales del proyecto. El sistema usa una arquitectura de tres capas, expone servicios web, protege el acceso mediante autenticación, cifra los datos clínicos y controla la concurrencia en la reserva de citas. Aunque la implementación se mantiene sencilla, conserva los elementos necesarios para considerarse un sistema distribuido funcional y seguro para el contexto académico del proyecto.
