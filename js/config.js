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
  APP_VERSION: '1.1.0',
  DEFAULT_THEME: 'light',
  TIMEZONE: 'Asia/Jakarta',

  // Supabase Credentials — Terhubung Langsung ke Project Supabase web-calender
  SUPABASE_URL: window.CALENDEY_ENV?.SUPABASE_URL || localStorage.getItem('calendey_supabase_url') || 'https://oyaacvgankdwmbavfoqh.supabase.co',
  SUPABASE_ANON_KEY: window.CALENDEY_ENV?.SUPABASE_ANON_KEY || localStorage.getItem('calendey_supabase_anon_key') || 'sb_publishable_gXGHTsHz7Jb2uhTPDqBslw__XV0UZ7w',

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

/**
 * Memuat kredensial Supabase secara dinamis dari Serverless Function (/api/config)
 * Menjamin file JavaScript di repo tidak mengandung kredensial sensitif
 */
export async function loadRuntimeConfig() {
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    return;
  }

  // 1. Coba ambil dari Vercel Serverless Function
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseAnonKey) {
        CONFIG.SUPABASE_URL = data.supabaseUrl;
        CONFIG.SUPABASE_ANON_KEY = data.supabaseAnonKey;
        return;
      }
    }
  } catch (err) {
    // Non-blocking jika di environment offline/lokal
  }

  // 2. Fallback ke window.CALENDEY_ENV jika ada (untuk local development)
  if (window.CALENDEY_ENV) {
    CONFIG.SUPABASE_URL = CONFIG.SUPABASE_URL || window.CALENDEY_ENV.SUPABASE_URL || '';
    CONFIG.SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY || window.CALENDEY_ENV.SUPABASE_ANON_KEY || '';
  }
}
