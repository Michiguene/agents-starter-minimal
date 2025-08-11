
import 'dotenv/config'
import { Redis } from '@upstash/redis'
import { fetch } from 'undici'

const redis = Redis.fromEnv()
const QUEUE = 'queue:implementer'

async function processOne() {
  const raw = await redis.lpop(QUEUE)
  if (!raw) return false

  // Soporta string u objeto (según SDK/versión)
  const task = (typeof raw === 'string') ? JSON.parse(raw) : raw

  // Simula trabajo real
  const result = {
    task_id: task.task_id,
    agent: 'implementer',
    status: 'done',
    notes: 'Simulación: PR #45 creado',
    output: { pr_url: 'https://github.com/tu-org/tu-repo/pull/45' }
  }

  if (task.callback_url) {
    await fetch(task.callback_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result)
    })
  }
  console.log('✅ Procesada', task.task_id)
  return true
}

async function loop() {
  console.log('👷 Worker implementer corriendo... (Ctrl+C para parar)')
  while (true) {
    const did = await processOne()
    if (!did) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}

loop().catch(e => {
  console.error(e)
  process.exit(1)
})
