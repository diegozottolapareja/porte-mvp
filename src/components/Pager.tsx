interface PagerProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export function Pager({ page, totalPages, onChange }: PagerProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between pt-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-xl border border-border text-sm text-muted-foreground disabled:opacity-40"
      >
        Anterior
      </button>
      <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-xl border border-border text-sm text-muted-foreground disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  )
}
