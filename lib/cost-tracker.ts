import { supabaseAdmin } from './supabase'

// Cost constants
const ENSEMBLE_UNIT_COST = 0.001 // Overage USD/unit (0 if within quota)
const USER_INFO_UNITS = 3

export interface CostLog {
  sessionId: string
  api: 'ensemble'
  endpoint?: string
  units?: number
  cost: number
}

export async function logCost(log: CostLog): Promise<void> {
  if (!supabaseAdmin) {
    console.warn('[WARN] supabaseAdmin not available, skipping cost logging')
    return
  }

  try {
    await supabaseAdmin.from('api_usage_logs').insert({
      session_id: log.sessionId,
      api: log.api,
      endpoint: log.endpoint,
      units: log.units,
      cost_usd: log.cost,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to log cost:', error)
    // Don't throw - cost logging shouldn't break the app
  }
}

export function calculateEnsembleCost(units: number): number {
  return units * ENSEMBLE_UNIT_COST
}

export { USER_INFO_UNITS }

