import 'dotenv/config'
import { Redis } from '@upstash/redis'
import fs from 'node:fs'
import path from 'node:path'

// --- Args helpers ------------------------------------------------------------
const rawArgs = process.argv.slice(2)
const argv = Object.fromEntries(
  rawArgs
    .map((a, i) => {
      if (!a.startsWith('--')) return null
      if (a.includes('=')) {
        const [k, ...rest] = a.slice(2).split('=')
        return [k, rest.join('=')]
      }
      const next = rawArgs[i + 1]
      return [a.slice(2), next && !next.startsWith('--') ? next : true]
    })
    .filter(Boolean)
)
const getArg = (name, def = null) => (argv[name] ?? def)

// --- Config ------------------------------------------------------------------
const file = getArg('file', 'templates/PRD.md')
const prefix = getArg('prefix', 'FEAT')
const agent = getArg('agent', process.env.DISPATCH_AGENT || 'implementer')
const callbackUrl = getArg('callback', process.env.CALLBACK_URL || 'http://localhost:3000/callback')
const limit = parseInt(getArg('limit', 0), 10) || 0
const dry = !!getArg('dry', false)

const redis = Redis.fromEnv()

// --- Cargar PRD --------------------------------------------------------------
const raw = fs.readFileSync(path.resolve(file), 'utf8').replace(/\r\n/g, '\n')

// Extrae una sección por título (tolerante a numeración “## 5. …”)
function sectionByTitle(titles) {
  const arr = Array.isArray(titles) ? titles : [titles]
  for (const title of arr) {
    const safe = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^##\\s*\\d*\\.?\\s*${safe}\\s*$`, 'mi')
    const m = raw.match(re)
    if (m) {
      const start = m.index + m[0].length
      const rest = raw.slice(start)
      const next = rest.search(/^##\s/m)
      const body = next === -1 ? rest : rest.slice(0, next)
      return body.trim()
    }
  }
  return ''
}

// Saca bullets (-, *, 1.) y limpia checkboxes
function bullets(text) {
  if (!text) return []
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(-|\*|\d+\.)\s/.test(l))
    .map((l) => l.replace(/^(-|\*|\d+\.)\s*\[?\s?[xX ]?\]?\s*/, '').trim())
    .filter(Boolean)
}

// --- Secciones relevantes ----------------------------------------------------
const resumen = sectionByTitle(['Resumen Ejecutivo', 'Resumen'])
const critAcept = sectionByTitle(['Criterios de Aceptación', 'Criterios de Aceptacion', 'Criterios de Aceptación (QA)'])
const reqFunc = sectionByTitle(['Requisitos Funcionales', 'Requerimientos Funcionales'])
const debeIncluir = sectionByTitle(['Debe incluir (MVP)', 'Debe incluir', '3.1 Debe incluir (MVP)', 'MVP', 'Backlog inicial'])

const acceptance = bullets(critAcept)
let featuresRaw = [...bullets(reqFunc), ...bullets(debeIncluir)]

// Validación
if (featuresRaw.length === 0) {
  console.log('No encontré bullets en "Requisitos Funcionales" ni en "Debe incluir". Revisa el PRD.')
  process.exit(1)
}

// Dedupe
const seen = new Set()
featuresRaw = featuresRaw.filter((t) => {
  const k = t.toLowerCase().replace(/\s+/g, ' ').trim()
  if (seen.has(k)) return false
  seen.add(k)
  return true
})
if (limit > 0) featuresRaw = featuresRaw.slice(0, limit)

// Construcción de tareas
const tasks = featuresRaw.map((t, i) => {
  const priMatch = t.match(/\[(P[123])\]/i)
  const priority = priMatch ? priMatch[1].toUpperCase() : 'P2'
  const title = t.replace(/\[(P[123])\]/gi, '').trim().replace(/\s{2,}/g, ' ')
  return {
    task_id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
    agent,
    title,
    context: resumen ? resumen.slice(0, 800) : undefined,
    acceptance_criteria: acceptance,
    callback_url: callbackUrl,
    meta: { priority }
  }
})

// Modo dry: imprime JSON y termina
if (dry) {
  console.log(JSON.stringify(tasks, null, 2))
  process.exit(0)
}

// Encolar en Redis
for (const task of tasks) {
  await redis.rpush(`queue:${task.agent}`, JSON.stringify(task))
  console.log('📬 Encolada', task.task_id, '-', task.title, `[${task.meta.priority}]`)
}
console.log(`\nListo. ${tasks.length} tareas encoladas para ${agent}.`)
