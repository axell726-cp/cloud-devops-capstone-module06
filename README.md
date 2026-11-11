# TaskFlow Cloud — Module 06 Capstone

Capstone de Cloud & DevOps para el internship de Codomax Digital Solutions. Reutiliza patrones probados de TaskFlow Modules 03–05, pero vive en un repositorio, Worker y base D1 independientes.

## Entregables

- Repositorio: https://github.com/axell726-cp/cloud-devops-capstone-module06
- Aplicación pública: https://cloud-devops-capstone-module06.cloud-webapp-module03.workers.dev
- GitHub Actions: https://github.com/axell726-cp/cloud-devops-capstone-module06/actions
- Borrador para LinkedIn: LINKEDIN_POST.md

## Arquitectura

~~~mermaid
flowchart LR
  U[Browser over HTTPS] --> W[Cloudflare Worker]
  W --> A[Static HTML CSS JS assets]
  W --> D[(Cloudflare D1)]
  G[GitHub main] --> C[GitHub Actions]
  C --> T[Lint tests and dry run]
  T --> X[Docker build and Compose smoke]
  X --> P[Wrangler deploy to Workers]
  P --> S[Public HTTPS smoke and sanitized logs]
  L[Daily GitHub health probe] --> W
~~~

Cloudflare Workers aporta compute y red distribuida; no se creó una VPC tradicional. Docker/Compose ejecuta el Worker localmente con D1 local para construir y probar. Cloudflare Workers no ejecuta este Dockerfile en producción: Wrangler publica el Worker directamente.

## Funciones

- Crear, listar, editar y eliminar tareas.
- Estados pendiente, en progreso y completada.
- Prioridades baja, media y alta.
- Filtros por estado y prioridad, búsqueda de texto y estadísticas por estado.
- Persistencia remota en D1 y un endpoint /health que comprueba Worker y base de datos.
- Diseño responsive para móvil y escritorio.

La demo es pública y compartida. No tiene cuentas ni autenticación porque debe seguir abierta al evaluador; no ingreses datos personales, secretos ni información confidencial. Las mutaciones verifican el origen, el JSON se limita a 2 KB, los títulos/búsquedas a 120 caracteres, los valores se validan y las consultas SQL son parametrizadas. Hay un límite best-effort de escrituras por IP y cabeceras de seguridad; no es una protección global contra abuso.

## Servicios y costos

- Cloudflare Workers Free y D1 Free, en un subdominio workers.dev gratuito.
- GitHub Actions usa runners estándar gratuitos para este repositorio público. No se suben artefactos de workflow; los logs permanecen en el historial de Actions y las evidencias persistentes están versionadas en evidence/.
- No hay dominio comprado, tarjeta, plan pagado, registro de contenedores, AWS, Azure ni OCI.
- Preflight de cuenta: Workers Free activo, sin método de pago; D1 tenía 2 bases antes de Module 06 y el nuevo capstone creó la tercera. El límite documentado de D1 Free es 10 bases.
- Consumo esperado USD 0 dentro de los límites gratuitos; esto no es una factura final. Si una cuota gratuita se supera, el servicio puede rechazar solicitudes hasta su reinicio.

Límites consultados en la documentación oficial: Workers Free permite 100.000 solicitudes diarias y 10 ms de CPU por invocación; D1 Free admite hasta 10 bases, 500 MB por base y límites diarios de lecturas/escrituras. GitHub indica que los runners estándar son gratuitos en repositorios públicos.

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/reference/faq/
- https://docs.github.com/en/actions/concepts/billing-and-usage

## Desarrollo local

Requisitos: Node.js 22+, Docker Desktop y Docker Compose.

~~~powershell
npm ci
npm run db:migrate:local
npm run dev
npm run test:smoke
~~~

La app local queda en http://127.0.0.1:8787. Para ejecutar en Docker:

~~~powershell
docker compose config --quiet
docker compose up --build -d --wait
npm run test:smoke
docker compose down -v
~~~

Compose limita el puerto a loopback, usa un volumen local exclusivo del capstone, ejecuta como usuario no root y endurece el contenedor. El comando de limpieza solo afecta a este proyecto local.

## D1 y despliegue

La base remota taskflow-capstone-module06 y su migración inicial fueron aplicadas con la sesión Wrangler del operador. La consulta de tareas desde producción ocurre por el binding D1 del Worker.

El workflow de CI valida pushes y pull requests, construye y prueba Docker, y despliega solo desde main. El deploy requiere los secretos CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID, más la variable CLOUDFLARE_DEPLOY_ENABLED=true. CLOUDFLARE_ACCOUNT_ID ya está configurado como GitHub Secret. El token debe usar Workers Editor con alcance Individual Workers y seleccionar solo cloud-devops-capstone-module06; ese rol permite desplegar el Worker existente y leer su observabilidad para wrangler tail. No requiere D1, Routes ni permisos Admin/globales. El workflow no accede directamente a D1; futuras migraciones remotas se ejecutan con una sesión autenticada de mantenimiento antes de publicar.

La disponibilidad se sondea diariamente y en cada push a main mediante GitHub Actions; también se verifica en smoke tests. Es una sonda periódica, no monitoreo continuo ni una garantía de uptime.

## GitHub Actions — cierre verificado

El run [42971994272](https://github.com/axell726-cp/cloud-devops-capstone-module06/actions/runs/42971994272) terminó success en el commit 5bfd85a30c99724be11abbe5674fcdc1aeca3f01. Pasaron lint, tests, build, Docker Compose y el deploy automático desde main.

- Smoke local: 26/26.
- Smoke Docker: 26/26.
- Smoke público HTTPS después del deploy: 26/26.
- Wrangler tail sanitizado: 20 invocaciones, 0 excepciones y 0 respuestas 5xx; las 12 respuestas 4xx fueron casos negativos esperados del smoke test.

La sonda de disponibilidad más reciente anterior al deploy está en [run 42969596079](https://github.com/axell726-cp/cloud-devops-capstone-module06/actions/runs/42969596079). El workflow también verifica health y D1 en cada push a main.

## Ejecución verificada — 2026-11-11

El Worker cloud-devops-capstone-module06 está publicado en la URL indicada y su binding conecta con la D1 nueva. Los 26 smoke checks remotos pasaron por HTTPS: salud, página, validación, CRUD, persistencia, filtros, estadísticas y eliminación de tareas de prueba. El Docker Compose local pasó también sus 26 smoke checks y el contenedor de validación se eliminó al final.

evidence/worker-monitoring.json resume una muestra auténtica de wrangler tail tomada durante los smoke tests: 11 invocaciones registradas, 0 excepciones del Worker y 0 respuestas 5xx. Las respuestas 4xx de esa muestra corresponden a casos de validación negativa del smoke test. No se interpreta esta muestra como monitorización continua.

El panel Cloudflare mostró Workers Free activo y ningún método de pago registrado; Wrangler listó 3 bases D1 en la cuenta, incluida esta base, frente al límite gratuito documentado de 10. Coste previsto USD 0 mientras el uso se mantenga dentro de las cuotas; es una estimación del plan, no una factura final. Las cuotas y límites se anotan en evidence/cloudflare-free-plan.md.

El primer despliegue se hizo con Wrangler y el run 42971994272 verificó el deploy automático posterior. El workflow utiliza CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID desde GitHub Secrets, con CLOUDFLARE_DEPLOY_ENABLED=true. El token usa Workers Editor con alcance Individual Workers sobre cloud-devops-capstone-module06; no necesita permisos de D1, Routes ni Admin/globales. El rol permite desplegar el Worker existente y leer su observabilidad para wrangler tail. Véase la guía oficial de [permisos de Workers](https://developers.cloudflare.com/workers/authorization/workers/).

## Observabilidad y evidencias

El Worker registra JSON con ID de solicitud, método, ruta normalizada, código y duración; no registra el contenido de tareas ni IP del cliente. Errores internos guardan el tipo de error y el ID. El run 42971994272 generó la muestra de Wrangler tail sanitizada; omite IP, headers, URL, geolocalización, huellas TLS y contenido. El resumen está en evidence/actions-deploy.txt.

Los comandos, resultados auténticos y la captura pública app-desktop.png se guardan en evidence/. Consulta evidence/README.md para el índice. El despliegue inicial por Wrangler se conserva como historial; el despliegue automático se verificó en el run de GitHub Actions enlazado arriba.

## Seguridad y límites

Las tareas se comparten entre visitantes, no son privadas. No uses la app para información real. Las limitaciones best-effort por IP viven en memoria de instancias aisladas y no sustituyen autenticación, protección WAF ni un límite distribuido.








