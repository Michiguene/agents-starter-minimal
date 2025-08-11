
# Agents Starter (Minimal) — Infra lista para PRD + Tareas

Infra mínima para que puedas **desarrollar ideas y PRDs** y, cuando quieras, orquestar tareas entre agentes.
Sin Vercel, sin Next.js. Solo **Node + Express** para endpoints y un **worker** simple.

## 🧱 Qué incluye
- `server/` con endpoints:
  - `POST /dispatch` → encola tareas en Upstash Redis
  - `POST /callback` → guarda eventos en Supabase (opcional)
- `worker/implementer.js` → drena la cola `queue:implementer` y simula trabajo
- `templates/PRD.md` → plantilla de PRD lista para usar
- `templates/ISSUE_TEMPLATE/` → plantillas de GitHub Issues (PRD Intake, Feature, Bug)
- `.env.example` → variables requeridas (Upstash/Supabase)
- `package.json` con scripts listos

## 🚀 Cómo usar
1) **Clona o descarga este repo** (si bajaste el .zip, descomprímelo).
2) Copia `.env.example` a `.env` y completa tus claves:
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - (Opcional) `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3) Instala deps:
   ```bash
   npm install
   ```
4) Abre **dos terminales**:
   - **Terminal A** (API): `npm run server`
   - **Terminal B** (Worker): `npm run worker:implementer`
5) Envía una tarea de prueba:
   ```bash
   curl -X POST http://localhost:3000/dispatch \
  -H "content-type: application/json" \
  -d '{
    "task_id":"FEAT-001",
    "agent":"implementer",
    "title":"OAuth Google",
    "callback_url":"http://localhost:3000/callback",
    "meta":{"priority":"P1"}
  }'
   ```
6) Verás en la consola del worker: `✅ Procesada FEAT-001`. Y en la del servidor, un log del **Callback**.

## 🧩 Estructura
```
agents-starter-minimal/
  server/
    index.js
  worker/
    implementer.js
  lib/
    types.js
  templates/
    PRD.md
    ISSUE_TEMPLATE/
      prd_intake.md
      feature_request.md
      bug_report.md
  .env.example
  package.json
  README.md
```

## 🧰 Siguiente paso (opcional)
- Conectar Supabase: crea la tabla `task_events` con RLS (ver README al final del archivo).
- Añadir más agentes: copia `worker/implementer.js` y cambia la cola a `queue:tester`.
- Llevar esto a GitHub: sube el repo y usa las plantillas de Issues para tus PRDs.

Peque�o ajuste para disparar CI
