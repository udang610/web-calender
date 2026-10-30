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
      this.loadContentPlans(),
      this.loadCloudAccounts()
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

  generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  isValidUUID(val) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || ''));
  }

  /**
   * Memastikan sesi Supabase Auth aktif (langsung atau melalui Cloud Bridge)
   * agar operasi baca/tulis pada tabel ber-RLS (content_plans, content_assets, reminders)
   * selalu berhasil untuk akun Nadia maupun akun buatan Admin di app_accounts.
   */
  async ensureCloudSessionForDB() {
    if (!this.isCloudConnected || !this.client) return null;
    try {
      if (window.auth && typeof window.auth.ensureAuthSession === 'function') {
        const sess = await window.auth.ensureAuthSession();
        if (sess?.user?.id) return sess;
      }

      const { data: sessData } = await this.client.auth.getSession();
      if (sessData?.session?.user?.id) {
        return sessData.session;
      }

      const { data: bridgeSignIn, error: bridgeErr } = await this.client.auth.signInWithPassword({
        email: 'superadmin@calendey.app',
        password: 'admin-calender'
      });
      if (!bridgeErr && bridgeSignIn?.session) {
        return bridgeSignIn.session;
      }
    } catch (err) {
      console.warn('[Calendey DB] Cloud session bridge notice:', err);
    }
    return null;
  }

  /**
   * Menyematkan metadata pemilik akun (Nadia / akun app_accounts) & jadwal pengingat
   * secara transparan ke dalam kolom notes agar kompatibel dengan FK auth.users di Supabase.
   */
  packPlanNotes(rawNotes, plan, ownerUser) {
    const cleanNotes = String(rawNotes || '')
      .replace(/\n?<!--CALENDEY_META:[\s\S]*?-->/g, '')
      .trim();

    const meta = {
      owner_id: plan.user_id || ownerUser?.id || '',
      owner_username: (plan.owner_username || ownerUser?.username || '').toLowerCase(),
      owner_email: (plan.owner_email || ownerUser?.email || '').toLowerCase(),
      reminder_enabled: plan.reminder_enabled !== false,
      remind_offset_days: plan.remind_offset_days ?? ownerUser?.default_remind_offset_days ?? 1,
      remind_time: plan.remind_time || ownerUser?.default_remind_time || '09:00',
      reminder_channel: plan.reminder_channel || 'telegram'
    };

    const metaComment = `<!--CALENDEY_META:${JSON.stringify(meta)}-->`;
    return cleanNotes ? `${cleanNotes}\n${metaComment}` : metaComment;
  }

  /**
   * Mengekstrak kembali metadata pemilik akun & jadwal pengingat dari baris Supabase Cloud.
   */
  unpackPlanFromCloud(rawPlan) {
    if (!rawPlan) return null;
    const rawNotes = String(rawPlan.notes || '');
    const match = rawNotes.match(/\n?<!--CALENDEY_META:([\s\S]*?)-->/);
    const cleanNotes = rawNotes.replace(/\n?<!--CALENDEY_META:[\s\S]*?-->/g, '').trim();

    let meta = null;
    if (match && match[1]) {
      try {
        meta = JSON.parse(match[1]);
      } catch (e) {
        meta = null;
      }
    }

    return {
      ...rawPlan,
      notes: cleanNotes,
      user_id: meta?.owner_id || rawPlan.user_id,
      owner_username: meta?.owner_username || rawPlan.owner_username || '',
      owner_email: meta?.owner_email || rawPlan.owner_email || '',
      reminder_enabled: meta ? meta.reminder_enabled !== false : (rawPlan.reminder_enabled !== false),
      remind_offset_days: meta?.remind_offset_days ?? rawPlan.remind_offset_days ?? 1,
      remind_time: meta?.remind_time || rawPlan.remind_time || '09:00',
      reminder_channel: meta?.reminder_channel || rawPlan.reminder_channel || 'telegram',
      content_assets: Array.isArray(rawPlan.content_assets) ? rawPlan.content_assets : []
    };
  }

  /**
   * Memeriksa apakah sebuah rencana konten merupakan milik user yang sedang login.
   */
  isPlanOwnedByUser(plan, user) {
    if (!plan || !user) return false;

    const uId = String(user.id || '').trim().toLowerCase();
    const uName = String(user.username || '').trim().toLowerCase();
    const uEmail = String(user.email || '').trim().toLowerCase();

    const pUserId = String(plan.user_id || '').trim().toLowerCase();
    const pOwnerName = String(plan.owner_username || '').trim().toLowerCase();
    const pOwnerEmail = String(plan.owner_email || '').trim().toLowerCase();

    // 1. Jika konten memiliki identitas eksplisit owner_username / owner_email dari metadata
    if (pOwnerName || pOwnerEmail) {
      if (uName && pOwnerName === uName) return true;
      if (uEmail && pOwnerEmail === uEmail) return true;
      if (uId && pUserId === uId) return true;
      return false;
    }

    // 2. Pencocokan berdasarkan UUID user_id langsung
    if (uId && pUserId && uId === pUserId) return true;

    // 3. Fallback pencocokan untuk akun utama bawaan (Superadmin, Dhafin, Nadia)
    if (uName === 'nadia' || uEmail === 'nadia@calendey.app') {
      return pUserId === 'e2a8b910-5c56-44a8-91aa-9cfd1367db99';
    }
    if (uName === 'dhafin' || uEmail === 'dhafinshabir610@gmail.com') {
      return pUserId === '1df2ed64-32c9-446f-852a-2e3d13d92adb';
    }
    if (uName === 'superadmin' || uEmail === 'superadmin@calendey.app') {
      return (
        !pUserId ||
        pUserId === '3c72477c-5c56-44a8-91aa-8cfd1367db06' ||
        pUserId === '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
      );
    }

    return false;
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

  saveLocalPlansCache(userCacheKey, plans) {
    try {
      localStorage.setItem(userCacheKey, JSON.stringify(plans));
    } catch (storageErr) {
      console.warn('[Calendey DB] LocalStorage quota reached, saving lightweight plan metadata:', storageErr);
      try {
        const lightweight = plans.map(p => ({
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
  }

  /**
   * Menyinkronkan satu rencana konten beserta aset desain & jadwal pengingat ke Supabase Cloud.
   */
  async syncPlanToCloud(finalPlan, user) {
    if (!this.isCloudConnected || !this.client || !finalPlan || !user) return false;
    try {
      const session = await this.ensureCloudSessionForDB();
      const sessionUserId = session?.user?.id;
      if (!sessionUserId || !this.isValidUUID(sessionUserId)) {
        return false;
      }

      const validPlanId = this.isValidUUID(finalPlan.id) ? finalPlan.id : this.generateUUID();
      finalPlan.id = validPlanId;

      const packedNotes = this.packPlanNotes(finalPlan.notes, finalPlan, user);
      const planPayload = {
        id: validPlanId,
        user_id: sessionUserId,
        title: finalPlan.title,
        caption: finalPlan.caption || null,
        notes: packedNotes,
        platforms: finalPlan.platforms || [],
        planned_date: finalPlan.planned_date,
        scheduled_at: finalPlan.scheduled_at || null,
        status: finalPlan.status || 'idea',
        design_done: Boolean(finalPlan.design_done),
        is_posted: Boolean(finalPlan.is_posted),
        posted_at: finalPlan.posted_at || null,
        national_day_id: finalPlan.national_day_id || null,
        updated_at: finalPlan.updated_at || new Date().toISOString()
      };

      const { error: planErr } = await this.client
        .from('content_plans')
        .upsert(planPayload);

      if (planErr) {
        console.warn('[Calendey DB] Upsert content_plan notice:', planErr);
        return false;
      }

      // Sinkronkan aset gambar (content_assets) ke Supabase agar ikut muncul di laptop lain
      if (Array.isArray(finalPlan.content_assets)) {
        try {
          await this.client
            .from('content_assets')
            .delete()
            .eq('content_plan_id', validPlanId);

          if (finalPlan.content_assets.length > 0) {
            const assetsPayload = finalPlan.content_assets
              .filter(a => a && a.storage_path)
              .map((a, idx) => ({
                id: this.isValidUUID(a.id) ? a.id : this.generateUUID(),
                content_plan_id: validPlanId,
                user_id: sessionUserId,
                storage_path: a.storage_path,
                file_name: a.file_name || `asset-${idx + 1}.jpg`,
                mime_type: a.mime_type || 'image/jpeg',
                file_size: Math.min(Number(a.file_size) || 1024, 5242880),
                sort_order: idx
              }));

            if (assetsPayload.length > 0) {
              await this.client.from('content_assets').upsert(assetsPayload);
            }
          }
        } catch (assetErr) {
          console.warn('[Calendey DB] Cloud asset sync notice:', assetErr);
        }
      }

      // Otomatisasi Jadwal Reminder ke tabel public.reminders
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
          .eq('content_plan_id', validPlanId)
          .limit(1);

        const reminderData = {
          content_plan_id: validPlanId,
          user_id: sessionUserId,
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
      } else if (!isReminderActive || isPosted) {
        await this.client
          .from('reminders')
          .update({ status: 'cancelled' })
          .eq('content_plan_id', validPlanId);
      }

      return true;
    } catch (err) {
      console.warn('[Calendey DB] Cloud plan sync error:', err);
      return false;
    }
  }

  async loadContentPlans() {
    try {
      const user = state.get('user');
      if (!user) {
        state.set('contentPlans', []);
        return;
      }
      const userId = user.id || null;

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
        return this.isPlanOwnedByUser(p, user);
      };

      // 1. Ambil dari cache local storage (periksa key spesifik user & fallback key lokal)
      const userCacheKey = userId ? `calendey_plans_cache_${userId}` : 'calendey_plans_cache';
      let rawLocalCandidates = [];
      try {
        const specificCache = JSON.parse(localStorage.getItem(userCacheKey) || '[]');
        if (Array.isArray(specificCache)) rawLocalCandidates.push(...specificCache);
      } catch (e) {}
      try {
        const genericCache = JSON.parse(localStorage.getItem('calendey_plans_cache') || '[]');
        if (Array.isArray(genericCache)) rawLocalCandidates.push(...genericCache);
      } catch (e) {}

      const unpackedLocal = rawLocalCandidates
        .map(p => this.unpackPlanFromCloud(p))
        .filter(isValidPlan);
      const initialPlans = this.deduplicatePlans(unpackedLocal);
      state.set('contentPlans', initialPlans);

      // 2. Sinkronkan dua arah (Two-Way Merge & Auto-Push) dengan Supabase Cloud
      if (this.isCloudConnected) {
        const session = await this.ensureCloudSessionForDB();
        if (session?.user?.id) {
          const { data, error } = await this.client
            .from('content_plans')
            .select('*, content_assets(*), reminders(*)')
            .order('planned_date', { ascending: true });

          if (!error && Array.isArray(data)) {
            const unpackedCloud = data
              .map(raw => this.unpackPlanFromCloud(raw))
              .filter(isValidPlan);
            const cloudPlans = this.deduplicatePlans(unpackedCloud);

            // Gabungkan cloudPlans dengan initialPlans lokal (jangan pernah menghapus plan lokal yang belum terkirim ke cloud)
            const cloudById = new Map();
            const cloudByTitleDate = new Map();
            cloudPlans.forEach(cp => {
              if (cp.id) cloudById.set(String(cp.id).trim(), cp);
              const tdKey = `${String(cp.title || '').trim().toLowerCase()}:::${String(cp.planned_date || '').trim()}`;
              cloudByTitleDate.set(tdKey, cp);
            });

            const unsyncedLocalPlans = [];
            const mergedList = [...cloudPlans];

            for (const localPlan of initialPlans) {
              const lId = String(localPlan.id || '').trim();
              const lTdKey = `${String(localPlan.title || '').trim().toLowerCase()}:::${String(localPlan.planned_date || '').trim()}`;
              const matchedCloud = cloudById.get(lId) || cloudByTitleDate.get(lTdKey);

              if (!matchedCloud) {
                // Plan dibuat di perangkat ini (misal MacBook Nadia) namun belum masuk ke Supabase Cloud -> pertahankan & push otomatis!
                mergedList.push(localPlan);
                unsyncedLocalPlans.push(localPlan);
              } else {
                // Jika versi lokal lebih baru atau memiliki aset desain yang belum terunggah ke cloud
                const localTime = new Date(localPlan.updated_at || 0).getTime();
                const cloudTime = new Date(matchedCloud.updated_at || 0).getTime();
                const localHasAssets = Array.isArray(localPlan.content_assets) && localPlan.content_assets.length > 0;
                const cloudHasAssets = Array.isArray(matchedCloud.content_assets) && matchedCloud.content_assets.length > 0;

                if (localTime > cloudTime || (localHasAssets && !cloudHasAssets)) {
                  const idx = mergedList.findIndex(m => m.id === matchedCloud.id);
                  const mergedItem = {
                    ...matchedCloud,
                    ...localPlan,
                    id: matchedCloud.id,
                    content_assets: localHasAssets ? localPlan.content_assets : matchedCloud.content_assets
                  };
                  if (idx !== -1) mergedList[idx] = mergedItem;
                  unsyncedLocalPlans.push(mergedItem);
                }
              }
            }

            const finalPlans = this.deduplicatePlans(mergedList).sort((a, b) =>
              String(a.planned_date || '').localeCompare(String(b.planned_date || ''))
            );

            state.set('contentPlans', finalPlans);
            this.saveLocalPlansCache(userCacheKey, finalPlans);

            // Auto-push seluruh rencana lokal yang belum tersinkron ke Supabase Cloud di background
            if (unsyncedLocalPlans.length > 0) {
              console.log(`[Calendey DB] Menyinkronkan ${unsyncedLocalPlans.length} rencana konten lokal ke Supabase Cloud...`);
              for (const pendingPlan of unsyncedLocalPlans) {
                this.syncPlanToCloud(pendingPlan, user).catch(() => {});
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[Calendey DB] Gagal memuat rencana konten:', err);
    }
  }

  async saveContentPlan(planData, isToggle = false) {
    try {
      const plans = state.get('contentPlans') || [];

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
        const validId = this.isValidUUID(existing.id)
          ? existing.id
          : (this.isValidUUID(planData.id) ? planData.id : this.generateUUID());

        finalPlan = {
          ...existing,
          ...planData,
          id: validId,
          user_id: existing.user_id || userId,
          owner_username: (user?.username || existing.owner_username || '').toLowerCase(),
          owner_email: (user?.email || existing.owner_email || '').toLowerCase(),
          updated_at: new Date().toISOString()
        };
        updatedPlans = [...plans];
        updatedPlans[existingIndex] = finalPlan;
      } else {
        const newId = this.isValidUUID(planData.id) ? planData.id : this.generateUUID();
        finalPlan = {
          ...planData,
          id: newId,
          user_id: userId,
          owner_username: (user?.username || '').toLowerCase(),
          owner_email: (user?.email || '').toLowerCase(),
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
      this.saveLocalPlansCache(userCacheKey, updatedPlans);

      // Sinkronkan ke Supabase Cloud (mendukung Nadia, Superadmin, Dhafin, & semua akun app_accounts)
      if (this.isCloudConnected && user) {
        await this.syncPlanToCloud(finalPlan, user);
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
      this.saveLocalPlansCache(userCacheKey, filtered);

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
          await this.ensureCloudSessionForDB();
          if (this.isValidUUID(planId)) {
            await this.client.from('content_assets').delete().eq('content_plan_id', planId);
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

  // ========================================================================
  // CLOUD ACCOUNTS (app_accounts table in Supabase)
  // ========================================================================

  async loadCloudAccounts() {
    if (!this.isCloudConnected || !this.client) {
      try {
        return JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
      } catch (e) {
        return [];
      }
    }

    try {
      const { data, error } = await this.client
        .from('app_accounts')
        .select('*');

      if (!error && Array.isArray(data) && data.length > 0) {
        let localAccounts = [];
        try {
          localAccounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
        } catch (e) {}

        const mergedMap = new Map();
        localAccounts.forEach(acc => {
          if (acc.email) mergedMap.set(acc.email.toLowerCase(), acc);
        });

        const canonicalIdsByEmail = {
          'superadmin@calendey.app': '3c72477c-5c56-44a8-91aa-8cfd1367db06',
          'dhafinshabir610@gmail.com': '1df2ed64-32c9-446f-852a-2e3d13d92adb',
          'nadia@calendey.app': 'e2a8b910-5c56-44a8-91aa-9cfd1367db99'
        };

        data.forEach(cloudAcc => {
          const emailKey = (cloudAcc.email || '').toLowerCase();
          const existing = mergedMap.get(emailKey) || {};
          const canonicalId = canonicalIdsByEmail[emailKey] || cloudAcc.id || existing.id;
          mergedMap.set(emailKey, {
            ...existing,
            ...cloudAcc,
            id: canonicalId,
            name: cloudAcc.name || cloudAcc.full_name || existing.name,
            full_name: cloudAcc.full_name || cloudAcc.name || existing.full_name,
            whatsapp_number: cloudAcc.whatsapp || existing.whatsapp_number || '',
            whatsapp: cloudAcc.whatsapp || existing.whatsapp || '',
            password: cloudAcc.password || existing.password || ''
          });
        });

        const mergedAccounts = Array.from(mergedMap.values());
        localStorage.setItem('calendey_all_accounts', JSON.stringify(mergedAccounts));

        // Sinkronkan juga profil user yang sedang aktif jika cocok dengan akun cloud terbaru
        const activeUser = state.get('user');
        if (activeUser?.email) {
          const freshActive = mergedMap.get(activeUser.email.toLowerCase());
          if (freshActive) {
            const updatedActive = {
              ...activeUser,
              id: freshActive.id || activeUser.id,
              full_name: freshActive.full_name || activeUser.full_name,
              telegram_chat_id: freshActive.telegram_chat_id || activeUser.telegram_chat_id || '',
              whatsapp_number: freshActive.whatsapp_number || activeUser.whatsapp_number || ''
            };
            state.set('user', updatedActive);
            localStorage.setItem('calendey_user_profile', JSON.stringify(updatedActive));
          }
        }

        return mergedAccounts;
      }
    } catch (err) {
      console.warn('[Calendey DB] Cloud accounts sync notice:', err);
    }

    try {
      return JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    } catch (e) {
      return [];
    }
  }

  async saveCloudAccount(account) {
    if (!this.isCloudConnected || !this.client || !account) return false;
    try {
      const cleanUsername = (account.username || account.name || '').toLowerCase().replace(/\s+/g, '');
      const cleanEmail = (account.email || '').toLowerCase();

      let preservedPassword = account.password || '';
      if (!preservedPassword) {
        try {
          const allAccs = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
          const found = allAccs.find(
            a => a.email?.toLowerCase() === cleanEmail || a.username?.toLowerCase() === cleanUsername
          );
          if (found?.password) preservedPassword = found.password;
        } catch (e) {}
      }
      if (!preservedPassword) {
        if (cleanUsername === 'superadmin') preservedPassword = 'admin-calender';
        else if (cleanUsername === 'dhafin') preservedPassword = 'dhafin12345';
        else if (cleanUsername === 'nadia') preservedPassword = 'nadiacantik';
      }

      const payload = {
        id: account.id || undefined,
        username: cleanUsername,
        name: account.name || account.full_name || '',
        full_name: account.full_name || account.name || '',
        email: cleanEmail,
        role: account.role || 'Member',
        whatsapp: account.whatsapp || account.whatsapp_number || '',
        telegram_chat_id: account.telegram_chat_id || '',
        reminders_enabled: account.reminders_enabled !== false,
        default_remind_offset_days: account.default_remind_offset_days ?? 1,
        default_remind_time: account.default_remind_time || '09:00',
        theme: account.theme || 'light',
        updated_at: new Date().toISOString()
      };
      if (preservedPassword) {
        payload.password = preservedPassword;
      }

      const { error } = await this.client
        .from('app_accounts')
        .upsert(payload, { onConflict: 'email' });

      if (error) {
        console.warn('[Calendey DB] Gagal simpan akun ke Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Calendey DB] Error saveCloudAccount:', err);
      return false;
    }
  }

  async deleteCloudAccount(accountId, email) {
    if (!this.isCloudConnected || !this.client) return false;
    try {
      let query = this.client.from('app_accounts').delete();
      if (email) {
        query = query.eq('email', email.toLowerCase());
      } else if (accountId) {
        query = query.eq('id', accountId);
      }
      const { error } = await query;
      if (error) {
        console.warn('[Calendey DB] Gagal hapus akun di Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Calendey DB] Error deleteCloudAccount:', err);
      return false;
    }
  }
}

export const db = new DatabaseService();
