
/**
 * Contrato de tarea (referencia)
 * {
 *   task_id: string,
 *   agent: 'implementer' | 'tester' | 'architect' | 'coordinator',
 *   title: string,
 *   context?: string,
 *   inputs?: object,
 *   acceptance_criteria?: string[],
 *   dependencies?: string[],
 *   callback_url?: string,
 *   meta?: { priority?: 'P1'|'P2'|'P3', due?: string }
 * }
 */
export const TaskSpecDoc = {}
