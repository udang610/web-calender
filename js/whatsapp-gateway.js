// ========================================================================
// CALENDEY — WhatsApp Gateway Service (Automated WhatsApp Dispatch)
// Mengirim pesan pengingat jadwal konten langsung ke HP via Gateway API
// ========================================================================

import { state } from './state.js';
import { db } from './db.js';
import { notify } from './notifications.js';

class WhatsAppGatewayService {
  constructor() {
    this.TOKEN_KEY = 'calendey_wa_gateway_token';
    this.ENDPOINT_KEY = 'calendey_wa_gateway_endpoint';
    this.AUTO_SEND_KEY = 'calendey_wa_auto_send';
    this.DEFAULT_ENDPOINT = 'https://api.fonnte.com/send';
  }

  getToken() {
    return (localStorage.getItem(this.TOKEN_KEY) || '').trim();
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, String(token).trim());
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  getEndpoint() {
    return localStorage.getItem(this.ENDPOINT_KEY) || this.DEFAULT_ENDPOINT;
  }

  setEndpoint(url) {
    if (url) {
      localStorage.setItem(this.ENDPOINT_KEY, String(url).trim());
    } else {
      localStorage.removeItem(this.ENDPOINT_KEY);
    }
  }

  isAutoSendEnabled() {
    const val = localStorage.getItem(this.AUTO_SEND_KEY);
    return val !== 'false';
  }

  setAutoSendEnabled(enabled) {
    localStorage.setItem(this.AUTO_SEND_KEY, enabled ? 'true' : 'false');
  }

  hasToken() {
    return Boolean(this.getToken());
  }

  normalizePhone(raw) {
    if (!raw) return '';
    let phone = String(raw).replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    } else if (phone.startsWith('8')) {
      phone = '62' + phone;
    } else if (!phone.startsWith('62') && phone.length > 0) {
      phone = '62' + phone;
    }
    return phone;
  }

  formatReminderMessage(plan, user) {
    const activeUser = user || state.get('user') || {};
    const nationalDays = state.get('nationalDays') || [];
    const natDay = plan.national_day_id ? nationalDays.find(n => n.id === plan.national_day_id) : null;
    const natDayName = natDay ? natDay.name : 'Hari Besar Nasional';
    const userName = activeUser.full_name || 'Sahabat Calendey';
    const statusLabel = plan.status ? plan.status.toUpperCase() : 'IDEA';
    const targetDate = plan.planned_date || new Date().toISOString().split('T')[0];
    const targetTime = plan.scheduled_at
      ? new Date(plan.scheduled_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : (plan.remind_time || '09:00');

    let platformsText = '';
    if (Array.isArray(plan.platforms) && plan.platforms.length > 0) {
      platformsText = `📱 *Platform:* ${plan.platforms.join(', ')}\n`;
    }

    return (
      `Halo ${userName}! 🇮🇩\n\n` +
      `*PENGINGAT JADWAL KONTEN CALENDEY*\n` +
      `--------------------------------\n` +
      `📌 *Momen:* ${natDayName}\n` +
      `📝 *Judul Konten:* ${plan.title}\n` +
      `🗓 *Target Tayang:* ${targetDate} (${targetTime} WIB)\n` +
      `⚡ *Status Konten:* ${statusLabel}\n` +
      platformsText +
      (plan.caption ? `💬 *Draft Caption:*\n"${plan.caption.length > 120 ? plan.caption.slice(0, 120) + '...' : plan.caption}"\n` : '') +
      (plan.notes ? `💡 *Catatan:* ${plan.notes}\n` : '') +
      `--------------------------------\n` +
      `Pastikan aset visual dan materi sudah siap ya! ✨\n\n` +
      `_Pesan pengingat otomatis dikirim oleh sistem Calendey_`
    );
  }

  async sendDirectMessage({ target, message, token }) {
    const targetPhone = this.normalizePhone(target);
    if (!targetPhone || targetPhone.length < 10) {
      return {
        success: false,
        error: 'Nomor WhatsApp tidak valid (minimal 10 digit dengan format 628xxx).'
      };
    }

    const activeToken = (token || this.getToken()).trim();
    if (!activeToken) {
      return {
        success: false,
        needToken: true,
        error: 'Token WhatsApp Gateway belum diatur. Silakan masukkan token di Pengaturan.'
      };
    }

    const endpoint = this.getEndpoint();

    try {
      const formData = new FormData();
      formData.append('target', targetPhone);
      formData.append('message', message);
      formData.append('countryCode', '62');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': activeToken
        },
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      // Fonnte API return status: true on success
      if (response.ok && (data.status === true || data.status === 'success' || data.id)) {
        return {
          success: true,
          data
        };
      } else {
        const errorMsg = data.reason || data.message || `Respon server: HTTP ${response.status}`;
        return {
          success: false,
          error: errorMsg,
          data
        };
      }
    } catch (err) {
      console.error('[WhatsAppGateway] Fetch error:', err);
      return {
        success: false,
        error: `Gagal menghubungi server WhatsApp Gateway: ${err.message}`
      };
    }
  }

  async sendTestMessage(targetPhone, tokenOverride) {
    const user = state.get('user') || {};
    const phone = this.normalizePhone(targetPhone || user.whatsapp_number || '6281219958750');
    const token = tokenOverride || this.getToken();

    if (!token) {
      return {
        success: false,
        needToken: true,
        error: 'Token WhatsApp Gateway belum diisi. Masukkan Token dari Fonnte di tab Pengaturan.'
      };
    }

    const testMessage =
      `Halo ${user.full_name || 'Pengguna Calendey'}! 👋🇮🇩\n\n` +
      `Ini adalah *Pesan Tes Otomatis WhatsApp Gateway* dari aplikasi Calendey.\n\n` +
      `✅ *Status:* TERHUBUNG & OTOMATIS\n` +
      `📱 *Nomor Tujuan:* +${phone}\n` +
      `⏰ *Waktu Kirim:* ${new Date().toLocaleString('id-ID')} WIB\n\n` +
      `Selamat! Sistem pengingat jadwal konten media sosial Anda sekarang berjalan 100% otomatis tanpa perlu membuka WhatsApp atau menekan tombol kirim.\n\n` +
      `Salam,\n*Tim Calendey Indonesia*`;

    return await this.sendDirectMessage({
      target: phone,
      message: testMessage,
      token
    });
  }

  async dispatchPlanReminder(plan, user) {
    if (!plan) return { success: false, error: 'Data rencana konten tidak ditemukan' };

    const activeUser = user || state.get('user') || {};
    const targetPhone = this.normalizePhone(activeUser.whatsapp_number || '6281219958750');

    if (!targetPhone) {
      return { success: false, error: 'Nomor WhatsApp belum diisi di profil pengguna' };
    }

    const message = this.formatReminderMessage(plan, activeUser);
    const result = await this.sendDirectMessage({
      target: targetPhone,
      message
    });

    if (result.success) {
      // Sinkronkan update status reminder ke Supabase public.reminders
      if (db.isCloudConnected && db.client) {
        try {
          await db.client
            .from('reminders')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('content_plan_id', plan.id);

          // Catat audit log
          await db.client
            .from('reminder_logs')
            .insert({
              provider: 'fonnte',
              request_summary: `Direct dispatch to +${targetPhone} for plan "${plan.title}"`,
              response_code: 200,
              response_body: JSON.stringify(result.data || {})
            }).catch(() => {});
        } catch (dbErr) {
          console.warn('[WhatsAppGateway] Failed updating cloud reminder status:', dbErr);
        }
      }

      console.log(`[WhatsAppGateway] Reminder otomatis terkirim untuk "${plan.title}" ke +${targetPhone}`);
    }

    return result;
  }
}

export const waGateway = new WhatsAppGatewayService();
