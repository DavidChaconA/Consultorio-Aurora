# Manual de usuario

## 1. Instalación

1. Instalar Node.js.
2. Entrar a la carpeta del proyecto donde se encuentra `package.json`.
3. Ejecutar los siguientes comandos.

En Windows:

```bat
npm install
copy .env.example .env
npm run init-db
npm run seed
npm start
```

En Linux o macOS:

```bash
npm install
cp .env.example .env
npm run init-db
npm run seed
npm start
```

4. Abrir `http://localhost:3000` en el navegador.

## 2. Inicio de sesión

El sistema tiene dos tipos de usuarios:

- Médico: puede consultar pacientes, gestionar citas, registrar historial clínico y generar reportes.
- Paciente: puede registrarse, actualizar sus datos, reservar citas, consultar sus citas, recibir notificaciones y ver su historial.

Usuarios de prueba:

```text
Médico: guillermo / guillermo123
Paciente: david / david123
Paciente: cristian / cristian123
```

Estos datos no aparecen en la pantalla de inicio de sesión; se incluyen aquí únicamente para las pruebas del proyecto.

## 3. Registro de pacientes

En la pantalla principal, un nuevo paciente puede registrarse ingresando nombre de usuario, contraseña, nombre, dirección, correo, teléfono, edad y sexo. Después del registro, puede iniciar sesión con sus credenciales.

## 4. Gestión de citas

### Paciente

El paciente puede seleccionar fecha y hora para reservar una cita. Tambien puede modificarla o cancelarla mientras este activa. Si el horario ya esta ocupado, el sistema rechaza la solicitud.

### Médico

El medico puede registrar, modificar y cancelar citas para cualquier paciente. Tambien puede actualizar o eliminar logicamente pacientes desde la tabla de pacientes. Cuando el medico crea, modifica o cancela una cita, se genera una notificacion para el paciente.

## 5. Historial clínico

El historial clínico solo puede ser registrado por el médico. Cada consulta inicia con temperatura corporal, peso, altura y presión arterial. También se registran diagnóstico, resultados de análisis clínicos y prescripciones.

La información clínica se almacena cifrada en la base de datos. Cuando se consulta desde el sistema, la capa de lógica de negocio descifra los datos y los presenta al usuario autorizado.

## 6. Reportes

El médico puede consultar:

- Lista de pacientes.
- Calendario de citas.
- Historial clínico de un paciente.

El reporte de historial clinico incluye encabezado con datos generales del paciente y cuerpo con cada consulta registrada.

El paciente puede consultar únicamente su propio historial clínico.

## 7. Prueba de concurrencia

Para demostrar que no se puede reservar dos veces el mismo horario, se debe dejar corriendo el servidor en una terminal:

```bash
npm start
```

Después, en otra terminal, ejecutar:

```bash
npm run test:concurrency
```

El script inicia sesión con los pacientes David y Cristian, intenta reservar exactamente la misma fecha y hora para ambos, y envía las dos solicitudes de forma simultánea. El resultado esperado es que una cita sea aceptada y la otra sea rechazada con el mensaje de horario no disponible.

La cita aceptada sí queda guardada en la base de datos. Para verla, se puede entrar a `http://localhost:3000` con el usuario `guillermo` y presionar “Cargar citas”. También puede verla el paciente que obtuvo la cita al iniciar sesión con su cuenta.
