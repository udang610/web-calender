// ========================================================================
// CALENDEY — Views Switcher & Page Renderer
// ========================================================================

import { state } from './state.js';
import { calendar } from './calendar.js';
import { planner } from './planner.js';
import { CONFIG } from './config.js';
import { modals } from './modals.js';
import { MONTH_NAMES_ID } from './calendar.js';
import { auth } from './auth.js';
import { waGateway } from './whatsapp-gateway.js';
import { notify } from './notifications.js';

class ViewManager {
  constructor() {
    this.currentView = 'calendar';
  }

  init() {
    state.subscribe('currentView', (newView) => {
      this.switchView(newView);
    });
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update view container visibility
    const views = ['calendar', 'planner', 'categories', 'settings'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === viewName) {
          el.style.display = 'block';
        } else {
          el.style.display = 'none';
        }
      }
    });

    // Dynamic Title & Subtitle
    const titleEl = document.getElementById('topbarPageTitle');
    const subtitleEl = document.getElementById('topbarPageSubtitle');

    if (viewName === 'calendar') {
      if (titleEl) titleEl.textContent = 'Kalender';
      if (subtitleEl) subtitleEl.textContent = 'Jadwal hari besar nasional Indonesia & agenda konten';
      calendar.render();
    } else if (viewName === 'planner') {
      if (titleEl) titleEl.textContent = 'Konten Saya';
      if (subtitleEl) subtitleEl.textContent = 'Kelola status alur kerja konten dan aset visual postingan';
      planner.render();
    } else if (viewName === 'categories') {
      if (titleEl) titleEl.textContent = 'Kategori Hari Penting';
      if (subtitleEl) subtitleEl.textContent = 'Katalog lengkap hari nasional berdasarkan klasifikasi';
      this.renderCategoriesView();
    } else if (viewName === 'settings') {
      if (titleEl) titleEl.textContent = 'Pengaturan Akun & Reminder';
      if (subtitleEl) subtitleEl.textContent = 'Konfigurasi integrasi WhatsApp gateway dan preferensi tema';
      this.renderSettingsView();
    }
  }

  renderCategoriesView() {
    const container = document.getElementById('view-categories');
    if (!container) return;

    const nationalDays = state.get('nationalDays') || [];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
          ${CONFIG.CATEGORIES.map(cat => {
            const count = nationalDays.filter(n => n.category_id === cat.id).length;
            return `
              <div style="background: var(--surface); padding: 18px 20px; border-radius: var(--radius-lg); border: 1px solid var(--surface-border); display: flex; align-items: center; gap: 16px;">
                <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: ${cat.color_hex}15; color: ${cat.color_hex}; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                  <i class="ph-bold ph-${cat.icon}"></i>
                </div>
                <div>
                  <div style="font-weight: 800; font-size: 1rem; color: var(--text);">${cat.name}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">${count} hari peringatan terdaftar</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Master List Table -->
        <div style="background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--surface-border); padding: 22px;">
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text); margin-bottom: 16px;">Katalog Master Hari Nasional Indonesia</h3>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${nationalDays.map(n => {
              const cat = CONFIG.CATEGORIES.find(c => c.id === n.category_id);
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-subtle); border-radius: var(--radius-md); gap: 12px; flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 38px; height: 38px; border-radius: var(--radius-sm); background: var(--surface); display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; color: var(--text); font-size: 0.95rem; border: 1px solid var(--border-light);">
                      <span>${n.day}</span>
                      <span style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">${MONTH_NAMES_ID[n.month - 1].slice(0, 3)}</span>
                    </div>
                    <div>
                      <div style="font-size: 0.92rem; font-weight: 700; color: var(--text);">${n.name}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${n.tagline || n.description}</div>
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: var(--radius-pill); background: ${cat ? cat.color_hex + '20' : '#eee'}; color: ${cat ? cat.color_hex : '#333'};">
                      ${cat ? cat.name : 'Nasional'}
                    </span>
                    ${n.is_public_holiday ? '<span style="font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: var(--radius-pill); background: var(--danger-subtle); color: var(--danger);">Libur Resmi</span>' : ''}
                    <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.calendeyOpenNewPlanForDay(${n.id})">
                      <i class="ph-bold ph-plus"></i> Konten
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderSettingsView() {
    const container = document.getElementById('view-settings');
    if (!container) return;

    const user = state.get('user') || {};
    const hasToken = waGateway.hasToken();
    const isAutoSend = waGateway.isAutoSendEnabled();

    container.innerHTML = `
      <div style="max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
        <!-- Card 1: Profil Akun & Kontak -->
        <div style="background: var(--surface); padding: 26px; border-radius: var(--radius-lg); border: 1px solid var(--surface-border); box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;">
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text); display: flex; align-items: center; gap: 8px; margin: 0;">
              <i class="ph-bold ph-user-circle" style="color: var(--primary);"></i> Profil & Nomor WhatsApp
            </h3>
            <span style="font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: var(--radius-pill); background: var(--primary-subtle); color: var(--primary);">
              Akun Aktif
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Nama Pengguna</label>
              <input type="text" id="pageSettingsName" class="form-input" style="padding-left: 14px;" value="${user.full_name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Nomor WhatsApp Tujuan Pengingat (Aktif)</label>
              <input type="text" id="pageSettingsWA" class="form-input" style="padding-left: 14px;" value="${user.whatsapp_number || '6281219958750'}" placeholder="6281219958750">
              <span style="font-size: 0.74rem; color: var(--text-muted); margin-top: 3px;">
                Format nomor menggunakan kode negara <strong>62</strong> (contoh: 6281219958750). Pengingat konten akan dikirim langsung ke nomor ini.
              </span>
            </div>
            <div class="form-group">
              <label class="form-label">Jadwal Pengingat Standar</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <select id="pageSettingsOffset" class="form-select">
                  <option value="0" ${user.default_remind_offset_days === 0 ? 'selected' : ''}>Hari-H Posting</option>
                  <option value="1" ${user.default_remind_offset_days === 1 || user.default_remind_offset_days === undefined ? 'selected' : ''}>H-1 Sebelum Posting</option>
                  <option value="3" ${user.default_remind_offset_days === 3 ? 'selected' : ''}>H-3 Sebelum Posting</option>
                </select>
                <input type="time" id="pageSettingsTime" class="form-input" style="padding-left: 14px;" value="${user.default_remind_time || '09:00'}">
              </div>
            </div>
            <div class="form-group">
              <label class="checklist-label">
                <input type="checkbox" id="pageSettingsEnableWA" class="checklist-checkbox" ${user.reminders_enabled !== false ? 'checked' : ''}>
                <span>Aktifkan sistem notifikasi & alarm pengingat</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Card 2: WhatsApp Gateway API (Pengiriman Otomatis ke HP) -->
        <div style="background: var(--surface); padding: 26px; border-radius: var(--radius-lg); border: 1px solid var(--surface-border); box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(37, 211, 102, 0.12); color: #25d366; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                <i class="ph-bold ph-whatsapp-logo"></i>
              </div>
              <div>
                <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text); margin: 0;">Pengiriman Otomatis WhatsApp (Gateway)</h3>
                <p style="font-size: 0.74rem; color: var(--text-muted); margin: 0;">Pesan otomatis terkirim langsung dari server ke HP tanpa membuka WhatsApp</p>
              </div>
            </div>
            <span id="gatewayStatusBadge" style="font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: var(--radius-pill); background: ${hasToken ? 'rgba(37, 211, 102, 0.15)' : 'rgba(239, 68, 68, 0.12)'}; color: ${hasToken ? '#16a34a' : '#dc2626'};">
              ${hasToken ? '● Gateway Terhubung' : '○ Belum Dikonfigurasi'}
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                <span>API Token WhatsApp Gateway (Fonnte / Provider)</span>
                <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" style="font-size: 0.72rem; color: #25d366; text-decoration: underline; font-weight: 600;">
                  Buka fonnte.com <i class="ph-bold ph-arrow-square-out"></i>
                </a>
              </label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="password" id="pageSettingsGatewayToken" class="form-input" style="padding-left: 14px; padding-right: 44px; font-family: monospace;" value="${waGateway.getToken()}" placeholder="Masukkan API Token perangkat WhatsApp Anda...">
                <button type="button" id="btnToggleTokenVisibility" style="position: absolute; right: 10px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; font-size: 1.1rem;">
                  <i class="ph-bold ph-eye" id="iconTokenVisibility"></i>
                </button>
              </div>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">
                Token ini menghubungkan akun WhatsApp Anda agar server dapat mengirim pesan secara otomatis ke HP.
              </span>
            </div>

            <div class="form-group">
              <label class="checklist-label">
                <input type="checkbox" id="pageSettingsAutoDispatch" class="checklist-checkbox" ${isAutoSend ? 'checked' : ''}>
                <span style="font-weight: 600;">Kirim Otomatis ke HP saat jam jadwal tiba (Background Dispatch)</span>
              </label>
            </div>

            <!-- Petunjuk Langkah Praktis 1-2-3 -->
            <div style="background: rgba(37, 211, 102, 0.06); border-radius: var(--radius-md); border: 1px solid rgba(37, 211, 102, 0.2); padding: 14px;">
              <div style="font-weight: 700; font-size: 0.8rem; color: var(--text); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <i class="ph-bold ph-info" style="color: #25d366;"></i> Langkah Menghubungkan WhatsApp Otomatis:
              </div>
              <ol style="margin: 0; padding-left: 18px; font-size: 0.75rem; color: var(--text-muted); line-height: 1.6;">
                <li>Buka situs <strong>fonnte.com</strong> dan daftar/masuk ke dashboard.</li>
                <li>Pindai QR code perangkat WhatsApp Anda untuk menghubungkan nomor.</li>
                <li>Salin <strong>Token</strong> perangkat di dashboard Fonnte dan tempelkan pada kolom di atas.</li>
              </ol>
            </div>

            <!-- Tombol Aksi Gateway -->
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button type="button" class="btn-secondary" id="btnTestGatewaySend" style="flex: 1; justify-content: center; color: #16a34a; border-color: rgba(37, 211, 102, 0.5); font-weight: 700;">
                <i class="ph-bold ph-paper-plane-tilt"></i> Tes Kirim Pesan Otomatis ke HP Sekarang
              </button>
              <button type="button" class="btn-primary" id="btnSavePageSettings" style="flex: 1; justify-content: center; font-weight: 700;">
                <i class="ph-bold ph-floppy-disk"></i> Simpan Semua Pengaturan
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Toggle Token Visibility
    const toggleBtn = document.getElementById('btnToggleTokenVisibility');
    const tokenInput = document.getElementById('pageSettingsGatewayToken');
    const eyeIcon = document.getElementById('iconTokenVisibility');
    if (toggleBtn && tokenInput && eyeIcon) {
      toggleBtn.addEventListener('click', () => {
        if (tokenInput.type === 'password') {
          tokenInput.type = 'text';
          eyeIcon.className = 'ph-bold ph-eye-slash';
        } else {
          tokenInput.type = 'password';
          eyeIcon.className = 'ph-bold ph-eye';
        }
      });
    }

    // Handler: Simpan Semua Pengaturan
    const saveBtn = document.getElementById('btnSavePageSettings');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const full_name = document.getElementById('pageSettingsName')?.value.trim();
        let whatsapp_number = document.getElementById('pageSettingsWA')?.value.trim();
        const default_remind_offset_days = parseInt(document.getElementById('pageSettingsOffset')?.value || '1', 10);
        const default_remind_time = document.getElementById('pageSettingsTime')?.value || '09:00';
        const reminders_enabled = document.getElementById('pageSettingsEnableWA')?.checked ?? true;
        const gatewayToken = document.getElementById('pageSettingsGatewayToken')?.value.trim() || '';
        const autoDispatch = document.getElementById('pageSettingsAutoDispatch')?.checked ?? true;

        // Normalisasi nomor HP otomatis (08xxx -> 628xxx)
        if (whatsapp_number) {
          whatsapp_number = waGateway.normalizePhone(whatsapp_number);
          const inputEl = document.getElementById('pageSettingsWA');
          if (inputEl) inputEl.value = whatsapp_number;
        }

        // Simpan Gateway Config
        waGateway.setToken(gatewayToken);
        waGateway.setAutoSendEnabled(autoDispatch);

        // Update badge status
        const badge = document.getElementById('gatewayStatusBadge');
        if (badge) {
          const active = waGateway.hasToken();
          badge.style.background = active ? 'rgba(37, 211, 102, 0.15)' : 'rgba(239, 68, 68, 0.12)';
          badge.style.color = active ? '#16a34a' : '#dc2626';
          badge.textContent = active ? '● Gateway Terhubung' : '○ Belum Dikonfigurasi';
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Menyimpan...';

        await auth.updateProfile({
          full_name,
          whatsapp_number,
          default_remind_offset_days,
          default_remind_time,
          reminders_enabled
        });

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Simpan Semua Pengaturan';
        notify.success('Pengaturan akun & WhatsApp Gateway berhasil disimpan!');
      });
    }

    // Handler: Tes Kirim Pesan Otomatis ke HP Sekarang
    const testGatewayBtn = document.getElementById('btnTestGatewaySend');
    if (testGatewayBtn) {
      testGatewayBtn.addEventListener('click', async () => {
        let wa = document.getElementById('pageSettingsWA')?.value.trim();
        const tokenInputVal = document.getElementById('pageSettingsGatewayToken')?.value.trim();
        if (tokenInputVal) {
          waGateway.setToken(tokenInputVal);
        }

        if (wa) {
          wa = waGateway.normalizePhone(wa);
        } else {
          wa = '6281219958750';
        }

        if (!waGateway.hasToken()) {
          notify.error('Token Gateway belum diisi! Silakan masukkan Token Fonnte terlebih dahulu.');
          document.getElementById('pageSettingsGatewayToken')?.focus();
          return;
        }

        testGatewayBtn.disabled = true;
        testGatewayBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Mengirim Otomatis ke HP...';

        const res = await waGateway.sendTestMessage(wa);

        testGatewayBtn.disabled = false;
        testGatewayBtn.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Tes Kirim Pesan Otomatis ke HP Sekarang';

        if (res.success) {
          notify.success(`Pesan tes otomatis berhasil dikirim ke WhatsApp HP +${wa}!`);
        } else {
          notify.error(`Gagal mengirim otomatis: ${res.error || 'Periksa token atau koneksi gateway'}`);
        }
      });
    }
  }
}

export const viewManager = new ViewManager();
window.viewManager = viewManager;

window.calendeyOpenNewPlanForDay = (dayId) => {
  const nDay = (state.get('nationalDays') || []).find(n => n.id === dayId);
  if (!nDay) return;
  const currentYear = state.get('activeYear');
  const dateStr = `${currentYear}-${String(nDay.month).padStart(2, '0')}-${String(nDay.day).padStart(2, '0')}`;
  modals.openContentForm({
    planned_date: dateStr,
    national_day_id: nDay.id,
    title: `Konten ${nDay.name}`
  });
};
