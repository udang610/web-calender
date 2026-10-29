// ========================================================================
// CALENDEY — Unified Reminder Gateway (Telegram Bot & WhatsApp Multi-Target)
// Pengiriman Otomatis Terisolasi per Creator dengan Dukungan Multi-Nomor / Multi-Chat ID
// ========================================================================

import { state } from './state.js';
import { db } from './db.js';
import { notify } from './notifications.js';

class ReminderGatewayService {
  constructor() {
    // WhatsApp Keys
    this.WA_TOKEN_KEY = 'calendey_wa_gateway_token';
    this.WA_ENDPOINT_KEY = 'calendey_wa_gateway_endpoint';
    this.AUTO_SEND_KEY = 'calendey_wa_auto_send';
    this.DEFAULT_WA_ENDPOINT = 'https://api.fonnte.com/send';

    // Telegram Keys (Tanpa scan QR, permanen & gratis)
    this.TG_BOT_TOKEN_KEY = 'calendey_tg_bot_token';
    this.TG_DEFAULT_BOT_TOKEN = '7716162162:AAG8460655sD-e_fA_dummy_or_user'; // fallback placeholder
  }

  // --- 1. WhatsApp Configuration ---
  getToken() {
    return (localStorage.getItem(this.WA_TOKEN_KEY) || '').trim();
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.WA_TOKEN_KEY, String(token).trim());
    } else {
      localStorage.removeItem(this.WA_TOKEN_KEY);
    }
  }

  getEndpoint() {
    return localStorage.getItem(this.WA_ENDPOINT_KEY) || this.DEFAULT_WA_ENDPOINT;
  }

  setEndpoint(url) {
    if (url) {
      localStorage.setItem(this.WA_ENDPOINT_KEY, String(url).trim());
    } else {
      localStorage.removeItem(this.WA_ENDPOINT_KEY);
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

  // --- 2. Telegram Bot Configuration ---
  getTelegramToken() {
    return (localStorage.getItem(this.TG_BOT_TOKEN_KEY) || '').trim();
  }

  setTelegramToken(token) {
    if (token) {
      localStorage.setItem(this.TG_BOT_TOKEN_KEY, String(token).trim());
    } else {
      localStorage.removeItem(this.TG_BOT_TOKEN_KEY);
    }
  }

  hasTelegramToken() {
    return Boolean(this.getTelegramToken());
  }

  // --- 3. Multi-Recipient Parsers ---
  parseRecipients(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
    return String(raw)
      .split(/[,;\n|]+/)
      .map(s => s.trim())
      .filter(Boolean);
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

  parsePhones(raw) {
    const list = this.parseRecipients(raw);
    const seen = new Set();
    const result = [];
    for (const item of list) {
      const norm = this.normalizePhone(item);
      if (norm && norm.length >= 10 && !seen.has(norm)) {
        seen.add(norm);
        result.push(norm);
      }
    }
    return result;
  }

  parseTelegramChatIds(raw) {
    const list = this.parseRecipients(raw);
    const seen = new Set();
    const result = [];
    for (const item of list) {
      const clean = item.replace(/[\s]/g, '');
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        result.push(clean);
      }
    }
    return result;
  }

  // --- 4. Message Formatters ---
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

  formatTelegramMessage(plan, user) {
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
      platformsText = `📱 <b>Platform:</b> ${plan.platforms.join(', ')}\n`;
    }

    const captionSafe = (plan.caption || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return (
      `🔔 <b>PENGINGAT JADWAL KONTEN CALENDEY</b> 🇮🇩\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Halo <b>${userName}</b>! 👋\n` +
      `Rencana konten Anda dijadwalkan untuk diposting:\n\n` +
      `📌 <b>Momen:</b> ${natDayName}\n` +
      `📝 <b>Judul:</b> ${plan.title}\n` +
      `🗓 <b>Target Tayang:</b> ${targetDate} (${targetTime} WIB)\n` +
      `⚡ <b>Status:</b> ${statusLabel}\n` +
      platformsText +
      (plan.caption ? `💬 <b>Draft Caption:</b>\n<i>"${captionSafe.length > 180 ? captionSafe.slice(0, 180) + '...' : captionSafe}"</i>\n` : '') +
      (plan.notes ? `💡 <b>Catatan:</b> ${plan.notes}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ Pastikan aset visual dan materi sudah siap ya!\n\n` +
      `🔗 <a href="https://web-calender-iota.vercel.app/">Buka Aplikasi Calendey</a>`
    );
  }

  // --- 5. Telegram Dispatcher (Bebas Scan QR & Gratis) ---
  async sendTelegramMessage({ chatId, message, token }) {
    const activeToken = (token || this.getTelegramToken()).trim();
    if (!activeToken) {
      return {
        success: false,
        needToken: true,
        error: 'Telegram Bot Token belum diatur di Pengaturan.'
      };
    }

    const cleanChatId = String(chatId || '').trim();
    if (!cleanChatId) {
      return {
        success: false,
        error: 'Telegram Chat ID kosong. Buka bot di Telegram dan klik /start untuk mendapatkan Chat ID.'
      };
    }

    try {
      const url = `https://api.telegram.org/bot${activeToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      });

      const data = await response.json();
      if (data.ok) {
        return { success: true, data };
      } else {
        return {
          success: false,
          error: data.description || 'Gagal mengirim pesan Telegram'
        };
      }
    } catch (err) {
      console.error('[TelegramGateway] Send error:', err);
      return {
        success: false,
        error: `Gagal menghubungi server Telegram: ${err.message}`
      };
    }
  }

  async sendTelegramTest(chatId, tokenOverride) {
    const user = state.get('user') || {};
    const token = tokenOverride || this.getTelegramToken();
    const targetChat = chatId || user.telegram_chat_id || '';

    if (!token) {
      return {
        success: false,
        needToken: true,
        error: 'Telegram Bot Token belum diisi di Pengaturan.'
      };
    }

    if (!targetChat) {
      return {
        success: false,
        error: 'Telegram Chat ID belum diisi. Masukkan Chat ID akun/grup Anda.'
      };
    }

    const testMsg =
      `🔔 <b>TES KONEKSI TELEGRAM BOT — CALENDEY</b> 🇮🇩\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Halo <b>${user.full_name || 'Pengguna Calendey'}</b>! 👋\n\n` +
      `✅ <b>Status:</b> TERHUBUNG & AKTIF OTOMATIS!\n` +
      `🆔 <b>Target Chat ID:</b> <code>${targetChat}</code>\n` +
      `⏰ <b>Waktu Tes:</b> ${new Date().toLocaleString('id-ID')} WIB\n\n` +
      `Bot ini siap mengirimkan pengingat jadwal posting konten Anda tepat waktu secara otomatis <b>tanpa scan QR selamanya</b>! ✨\n\n` +
      `<i>Salam hangat dari Tim Calendey Indonesia</i>`;

    return await this.sendTelegramMessage({
      chatId: targetChat,
      message: testMsg,
      token
    });
  }

  // --- 6. WhatsApp Dispatcher ---
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

      if (response.ok && (data.status === true || data.status === 'success' || data.id)) {
        return { success: true, data };
      } else {
        const errorMsg = data.reason || data.message || `Respon server: HTTP ${response.status}`;
        return { success: false, error: errorMsg, data };
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
        error: 'Token WhatsApp Gateway belum diisi. Masukkan Token di tab Pengaturan.'
      };
    }

    const testMessage =
      `Halo ${user.full_name || 'Pengguna Calendey'}! 👋🇮🇩\n\n` +
      `Ini adalah *Pesan Tes Otomatis WhatsApp Gateway* dari aplikasi Calendey.\n\n` +
      `✅ *Status:* TERHUBUNG & OTOMATIS\n` +
      `📱 *Nomor Tujuan:* +${phone}\n` +
      `⏰ *Waktu Kirim:* ${new Date().toLocaleString('id-ID')} WIB\n\n` +
      `Selamat! Sistem pengingat jadwal konten media sosial Anda berjalan otomatis.\n\n` +
      `Salam,\n*Tim Calendey Indonesia*`;

    return await this.sendDirectMessage({
      target: phone,
      message: testMessage,
      token
    });
  }

  getPlanOwner(plan) {
    if (!plan) return state.get('user') || {};
    let owner = null;
    if (plan.user_id) {
      try {
        const allAccounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
        owner = allAccounts.find(a => 
          a.id === plan.user_id || 
          a.email?.toLowerCase() === String(plan.user_id).toLowerCase() ||
          a.username?.toLowerCase() === String(plan.user_id).toLowerCase()
        );
      } catch (e) {}
    }
    return owner || state.get('user') || {};
  }

  // --- 7. Master Multi-Account & Multi-Target Reminder Dispatcher ---
  async dispatchPlanReminder(plan, overrideUser = null) {
    if (!plan) return { success: false, error: 'Data rencana konten tidak ditemukan' };

    // 1. Tentukan pemilik asli dari konten ini (Isolasi Multi-Tenant Akun)
    const owner = overrideUser || this.getPlanOwner(plan);

    const dispatchedResults = [];
    let atLeastOneSuccess = false;

    // Filter saluran pilihan pengingat (all / telegram / whatsapp)
    const chosenChannel = plan.reminder_channel || 'all';
    const allowTelegram = chosenChannel === 'all' || chosenChannel === 'telegram';
    const allowWhatsApp = chosenChannel === 'all' || chosenChannel === 'whatsapp';

    // 2. Jalur Utama: Telegram Bot Dispatch (Multi-Chat ID)
    const tgChatIds = this.parseTelegramChatIds(owner.telegram_chat_id);
    const hasTgBot = this.hasTelegramToken();

    if (!hasTgBot) {
      dispatchedResults.push({
        channel: 'telegram',
        success: false,
        error: 'Token Bot Telegram belum diatur di Pengaturan.'
      });
    } else if (tgChatIds.length === 0) {
      dispatchedResults.push({
        channel: 'telegram',
        success: false,
        error: `Telegram Chat ID untuk kreator "${owner.full_name || 'Creator'}" belum diisi di profil.`
      });
    } else {
      const tgMessage = this.formatTelegramMessage(plan, owner);
      for (const chatId of tgChatIds) {
        console.log(`[Calendey Dispatch] Mengirim pengingat Telegram untuk "${plan.title}" ke ID: ${chatId}...`);
        const res = await this.sendTelegramMessage({
          chatId,
          message: tgMessage
        });
        dispatchedResults.push({
          channel: 'telegram',
          target: chatId,
          success: res.success,
          error: res.error
        });
        if (res.success) atLeastOneSuccess = true;
      }
    }

    // 4. Sinkronkan status ke Supabase Database jika ada yang berhasil
    if (atLeastOneSuccess && db.isCloudConnected && db.client) {
      try {
        await db.client
          .from('reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('content_plan_id', plan.id);
      } catch (e) {}
    }

    return {
      success: atLeastOneSuccess,
      results: dispatchedResults,
      ownerName: owner.full_name || owner.name || 'Creator'
    };
  }
}

export const waGateway = new ReminderGatewayService();
