// ========================================================================
// CALENDEY — Configuration & Global Constants
// Database Supabase Aktif Langsung
// ========================================================================

// Auto-cleanup stale project references if previously stored
if (localStorage.getItem('calendey_supabase_url')?.includes('onikjvzk')) {
  localStorage.removeItem('calendey_supabase_url');
  localStorage.removeItem('calendey_supabase_anon_key');
}

export const CONFIG = {
  APP_NAME: 'Calendey',
  APP_VERSION: '1.0.3',
  DEFAULT_THEME: 'light',
  TIMEZONE: 'Asia/Jakarta',

  // Supabase Credentials — Aktif Terhubung ke Supabase web-calender (udang610)
  SUPABASE_URL: 'https://oyaacvgankdwmbavfoqh.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_gXGHTsHz7Jb2uhTPDqBslw__XV0UZ7w',

  // Limits & Validations (Sesuai PRD)
  MAX_UPLOAD_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_ASSETS_PER_PLAN: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],

  // Master Categories
  CATEGORIES: [
    { id: 1, name: 'Hari Nasional', slug: 'hari-nasional', color_hex: '#ef4444', icon: 'flag' },
    { id: 2, name: 'Hari Bersejarah', slug: 'hari-bersejarah', color_hex: '#f97316', icon: 'hourglass-medium' },
    { id: 3, name: 'Hari Keagamaan', slug: 'hari-keagamaan', color_hex: '#10b981', icon: 'hands-praying' },
    { id: 4, name: 'Hari Perjuangan', slug: 'hari-perjuangan', color_hex: '#3b82f6', icon: 'sword' },
    { id: 5, name: 'Hari Peringatan Khusus', slug: 'hari-peringatan-khusus', color_hex: '#8b5cf6', icon: 'sparkle' }
  ],

  // Platform Options
  PLATFORMS: [
    { id: 'instagram', name: 'Instagram', icon: 'instagram-logo' },
    { id: 'tiktok', name: 'TikTok', icon: 'tiktok-logo' },
    { id: 'whatsapp_status', name: 'WhatsApp Status', icon: 'whatsapp-logo' },
    { id: 'facebook', name: 'Facebook', icon: 'facebook-logo' },
    { id: 'x', name: 'X (Twitter)', icon: 'x-logo' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin-logo' }
  ],

  // Status Alur Kerja
  STATUSES: {
    IDEA: { id: 'idea', label: 'Ide Baru', badgeClass: 'idea' },
    DESIGN_DONE: { id: 'design_done', label: 'Desain Dibuat', badgeClass: 'design_done' },
    READY: { id: 'ready', label: 'Siap Posting', badgeClass: 'ready' },
    POSTED: { id: 'posted', label: 'Sudah Diposting', badgeClass: 'posted' }
  }
};
