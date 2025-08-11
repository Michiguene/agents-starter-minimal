import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { fetch } from 'undici'

const redis = Redis.fromEnv()
const QUEUE = 'queue:tester'

async function processOne() {
  const raw = await redis.lpop(QUEUE)
  if (!raw) return false
  const task = (typeof raw === 'string') ? JSON.parse(raw) : raw

  // Simula pruebas
  const result = {
    task_id: task.task_id,
    agent: 'tester',
    status: 'done',
    notes: 'QA ok: 20/20 casos e2e',
    output: { report_url: 'https://example.com/report/123' }
  }

  if (task.callback_url) {
    await fetch(task.callback_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result)
    })
  }
  console.log('🧪 Tester procesó', task.task_id)
  return true
}

async function loop() {
  console.log('🧪 Worker tester corriendo... (Ctrl+C para parar)')
  while (true) {
    const did = await processOne()
    if (!did) await new Promise(r => setTimeout(r, 2000))
  }
}
loop().catch(e => { console.error(e); process.exit(1) })
