# Reporte de pruebas de concurrencia

## Objetivo

Demostrar que el sistema evita la condición de carrera cuando dos usuarios intentan reservar el mismo horario de cita al mismo tiempo.

## Problema

En un sistema distribuido, dos pacientes podrían enviar una solicitud de reserva para el mismo día y hora prácticamente al mismo tiempo. Si el sistema no controla la concurrencia, ambas solicitudes podrían leer que el horario está libre y registrar dos citas duplicadas. Esto causaría una inconsistencia porque el consultorio solo puede atender una cita por horario.

## Mecanismo implementado

Se implemento un mecanismo de exclusion mutua distribuida en la capa de logica de negocio usando una tabla compartida llamada `distributed_locks` en la base de datos. El bloqueo se genera usando la fecha y la hora de la cita:

```text
lock_key = cita:<fecha>:<hora>
```

Cuando una solicitud intenta crear una cita:

1. Solicita el bloqueo del horario.
2. Entra a la sección crítica de ese horario.
3. Verifica si ya existe una cita activa en ese horario.
4. Si no existe, registra la cita.
5. Libera el bloqueo.

Además, en la capa de datos se agregó una restricción única parcial:

```sql
CREATE UNIQUE INDEX idx_cita_horario_activo
ON appointments(fecha, hora)
WHERE estado = 'activa';
```

De esta forma, el sistema tiene dos niveles de protección: exclusión mutua en la lógica de negocio y restricción de integridad en la base de datos.

## Procedimiento de prueba

1. Iniciar el servidor:

```bash
npm start
```

2. En otra terminal, ejecutar la prueba:

```bash
npm run test:concurrency
```

3. El script realiza las siguientes acciones:

- Inicia sesión con el paciente `david`.
- Inicia sesión con el paciente `cristian`.
- Genera una fecha y hora de prueba.
- Envía dos solicitudes simultáneas para reservar exactamente el mismo horario.
- Muestra una tabla con el estado HTTP de cada intento.
- Indica qué paciente obtuvo la cita y cuál fue rechazado.

## Resultado esperado

El sistema debe aceptar una sola solicitud y rechazar la otra con código HTTP 409, indicando que el horario no está disponible.

Ejemplo de resultado esperado:

```text
Intento 1: 201 - Cita registrada
Intento 2: 409 - Horario no disponible
```

También puede ocurrir que el intento aceptado sea el segundo y el rechazado el primero, dependiendo del orden en que el servidor procese las solicitudes. Lo importante es que nunca deben aceptarse las dos solicitudes para el mismo horario.

## Visualización del resultado en la interfaz

La cita que sí se acepta queda guardada en la base de datos. Después de ejecutar la prueba se puede verificar en la interfaz web:

1. Abrir `http://localhost:3000`.
2. Iniciar sesión como médico con `guillermo / guillermo123`.
3. Presionar el botón “Cargar citas”.
4. Buscar la fecha y hora que imprimió la prueba en la terminal.

También puede iniciar sesión el paciente que obtuvo la cita y cargar sus citas para verificar que se registró correctamente.

## Conclusión

La prueba demuestra que el sistema evita la condición de carrera en la reserva de citas. Aunque dos solicitudes lleguen al mismo tiempo, solo una puede entrar a la sección crítica correspondiente al horario seleccionado. La segunda solicitud detecta que el horario ya fue ocupado y es rechazada.
