import { QueryClient } from '@tanstack/react-query'

// staleTime: 0 (default) es intencional — stale-while-revalidate: cada
// entidad muestra su cache al instante al montarse/volver a foco y dispara un
// refetch en paralelo en segundo plano, sin bloquear la UI. refetchOnWindowFocus
// (default true) solo refetchea queries con un observer activo, así que el
// resync al volver a la pestaña nunca trae entidades que el usuario no visitó.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
    },
  },
})
