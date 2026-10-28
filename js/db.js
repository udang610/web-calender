// ========================================================================
// CALENDEY — Database & Storage Layer (Optimized Instant Boot & Supabase)
// ========================================================================

import { CONFIG } from './config.js';
import { state } from './state.js';
import { notify } from './notifications.js';

class DatabaseService {
  constructor() {
    this.client = null;
    this.isCloudConnected = false;
  }

  async init() {
    // 1. Inisialisasi Supabase Client jika kredensial ada
    if (window.supabase && CONFIG.SUPABASE_URL) {
      try {
        this.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        this.isCloudConnected = true;
      } catch (err) {
        console.warn('[Calendey DB] Supabase init warning:', err);
      }
    }

    // 2. Load data secara instan paralel tanpa blocking UI
    await Promise.all([
      this.loadNationalDays(),
      this.loadContentPlans()
    ]);
  }

  async loadNationalDays() {
    try {
      // Prioritaskan instant fetch dari file lokal agar UI langsung muncul cepat tanpa delay
      const res = await fetch('data/national_days.json');
      const staticDays = await res.json();
      state.set('nationalDays', staticDays);

      // Sinkronkan update di background jika cloud terhubung
      if (this.isCloudConnected) {
        this.client
          .from('national_days')
          .select('*, categories(*)')
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              state.set('nationalDays', data);
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('[Calendey DB] Gagal memuat data hari nasional:', err);
    }
  }

  async loadContentPlans() {
    try {
      // 1. Ambil dari cache local storage secara instan
      const cached = localStorage.getItem('calendey_plans_cache');
      if (cached) {
        state.set('contentPlans', JSON.parse(cached));
      } else {
        const samplePlans = [
          {
            id: 'plan-sumpah-pemuda-demo',
            title: 'Poster Hari Sumpah Pemuda 2026',
            national_day_id: 27,
            planned_date: '2026-10-28',
            scheduled_at: '2026-10-28T08:00:00Z',
            platforms: ['instagram', 'tiktok', 'whatsapp_status'],
            status: 'ready',
            design_done: true,
            is_posted: false,
            caption: 'Bersatu dalam keberagaman! Selamat Hari Sumpah Pemuda 2026. Kobarkan semangat persatuan generasi penerus bangsa! 🇮🇩✨\n\n#SumpahPemuda #IndonesiaMaju #HariNasional',
            notes: 'Desain format potret 4:5 untuk feed Instagram dan TikTok carousel.',
            content_assets: []
          }
        ];
        state.set('contentPlans', samplePlans);
        localStorage.setItem('calendey_plans_cache', JSON.stringify(samplePlans));
      }

      // 2. Sinkronkan dari Supabase jika user sedang login (asynchronous tanpa blocking UI)
      if (this.isCloudConnected && state.get('user')) {
        this.client
          .from('content_plans')
          .select('*, content_assets(*), reminders(*)')
          .order('planned_date', { ascending: true })
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              state.set('contentPlans', data);
              localStorage.setItem('calendey_plans_cache', JSON.stringify(data));
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('[Calendey DB] Gagal memuat rencana konten:', err);
    }
  }

  async saveContentPlan(planData) {
    try {
      const plans = state.get('contentPlans') || [];
      const isEdit = Boolean(planData.id);
      let updatedPlans;
      let finalPlan;

      if (isEdit) {
        finalPlan = {
          ...plans.find(p => p.id === planData.id),
          ...planData,
          updated_at: new Date().toISOString()
        };
        updatedPlans = plans.map(p => p.id === planData.id ? finalPlan : p);
      } else {
        finalPlan = {
          ...planData,
          id: 'plan-' + Date.now(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_assets: planData.content_assets || []
        };
        updatedPlans = [finalPlan, ...plans];
      }

      state.set('contentPlans', updatedPlans);
      
      try {
        localStorage.setItem('calendey_plans_cache', JSON.stringify(updatedPlans));
      } catch (storageErr) {
        console.warn('[Calendey DB] LocalStorage quota reached, saving lightweight plan metadata:', storageErr);
        try {
          const lightweight = updatedPlans.map(p => ({
            ...p,
            content_assets: (p.content_assets || []).map(a => ({
              id: a.id,
              file_name: a.file_name,
              mime_type: a.mime_type,
              file_size: a.file_size,
              storage_path: a.storage_path?.length > 150 ? a.storage_path.slice(0, 80) : a.storage_path
            }))
          }));
          localStorage.setItem('calendey_plans_cache', JSON.stringify(lightweight));
        } catch (e2) {
          console.warn('[Calendey DB] Stored in active runtime state:', e2);
        }
      }

      // Sinkronkan ke cloud secara asynchronous tanpa blocking
      if (this.isCloudConnected && state.get('user')) {
        try {
          const payload = { ...finalPlan };
          delete payload.content_assets;
          delete payload.reminders;
          this.client.from('content_plans').upsert(payload).then(() => {}).catch(err => {
            console.warn('[Calendey DB] Cloud upsert skipped:', err);
          });
        } catch (cloudErr) {
          console.warn('[Calendey DB] Cloud sync ignored:', cloudErr);
        }
      }

      notify.success(isEdit ? 'Rencana konten berhasil diperbarui!' : 'Rencana konten baru berhasil dibuat!');
      return finalPlan;
    } catch (err) {
      console.error('[Calendey DB] Gagal menyimpan rencana konten:', err);
      notify.error('Gagal menyimpan data rencana konten');
      return null;
    }
  }

  async deleteContentPlan(planId) {
    try {
      const plans = state.get('contentPlans') || [];
      const filtered = plans.filter(p => p.id !== planId);
      state.set('contentPlans', filtered);
      localStorage.setItem('calendey_plans_cache', JSON.stringify(filtered));

      if (this.isCloudConnected && state.get('user')) {
        this.client.from('content_plans').delete().eq('id', planId).catch(() => {});
      }

      notify.info('Rencana konten telah dihapus');
    } catch (err) {
      console.error('[Calendey DB] Gagal menghapus konten:', err);
      notify.error('Gagal menghapus konten');
    }
  }

  async toggleChecklist(planId, field) {
    const plans = state.get('contentPlans') || [];
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    const newValue = !plan[field];
    plan[field] = newValue;

    if (field === 'is_posted') {
      if (newValue) {
        plan.status = 'posted';
        plan.posted_at = new Date().toISOString();
      } else {
        plan.status = plan.design_done ? 'ready' : 'idea';
        plan.posted_at = null;
      }
    } else if (field === 'design_done') {
      if (newValue && plan.status === 'idea') {
        plan.status = 'design_done';
      } else if (!newValue && plan.status !== 'posted') {
        plan.status = 'idea';
      }
    }

    await this.saveContentPlan(plan);
  }
}

export const db = new DatabaseService();
