// ─── Single source of truth para configuración del template ───────────────────
// Cloná este template → editá este archivo → 80% de la customización lista.

export const appConfig = {
  // ── Branding ─────────────────────────────────────────────────────────────
  APP_NAME: 'PORTE',
  APP_TAGLINE: 'Gestión comercial y financiera de ventas',
  LOGO_URL: '/logo.svg',

  // ── Entidad principal del negocio ────────────────────────────────────────
  ENTITY_NAME_SINGULAR: 'Venta',
  ENTITY_NAME_PLURAL: 'Ventas',

  // ── Links externos ───────────────────────────────────────────────────────
  WHATSAPP_URL: 'https://wa.me/',
  SUPPORT_EMAIL: '',
  INSTAGRAM_URL: '',
  LINKEDIN_URL: '',

  // ── Roles (labels visuales) ───────────────────────────────────────────────
  ROLES: {
    admin:     'Administrador',
    dataEntry: 'Carga de datos',
  } as const,

  // ── Demo mode ────────────────────────────────────────────────────────────
  // false: login real contra Supabase Auth. El selector de rol en RealLogin
  // queda como referencia visual — el rol real viene de profiles.role.
  DEMO_MODE: false,

  // ── BI Charts embebidos ───────────────────────────────────────────────────
  BI_CHARTS: [] as const,

  // ── Feature flags ────────────────────────────────────────────────────────
  FEATURES: {
    NOTIFICATIONS:       true,
    DARK_MODE:           true,
    PWA_INSTALL_PROMPT:  true,
    BIOMETRIC_LOGIN:     false,
    AI_CHAT:             false,
  },
} as const

export type Role = keyof typeof appConfig.ROLES
export type BIChartId = (typeof appConfig.BI_CHARTS)[number]['id']
