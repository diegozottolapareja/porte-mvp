import { ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { StatusBadge } from './StatusBadge'

export interface EntityCardField {
  label: string
  value: string | number | undefined
  highlight?: boolean
}

interface EntityCardProps {
  title: string
  subtitle?: string
  fields?: EntityCardField[]
  badge?: { value: number; emptyLabel?: string }
  status?: { label: string; color: string; bgColor: string }
  statusNode?: React.ReactNode
  onClick?: () => void
  actions?: React.ReactNode
  className?: string
}

export function EntityCard({ title, subtitle, fields, badge, status, statusNode, onClick, actions, className = '' }: EntityCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl shadow-sm border border-border overflow-hidden ${className}`}
    >
      <div
        className={`p-4 ${onClick ? 'cursor-pointer active:bg-gray-50 transition-colors' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
              {statusNode ?? (status && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color} ${status.bgColor}`}>
                  {status.label}
                </span>
              ))}
            </div>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge !== undefined && <StatusBadge value={badge.value} emptyLabel={badge.emptyLabel} />}
            {onClick && <ChevronRight className="w-4 h-4 text-gray-400" />}
          </div>
        </div>

        {fields && fields.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {fields.map(({ label, value, highlight }) => (
              <div key={label}>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className={`text-sm font-medium ${highlight ? 'text-primary' : 'text-gray-800'}`}>
                  {value ?? '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {actions && (
        <div className="px-4 py-3 border-t border-border bg-gray-50/50 flex items-center gap-2">
          {actions}
        </div>
      )}
    </motion.div>
  )
}
