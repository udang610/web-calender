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

  deduplicatePlans(items) {
    if (!Array.isArray(items)) return [];
    const seenIds = new Set();
    const seenTitleDate = new Set();
    const unique = [];

    for (const item of items) {
      if (!item) continue;
      const id = String(item.id || '').trim();
      const title = String(item.title || '').trim().toLowerCase();
      const date = String(item.planned_date || '').trim();
      const key = `${title}:::${date}`;

      if (id && seenIds.has(id)) continue;
      if (title && date && seenTitleDate.has(key)) continue;

      if (id) seenIds.add(id);
      if (title && date) seenTitleDate.add(key);
      unique.push(item);
    }
    return unique;
  }

  async loadContentPlans() {
    try {
      const user = state.get('user');
      const userId = user?.id || null;

      let deletedIds = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem('calendey_deleted_plan_ids') || '[]');
      } catch (e) {
        deletedIds = [];
      }

      const isDemoPlan = (p) => {
        if (!p) return false;
        return p.id === 'plan-sumpah-pemuda-demo' ||
               p.id === 'c7e8d644-8d99-4c91-b3b4-56789abcdef0' ||
               (typeof p.title === 'string' && p.title.toLowerCase().includes('poster hari sumpah pemuda 2026'));
      };

      const isValidPlan = (p) => {
        if (!p || !p.id) return false;
        if (deletedIds.includes(p.id)) return false;
        if (isDemoPlan(p)) return false;
        // Isolasi kepemilikan konten per pengguna (User Multi-Tenant)
        if (userId) {
          // Jika konten memiliki user_id yang berbeda dengan user aktif, sembunyikan
          if (p.user_id && p.user_id !== userId) return false;
          // Konten tanpa user_id (dibuat di awal sebelum multi-user) dianggap milik Superadmin
          if (!p.user_id && userId !== '3c72477c-5c56-44a8-91aa-8cfd1367db06' && user?.username?.toLowerCase() !== 'superadmin') {
            return false;
          }
        }
        return true;
      };

      // 1. Ambil dari cache local storage terisolasi per akun pengguna
      const userCacheKey = userId ? `calendey_plans_cache_${userId}` : 'calendey_plans_cache';
      const cached = localStorage.getItem(userCacheKey) || localStorage.getItem('calendey_plans_cache');
      let initialPlans = [];
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const validCached = (parsed || []).filter(isValidPlan);
          initialPlans = this.deduplicatePlans(validCached);
        } catch (e) {
          initialPlans = [];
        }
      }
      state.set('contentPlans', initialPlans);

      // 2. Sinkronkan dari Supabase terisolasi dengan filter user_id aktif (hanya jika user_id berupa UUID valid)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id || '');
      if (this.isCloudConnected && user && isUUID) {
        this.client
          .from('content_plans')
          .select('*, content_assets(*), reminders(*)')
          .eq('user_id', user.id)
          .order('planned_date', { ascending: true })
          .then(({ data, error }) => {
            if (!error && data) {
              const validCloud = (data || []).filter(isValidPlan);
              const cleaned = this.deduplicatePlans(validCloud);
              state.set('contentPlans', cleaned);
              localStorage.setItem(userCacheKey, JSON.stringify(cleaned));
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('[Calendey DB] Gagal memuat rencana konten:', err);
    }
  }

  async saveContentPlan(planData, isToggle = false) {
    try {
      const plans = state.get('contentPlans') || [];

      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Cari index rencana yang ada berdasarkan id ATAU kesamaan judul & tanggal pelaksanaan
      const existingIndex = plans.findIndex(p => {
        if (planData.id && p.id === planData.id) return true;
        if (p.title && planData.title && p.planned_date && planData.planned_date) {
          return p.title.trim().toLowerCase() === planData.title.trim().toLowerCase() &&
                 p.planned_date === planData.planned_date;
        }
        return false;
      });

      const isEdit = existingIndex !== -1;
      let updatedPlans;
      let finalPlan;

      const user = state.get('user');
      const userId = user?.id || null;

      if (isEdit) {
        const existing = plans[existingIndex];
        const validId = (existing.id && !String(existing.id).startsWith('plan-'))
          ? existing.id
          : (planData.id && !String(planData.id).startsWith('plan-') ? planData.id : generateUUID());

        finalPlan = {
          ...existing,
          ...planData,
          id: validId,
          user_id: existing.user_id || userId,
          updated_at: new Date().toISOString()
        };
        updatedPlans = [...plans];
        updatedPlans[existingIndex] = finalPlan;
      } else {
        const newId = planData.id && !String(planData.id).startsWith('plan-') ? planData.id : generateUUID();
        finalPlan = {
          ...planData,
          id: newId,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_assets: planData.content_assets || []
        };
        updatedPlans = [finalPlan, ...plans];
      }

      // Pastikan list konten selalu terbebas dari duplikasi
      updatedPlans = this.deduplicatePlans(updatedPlans);
      state.set('contentPlans', updatedPlans);
      
      const userCacheKey = userId ? `calendey_plans_cache_${userId}` : 'calendey_plans_cache';
      try {
        localStorage.setItem(userCacheKey, JSON.stringify(updatedPlans));
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
          localStorage.setItem(userCacheKey, JSON.stringify(lightweight));
        } catch (e2) {
          console.warn('[Calendey DB] Stored in active runtime state:', e2);
        }
      }

      // Sinkronkan ke Supabase Cloud (content_plans & reminders)
      const user = state.get('user');
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id || '');
      if (this.isCloudConnected && user && isUUID) {
        try {
          const planPayload = {
            id: finalPlan.id,
            user_id: user.id,
            title: finalPlan.title,
            caption: finalPlan.caption || null,
            notes: finalPlan.notes || null,
            platforms: finalPlan.platforms || [],
            planned_date: finalPlan.planned_date,
            scheduled_at: finalPlan.scheduled_at || null,
            status: finalPlan.status || 'idea',
            design_done: Boolean(finalPlan.design_done),
            is_posted: Boolean(finalPlan.is_posted),
            posted_at: finalPlan.posted_at || null,
            national_day_id: finalPlan.national_day_id || null,
            updated_at: new Date().toISOString()
          };

          this.client.from('content_plans').upsert(planPayload).then(async ({ error: planErr }) => {
            if (planErr) {
              console.warn('[Calendey DB] Upsert content_plan notice:', planErr);
              return;
            }

            // Otomatisasi Jadwal Reminder WhatsApp ke tabel public.reminders
            const isReminderActive = finalPlan.reminder_enabled !== false;
            const isPosted = finalPlan.is_posted === true || finalPlan.status === 'posted';

            if (isReminderActive && !isPosted && finalPlan.planned_date) {
              const offsetDays = parseInt(finalPlan.remind_offset_days ?? user.default_remind_offset_days ?? 1, 10);
              const targetDate = new Date(finalPlan.planned_date + 'T00:00:00');
              targetDate.setDate(targetDate.getDate() - offsetDays);

              const timeStr = finalPlan.remind_time || user.default_remind_time || '09:00';
              const [hh, mm] = timeStr.split(':');
              const yyyy = targetDate.getFullYear();
              const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
              const dayStr = String(targetDate.getDate()).padStart(2, '0');
              const hourStr = String(hh || '09').padStart(2, '0');
              const minuteStr = String(mm || '00').padStart(2, '0');
              const remindAtIso = `${yyyy}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:00+07:00`;

              const { data: existingReminders } = await this.client
                .from('reminders')
                .select('id')
                .eq('content_plan_id', finalPlan.id)
                .limit(1);

              const reminderData = {
                content_plan_id: finalPlan.id,
                user_id: user.id,
                remind_at: remindAtIso,
                channel: 'whatsapp',
                status: 'pending'
              };

              if (existingReminders && existingReminders.length > 0) {
                await this.client
                  .from('reminders')
                  .update(reminderData)
                  .eq('id', existingReminders[0].id);
              } else {
                await this.client
                  .from('reminders')
                  .insert(reminderData);
              }
              console.log('[Calendey DB] Pengingat otomatis WA berhasil dijadwalkan:', remindAtIso);
            } else if (!isReminderActive || isPosted) {
              // Jika pengingat dinonaktifkan atau konten sudah posted, set status cancelled
              await this.client
                .from('reminders')
                .update({ status: 'cancelled' })
                .eq('content_plan_id', finalPlan.id);
            }
          }).catch(err => {
            console.warn('[Calendey DB] Cloud plan sync error:', err);
          });
        } catch (cloudErr) {
          console.warn('[Calendey DB] Cloud sync ignored:', cloudErr);
        }
      }

      if (isToggle) {
        notify.success(planData.is_posted ? 'Konten ditandai telah diposting!' : 'Status progres konten diperbarui!');
      } else {
        notify.success(isEdit ? 'Rencana konten berhasil diperbarui!' : 'Rencana konten baru berhasil dibuat!');
      }
      return finalPlan;
    } catch (err) {
      console.error('[Calendey DB] Gagal menyimpan rencana konten:', err);
      notify.error('Gagal menyimpan data rencana konten');
      return null;
    }
  }

  async deleteContentPlan(planId) {
    try {
      const user = state.get('user');
      const userId = user?.id;
      const userCacheKey = userId ? `calendey_plans_cache_${userId}` : 'calendey_plans_cache';

      const plans = state.get('contentPlans') || [];
      const filtered = plans.filter(p => p.id !== planId);
      state.set('contentPlans', filtered);
      localStorage.setItem(userCacheKey, JSON.stringify(filtered));

      // Catat ID ke daftar terhapus agar tidak pernah dimuat ulang dari cache/cloud lama
      let deletedIds = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem('calendey_deleted_plan_ids') || '[]');
      } catch (e) {
        deletedIds = [];
      }
      if (!deletedIds.includes(planId)) {
        deletedIds.push(planId);
        localStorage.setItem('calendey_deleted_plan_ids', JSON.stringify(deletedIds));
      }

      if (this.isCloudConnected) {
        try {
          const isPlanUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId || '');
          if (isPlanUUID) {
            await this.client.from('reminders').delete().eq('content_plan_id', planId);
            await this.client.from('content_plans').delete().eq('id', planId);
            console.log('[Calendey DB] Sukses menghapus konten dari Supabase:', planId);
          }
        } catch (cloudErr) {
          console.warn('[Calendey DB] Catatan cloud delete:', cloudErr);
        }
      }

      notify.info('Rencana konten telah dihapus');
      return true;
    } catch (err) {
      console.error('[Calendey DB] Gagal menghapus konten:', err);
      notify.error('Gagal menghapus konten');
      return false;
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

    await this.saveContentPlan(plan, true);
  }
}

export const db = new DatabaseService();
