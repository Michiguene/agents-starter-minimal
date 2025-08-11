import 'dotenv/config'
import express from 'express'
import { Redis } from '@upstash/redis'
import { supabaseAdmin } from '../lib/supabase.js'

const app = express()
app.use(express.json({ limit: '1mb' }))

const redis = Redis.fromEnv()

// Config
const PORT = process.env.PORT || 3000
const API_KEY = process.env.API_KEY || null
const CALLBACK_URL_DEFAULT =
  process.env.CALLBACK_URL || `http://localhost:${PORT}/callback`

const hasSupabase =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY

// Middleware de seguridad (opcional: se activa si pones API_KEY en .env)
function requireApiKey(req, res, next) {
  if (!API_KEY) return next() // sin API_KEY no bloquea (dev)
  const fromHeader =
    req.header('x-api-key') ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const fromQuery = req.query.key
  if (fromHeader === API_KEY || fromQuery === API_KEY) return next()
  return res.status(401).json({ ok: false, error: 'unauthorized' })
}

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true }))

// Encolar tareas
app.post('/dispatch', requireApiKey, async (req, res) => {
  try {
    const task = { ...(req.body || {}) }
    if (!task.task_id || !task.agent) {
      return res
        .status(400)
        .json({ ok: false, error: 'task_id y agent son obligatorios' })
    }
    // callback por defecto si no lo mandan
    task.callback_url = task.callback_url || CALLBACK_URL_DEFAULT

    await redis.rpush(`queue:${task.agent}`, JSON.stringify(task))
    return res.json({ ok: true, enqueued: task.task_id })
  } catch (e) {
    console.error('Dispatch error:', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
})

// Recibir resultados (guardar en Supabase + encadenar QA)
app.post('/callback', requireApiKey, async (req, res) => {
  try {
    const payload = req.body || {}
    console.log('📥 Callback:', payload)

    // Guardar evento en Supabase (si está configurado)
    if (hasSupabase) {
      const { error } = await supabaseAdmin.from('task_events').insert({
        task_id: payload.task_id,
        agent: payload.agent || 'unknown',
        status: payload.status || 'unknown',
        notes: payload.notes || null,
        payload
      })
      if (error) console.error('Supabase insert error', error)
    }

    // ⛓️ Encadenar QA cuando termina el Implementer
    if (payload.agent === 'implementer' && payload.status === 'done') {
      const nextTask = {
        task_id: `TEST-${payload.task_id}`,
        agent: 'tester',
        title: `QA de ${payload.task_id}`,
        context: payload.output ?? null,
        callback_url: CALLBACK_URL_DEFAULT
      }
      await redis.rpush('queue:tester', JSON.stringify(nextTask))
      console.log('➡️  Encolada tarea de QA', nextTask.task_id)
    }

    return res.json({ ok: true })
  } catch (e) {
    console.error('Callback error:', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
})

// Historial JSON (requiere Supabase)
app.get('/events', requireApiKey, async (req, res) => {
  try {
    if (!hasSupabase) {
      return res.json({ ok: true, data: [], note: 'Supabase no configurado' })
    }
    const { data, error } = await supabaseAdmin
      .from('task_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ ok: false, error: error.message })
    return res.json({ ok: true, data })
  } catch (e) {
    console.error('Events error:', e)
    return res.status(500).json({ ok: false, error: e.message })
  }
})

// Historial simple en HTML (con API key)
app.get('/events/html', requireApiKey, async (req, res) => {
  try {
    if (!hasSupabase) return res.send('<p>Supabase no configurado</p>')
    const { data, error } = await supabaseAdmin
      .from('task_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).send(error.message)

    const rows = (data ?? [])
      .map(
        (e) => `
      <tr>
        <td>${e.created_at ?? ''}</td>
        <td>${e.task_id ?? ''}</td>
        <td>${e.agent ?? ''}</td>
        <td>${e.status ?? ''}</td>
        <td><pre style="margin:0;white-space:pre-wrap">${escapeHtml(
          JSON.stringify(e.payload ?? {}, null, 2)
        )}</pre></td>
      </tr>`
      )
      .join('')

    res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Eventos</title>
<style>
body{font-family:system-ui,Segoe UI,Arial;margin:24px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
th{background:#f5f5f5;text-align:left}
</style></head>
<body>
<h1>Eventos recientes</h1>
<table>
  <thead><tr><th>Fecha</th><th>Task</th><th>Agente</th><th>Status</th><th>Payload</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`)
  } catch (e) {
    console.error('Events HTML error:', e)
    res.status(500).send(e.message)
  }
})

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

app.listen(PORT, () => console.log(`✅ Server listo en http://localhost:${PORT}`))
