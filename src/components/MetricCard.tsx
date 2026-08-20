import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'motion/react'

interface MetricCardProps {
  label: string
  value: string | number
  change?: string
  positive?: boolean
  Icon?: LucideIcon
  gradient?: string
  onClick?: () => void
}

export function MetricCard({ label, value, change, positive, Icon, gradient = 'from-primary to-accent', onClick }: MetricCardProps) {
  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 text-white shadow-md ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
          {/* Montos financieros grandes (ej. "$ 39.000.000,00") no entran en
              una sola línea en una tarjeta de mobile en grid-cols-2 —
              `truncate` los cortaba con "..." haciéndolos ilegibles. Se
              prioriza que el valor completo sea legible sobre mantenerlo en
              una sola línea. */}
          <p className="text-xl md:text-2xl font-bold leading-tight break-words">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-1">
              {positive !== undefined && (
                positive
                  ? <TrendingUp className="w-3 h-3 text-white/80" />
                  : <TrendingDown className="w-3 h-3 text-white/80" />
              )}
              <p className="text-white/70 text-xs">{change}</p>
            </div>
          )}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 ml-2">
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
    </motion.div>
  )
}
