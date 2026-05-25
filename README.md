# Consultorio Aurora - Sistema distribuido simple

## Integrantes:
- David Efrain Chacon Ambrosio
- Cristhian Leonel Ramirez Couoh
- Guillermo Cristian Gruintal Polanco

Sistema distribuido para la gestión de citas de un consultorio médico.  Caracteristicas principales: tres capas, servicios web, autenticación, gestión de pacientes, gestión de citas, historial clínico cifrado, reportes y prueba de concurrencia.

## Tecnologías

- Node.js + Express para la capa de lógica de negocio.
- SQLite para la capa de datos.
- HTML, CSS y JavaScript para la capa de presentación.
- API REST como servicios web.
- Contraseñas protegidas con hash usando `crypto.scrypt`.
- Tokens firmados para autenticación.
- AES-256-GCM para cifrar el historial clínico.
- Lock distribuido por horario en base de datos (`distributed_locks`) y restriccion UNIQUE para evitar doble reserva de horarios.

## Instalación

En Windows, dentro de la carpeta donde está `package.json`:

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

Abrir en el navegador:

```text
http://localhost:3000
```

## Usuarios de prueba

Los usuarios cargados por `npm run seed` son:

```text
Médico:
usuario: guillermo
contraseña: guillermo123

Paciente 1:
usuario: david
contraseña: david123

Paciente 2:
usuario: cristian
contraseña: cristian123
```

## Prueba de concurrencia

En una terminal, iniciar el servidor:

```bash
npm start
```

En otra terminal, ejecutar:

```bash
npm run test:concurrency
```

La prueba intenta reservar el mismo horario desde dos pacientes al mismo tiempo. El resultado esperado es que una solicitud sea aceptada y la otra rechazada. La cita que sí se registra queda guardada en la base de datos y se puede ver en `http://localhost:3000` iniciando sesión como el médico Guillermo o como el paciente que obtuvo la cita.

## Estructura del proyecto

```text
consultorio-distribuido-simple/
├── public/                 # Capa de presentación
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/                    # Capa de lógica de negocio
│   ├── server.js
│   ├── auth.js
│   ├── cryptoUtil.js
│   ├── db.js
│   └── lockManager.js
├── scripts/
│   ├── init-db.js
│   ├── seed.js
│   └── test-concurrency.js
├── docs/                   # Documentación del proyecto
└── package.json
```
