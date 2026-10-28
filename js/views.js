// ========================================================================
// CALENDEY — Views Switcher & Page Renderer
// ========================================================================

import { state } from './state.js';
import { calendar } from './calendar.js';
import { planner } from './planner.js';
import { CONFIG } from './config.js';
import { modals } from './modals.js';
import { MONTH_NAMES_ID } from './calendar.js';

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
      if (titleEl) titleEl.textContent = 'Kalender Nasional';
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

    container.innerHTML = `
      <div style="max-width: 640px; margin: 0 auto; background: var(--surface); padding: 28px; border-radius: var(--radius-lg); border: 1px solid var(--surface-border); box-shadow: var(--shadow-sm);">
        <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text); margin-bottom: 20px;">Pengaturan Akun & Reminder WhatsApp</h3>
        <div style="display: flex; flex-direction: column; gap: 18px;">
          <div class="form-group">
            <label class="form-label">Nama Pengguna</label>
            <input type="text" id="pageSettingsName" class="form-input" style="padding-left: 14px;" value="${user.full_name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Nomor WhatsApp (Aktif)</label>
            <input type="text" id="pageSettingsWA" class="form-input" style="padding-left: 14px;" value="${user.whatsapp_number || ''}" placeholder="628xxxxxxxxxx">
            <span style="font-size: 0.74rem; color: var(--text-muted);">Format harus menggunakan kode negara 62. Pengingat jadwal posting dikirim ke nomor ini.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Jadwal Pengingat Standar</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <select id="pageSettingsOffset" class="form-select">
                <option value="0" ${user.default_remind_offset_days === 0 ? 'selected' : ''}>Hari-H Posting</option>
                <option value="1" ${user.default_remind_offset_days === 1 ? 'selected' : ''}>H-1 Sebelum Posting</option>
                <option value="3" ${user.default_remind_offset_days === 3 ? 'selected' : ''}>H-3 Sebelum Posting</option>
              </select>
              <input type="time" id="pageSettingsTime" class="form-input" style="padding-left: 14px;" value="${user.default_remind_time || '09:00'}">
            </div>
          </div>
          <div class="form-group">
            <label class="checklist-label">
              <input type="checkbox" id="pageSettingsEnableWA" class="checklist-checkbox" ${user.reminders_enabled !== false ? 'checked' : ''}>
              <span>Kirim pengingat otomatis ke WhatsApp</span>
            </label>
          </div>
          <div style="margin-top: 10px;">
            <button class="btn-primary" id="btnSavePageSettings"><i class="ph-bold ph-floppy-disk"></i> Simpan Pengaturan</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnSavePageSettings').addEventListener('click', () => {
      modals.openSettingsModal();
    });
  }
}

export const viewManager = new ViewManager();

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
