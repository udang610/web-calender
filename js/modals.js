// ========================================================================
// CALENDEY — Modals & Dialog Manager
// Form Konten, Modal Profil Pengaturan, & Preview Desain
// ========================================================================

import { state } from './state.js';
import { CONFIG } from './config.js';
import { db } from './db.js';
import { auth } from './auth.js';
import { uploadService } from './upload.js';
import { notify } from './notifications.js';

class ModalManager {
  constructor() {
    this.modalOverlay = null;
    this.tempUploadedAssets = [];
    this.selectedPlatforms = ['instagram'];
  }

  init() {
    this.modalOverlay = document.getElementById('globalModalOverlay');
    if (!this.modalOverlay) return;

    // Close when clicking backdrop
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.close();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  close() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
      this.modalOverlay.innerHTML = '';
    }
    this.tempUploadedAssets = [];
  }

  openContentForm(initialData = {}) {
    if (!this.modalOverlay) this.init();

    const isEdit = Boolean(initialData.id);
    const nationalDays = state.get('nationalDays') || [];
    this.tempUploadedAssets = initialData.content_assets ? [...initialData.content_assets] : [];
    this.selectedPlatforms = initialData.platforms && initialData.platforms.length > 0 
      ? [...initialData.platforms] 
      : ['instagram'];

    const modalHtml = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Rencana Konten' : 'Buat Rencana Konten Baru'}</h3>
          <button class="modal-close" onclick="window.calendeyCloseModal()"><i class="ph-bold ph-x"></i></button>
        </div>
        <div class="modal-body">
          <!-- Judul Konten -->
          <div class="form-group">
            <label class="form-label">Judul Konten <span style="color: var(--danger)">*</span></label>
            <input type="text" id="modalPlanTitle" class="form-input" style="padding-left: 14px;" 
                   placeholder="Contoh: Infografis Sejarah Hari Sumpah Pemuda" 
                   value="${initialData.title || ''}" maxlength="150" required>
          </div>

          <!-- Hari Nasional Terkait -->
          <div class="form-group">
            <label class="form-label">Hari Nasional Terkait</label>
            <select id="modalPlanNationalDay" class="form-select">
              <option value="">-- Tanpa Hari Nasional (Event Mandiri) --</option>
              ${nationalDays.map(n => `
                <option value="${n.id}" ${initialData.national_day_id == n.id ? 'selected' : ''}>
                  ${n.day}/${n.month} — ${n.name}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Tanggal & Jam Jadwal -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Tanggal Pelaksanaan <span style="color: var(--danger)">*</span></label>
              <input type="date" id="modalPlanDate" class="form-input" style="padding-left: 14px;" 
                     value="${initialData.planned_date || state.get('selectedDate')}">
            </div>
            <div class="form-group">
              <label class="form-label">Target Jam Posting</label>
              <input type="time" id="modalPlanTime" class="form-input" style="padding-left: 14px;" 
                     value="${initialData.scheduled_at ? new Date(initialData.scheduled_at).toTimeString().slice(0, 5) : '08:00'}">
            </div>
          </div>

          <!-- Pilihan Platform -->
          <div class="form-group">
            <label class="form-label">Platform Sosial Media</label>
            <div class="platform-chips-selector" id="modalPlatformSelector">
              ${CONFIG.PLATFORMS.map(p => `
                <button type="button" class="platform-chip-btn ${this.selectedPlatforms.includes(p.id) ? 'selected' : ''}" 
                        data-platform="${p.id}">
                  <i class="ph-bold ph-${p.icon}"></i> ${p.name}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Status Alur Kerja -->
          <div class="form-group">
            <label class="form-label">Status Alur Kerja</label>
            <select id="modalPlanStatus" class="form-select">
              <option value="idea" ${initialData.status === 'idea' ? 'selected' : ''}>💡 Ide Konten</option>
              <option value="design_done" ${initialData.status === 'design_done' ? 'selected' : ''}>🎨 Desain Dibuat</option>
              <option value="ready" ${initialData.status === 'ready' ? 'selected' : ''}>🚀 Siap Posting</option>
              <option value="posted" ${initialData.status === 'posted' ? 'selected' : ''}>✅ Sudah Diposting</option>
            </select>
          </div>

          <!-- Upload Dropzone Aset Desain -->
          <div class="form-group">
            <label class="form-label">Aset Poster / Desain (Maksimal 10 File @ 5MB)</label>
            <div class="dropzone-area" id="modalDropzone">
              <i class="ph-bold ph-cloud-arrow-up"></i>
              <p>Klik atau seret file desain ke sini (JPG, PNG, WebP)</p>
              <input type="file" id="modalFileInput" multiple accept="image/jpeg,image/png,image/webp" style="display: none;">
            </div>
            <div class="plan-thumbnails" id="modalAssetsPreview" style="margin-top: 10px;">
              ${this.renderAssetsPreview()}
            </div>
          </div>

          <!-- Caption & Hastags -->
          <div class="form-group">
            <label class="form-label">Draft Caption & Hashtags</label>
            <textarea id="modalPlanCaption" class="form-textarea" placeholder="Tuliskan draft caption yang akan diposting...">${initialData.caption || ''}</textarea>
          </div>

          <!-- Catatan Internal -->
          <div class="form-group">
            <label class="form-label">Catatan Tim / Brief</label>
            <textarea id="modalPlanNotes" class="form-textarea" style="min-height: 60px;" placeholder="Catatan internal atau referensi visual...">${initialData.notes || ''}</textarea>
          </div>

          <!-- Pengingat WhatsApp Langsung Per Rencana Konten -->
          <div class="form-group" style="padding: 12px 14px; background: var(--bg-subtle); border: 1px solid var(--surface-border); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="form-label" style="margin: 0; display: flex; align-items: center; gap: 6px; font-weight: 700;">
                <i class="ph-bold ph-whatsapp-logo" style="color: #25d366; font-size: 1.15rem;"></i>
                Pengingat WhatsApp
              </label>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                <input type="checkbox" id="modalPlanRemindEnabled" ${initialData.reminder_enabled !== false ? 'checked' : ''}>
                <span>Aktifkan</span>
              </label>
            </div>
            <div id="modalReminderSettings" style="display: ${initialData.reminder_enabled !== false ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
              <div>
                <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; margin-bottom: 3px; display: block;">Waktu Pengingat</label>
                <select id="modalPlanRemindTiming" class="form-select" style="font-size: 0.8rem; padding: 6px 10px;">
                  <option value="1" ${initialData.remind_offset_days == 1 ? 'selected' : ''}>H-1 (Satu Hari Sebelum)</option>
                  <option value="0" ${initialData.remind_offset_days == 0 ? 'selected' : ''}>Hari-H (Di Hari Pelaksanaan)</option>
                  <option value="3" ${initialData.remind_offset_days == 3 ? 'selected' : ''}>H-3 (Tiga Hari Sebelum)</option>
                  <option value="7" ${initialData.remind_offset_days == 7 ? 'selected' : ''}>H-7 (Satu Minggu Sebelum)</option>
                </select>
              </div>
              <div>
                <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; margin-bottom: 3px; display: block;">Jam Kirim Pesan</label>
                <input type="time" id="modalPlanRemindTime" class="form-input" style="font-size: 0.8rem; padding: 6px 10px;" value="${initialData.remind_time || '09:00'}">
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          ${isEdit ? `<button type="button" class="btn-secondary" style="color: var(--danger); border-color: var(--danger-subtle);" onclick="window.calendeyDeletePlan('${initialData.id}')">Hapus Konten</button>` : ''}
          <button type="button" class="btn-secondary" onclick="window.calendeyCloseModal()">Batal</button>
          <button type="button" class="btn-primary" id="modalBtnSavePlan">Simpan Rencana</button>
        </div>
      </div>
    `;

    this.modalOverlay.innerHTML = modalHtml;
    this.modalOverlay.classList.add('active');

    // Attach Event Listeners
    this.attachFormListeners(initialData);
  }

  renderAssetsPreview() {
    if (!this.tempUploadedAssets || this.tempUploadedAssets.length === 0) return '';
    return this.tempUploadedAssets.map((asset, idx) => `
      <div style="position: relative; display: inline-block;">
        <img src="${asset.storage_path}" class="plan-thumb-img" alt="Desain ${idx + 1}" onclick="window.calendeyPreviewImage('${asset.storage_path}')">
        <button type="button" onclick="window.calendeyRemoveAsset(${idx})" style="position: absolute; top: -6px; right: -6px; background: var(--danger); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
    `).join('');
  }

  attachFormListeners(initialData) {
    // Platform toggles
    const platformBtns = this.modalOverlay.querySelectorAll('.platform-chip-btn');
    platformBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const plat = btn.getAttribute('data-platform');
        if (this.selectedPlatforms.includes(plat)) {
          this.selectedPlatforms = this.selectedPlatforms.filter(p => p !== plat);
          btn.classList.remove('selected');
        } else {
          this.selectedPlatforms.push(plat);
          btn.classList.add('selected');
        }
      });
    });

    // Upload Dropzone
    const dropzone = document.getElementById('modalDropzone');
    const fileInput = document.getElementById('modalFileInput');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files) {
          await this.handleFilesUpload(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', async (e) => {
        if (e.target.files) {
          await this.handleFilesUpload(e.target.files);
        }
      });
    }

    // Toggle reminder options
    const remindCheck = document.getElementById('modalPlanRemindEnabled');
    const remindBox = document.getElementById('modalReminderSettings');
    if (remindCheck && remindBox) {
      remindCheck.addEventListener('change', () => {
        remindBox.style.display = remindCheck.checked ? 'grid' : 'none';
      });
    }

    // Save Action
    const saveBtn = document.getElementById('modalBtnSavePlan');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const title = document.getElementById('modalPlanTitle').value.trim();
        const date = document.getElementById('modalPlanDate').value;
        const time = document.getElementById('modalPlanTime').value;
        const nationalDayId = document.getElementById('modalPlanNationalDay').value;
        const status = document.getElementById('modalPlanStatus').value;
        const caption = document.getElementById('modalPlanCaption').value.trim();
        const notes = document.getElementById('modalPlanNotes').value.trim();
        const reminderEnabled = document.getElementById('modalPlanRemindEnabled')?.checked ?? true;
        const remindOffsetDays = parseInt(document.getElementById('modalPlanRemindTiming')?.value || '1');
        const remindTime = document.getElementById('modalPlanRemindTime')?.value || '09:00';

        if (!title) {
          notify.error('Judul konten wajib diisi');
          return;
        }

        const scheduledAt = date && time ? `${date}T${time}:00Z` : null;

        const payload = {
          id: initialData.id,
          title,
          planned_date: date,
          scheduled_at: scheduledAt,
          national_day_id: nationalDayId ? parseInt(nationalDayId) : null,
          status,
          design_done: status === 'design_done' || status === 'ready' || status === 'posted',
          is_posted: status === 'posted',
          platforms: this.selectedPlatforms,
          caption,
          notes,
          reminder_enabled: reminderEnabled,
          remind_offset_days: remindOffsetDays,
          remind_time: remindTime,
          content_assets: this.tempUploadedAssets
        };

        await db.saveContentPlan(payload);
        this.close();
      });
    }
  }

  async handleFilesUpload(files) {
    if (this.tempUploadedAssets.length + files.length > CONFIG.MAX_ASSETS_PER_PLAN) {
      notify.error(`Maksimal ${CONFIG.MAX_ASSETS_PER_PLAN} gambar diperbolehkan per rencana.`);
      return;
    }
    const processed = await uploadService.processFiles(files);
    this.tempUploadedAssets.push(...processed);
    const previewContainer = document.getElementById('modalAssetsPreview');
    if (previewContainer) {
      previewContainer.innerHTML = this.renderAssetsPreview();
    }
  }

  openAuthModal(defaultTab = 'login') {
    if (!this.modalOverlay) this.init();

    const modalHtml = `
      <div class="modal-card" style="max-width: 460px;">
        <div class="modal-header">
          <div style="display: flex; gap: 8px;">
            <button type="button" id="tabLoginBtn" class="theme-btn ${defaultTab === 'login' ? 'active' : ''}" style="padding: 6px 14px; font-weight: 700;">
              Masuk Akun
            </button>
            <button type="button" id="tabRegisterBtn" class="theme-btn ${defaultTab === 'register' ? 'active' : ''}" style="padding: 6px 14px; font-weight: 700;">
              Daftar Baru
            </button>
          </div>
          <button class="modal-close" onclick="window.calendeyCloseModal()"><i class="ph-bold ph-x"></i></button>
        </div>

        <div class="modal-body">
          <!-- FORM LOGIN -->
          <div id="authLoginForm" style="display: ${defaultTab === 'login' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
            <div style="text-align: center; margin-bottom: 6px;">
              <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--text);">Masuk ke Calendey</h4>
              <p style="font-size: 0.78rem; color: var(--text-muted);">Kelola kalender hari nasional dan konten media sosial Anda</p>
            </div>
            <div class="form-group">
              <label class="form-label">Alamat Email</label>
              <input type="email" id="loginEmail" class="form-input" style="padding-left: 14px;" placeholder="nama@email.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="loginPassword" class="form-input" style="padding-left: 14px;" placeholder="••••••••" required>
            </div>
            <button type="button" class="btn-primary" id="btnSubmitLogin" style="width: 100%; justify-content: center; margin-top: 4px;">
              <i class="ph-bold ph-sign-in"></i> Masuk Akun
            </button>
            <div style="text-align: center; margin: 6px 0;">
              <span style="font-size: 0.75rem; color: var(--text-subtle);">— ATAU —</span>
            </div>
            <button type="button" class="btn-secondary" id="btnGuestLogin" style="width: 100%; justify-content: center;">
              <i class="ph-bold ph-user-circle"></i> Masuk Mode Demo / Tamu
            </button>
          </div>

          <!-- FORM REGISTER -->
          <div id="authRegisterForm" style="display: ${defaultTab === 'register' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
            <div style="text-align: center; margin-bottom: 6px;">
              <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--text);">Buat Akun Baru</h4>
              <p style="font-size: 0.78rem; color: var(--text-muted);">Dapatkan pengingat otomatis ke nomor WhatsApp Anda</p>
            </div>
            <div class="form-group">
              <label class="form-label">Nama Lengkap <span style="color: var(--danger)">*</span></label>
              <input type="text" id="regFullName" class="form-input" style="padding-left: 14px;" placeholder="Contoh: Dhafin Shabir" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nomor WhatsApp Aktif <span style="color: var(--danger)">*</span></label>
              <input type="text" id="regWhatsapp" class="form-input" style="padding-left: 14px;" placeholder="628xxxxxxxxxx" required>
              <span style="font-size: 0.7rem; color: var(--text-muted);">Gunakan format internasional tanpa spasi (awali dengan 62)</span>
            </div>
            <div class="form-group">
              <label class="form-label">Alamat Email <span style="color: var(--danger)">*</span></label>
              <input type="email" id="regEmail" class="form-input" style="padding-left: 14px;" placeholder="nama@email.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password <span style="color: var(--danger)">*</span></label>
              <input type="password" id="regPassword" class="form-input" style="padding-left: 14px;" placeholder="Minimal 8 karakter" required>
            </div>
            <button type="button" class="btn-primary" id="btnSubmitRegister" style="width: 100%; justify-content: center; margin-top: 4px;">
              <i class="ph-bold ph-user-plus"></i> Daftar Sekarang
            </button>
          </div>
        </div>
      </div>
    `;

    this.modalOverlay.innerHTML = modalHtml;
    this.modalOverlay.classList.add('active');

    // Tab toggle events
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabRegisterBtn = document.getElementById('tabRegisterBtn');
    const loginForm = document.getElementById('authLoginForm');
    const registerForm = document.getElementById('authRegisterForm');

    tabLoginBtn.addEventListener('click', () => {
      tabLoginBtn.classList.add('active');
      tabRegisterBtn.classList.remove('active');
      loginForm.style.display = 'flex';
      registerForm.style.display = 'none';
    });

    tabRegisterBtn.addEventListener('click', () => {
      tabRegisterBtn.classList.add('active');
      tabLoginBtn.classList.remove('active');
      registerForm.style.display = 'flex';
      loginForm.style.display = 'none';
    });

    // Handle Login
    document.getElementById('btnSubmitLogin').addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const res = await auth.signIn(email, password);
      if (res.success) {
        this.close();
      }
    });

    // Handle Guest / Demo Login
    document.getElementById('btnGuestLogin').addEventListener('click', async () => {
      const demoUser = {
        id: 'user-demo-' + Date.now(),
        full_name: 'Dhafin Shabir Alfatih',
        email: 'dhafin@calendey.app',
        whatsapp_number: '6281234567890',
        theme: state.get('theme') || 'light',
        reminders_enabled: true,
        default_remind_offset_days: 1,
        default_remind_time: '09:00',
        timezone: 'Asia/Jakarta'
      };
      state.set('user', demoUser);
      localStorage.setItem('calendey_user_profile', JSON.stringify(demoUser));
      notify.success('Masuk sebagai mode demo pengguna');
      this.close();
    });

    // Handle Register
    document.getElementById('btnSubmitRegister').addEventListener('click', async () => {
      const fullName = document.getElementById('regFullName').value.trim();
      const whatsapp = document.getElementById('regWhatsapp').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value.trim();

      const res = await auth.signUp(email, password, fullName, whatsapp);
      if (res.success) {
        this.close();
      }
    });
  }

  openSettingsModal() {
    if (!this.modalOverlay) this.init();
    const user = state.get('user') || {};

    const modalHtml = `
      <div class="modal-card">
        <div class="modal-header">
          <h3>Pengaturan Profil & Nomor WhatsApp</h3>
          <button class="modal-close" onclick="window.calendeyCloseModal()"><i class="ph-bold ph-x"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Nama Pengguna</label>
            <input type="text" id="settingsFullName" class="form-input" style="padding-left: 14px;" value="${user.full_name || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Nomor WhatsApp (Aktif Pengingat)</label>
            <div style="position: relative;">
              <input type="text" id="settingsWhatsapp" class="form-input" style="padding-left: 14px;" placeholder="6281234567890" value="${user.whatsapp_number || ''}">
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">
              Pesan pengingat jadwal posting konten akan dikirimkan otomatis ke nomor ini (format: 628xxxxxxxxxx).
            </span>
          </div>

          <div class="form-group">
            <label class="form-label">Pilihan Tema Tampilan</label>
            <div class="profile-theme-buttons">
              <button type="button" class="profile-theme-btn ${state.get('theme') === 'light' ? 'active' : ''}" data-set-theme="light" onclick="window.calendeySetTheme('light')">
                <i class="ph-bold ph-sun"></i> Light
              </button>
              <button type="button" class="profile-theme-btn ${state.get('theme') === 'dark' ? 'active' : ''}" data-set-theme="dark" onclick="window.calendeySetTheme('dark')">
                <i class="ph-bold ph-moon"></i> Dark
              </button>
              <button type="button" class="profile-theme-btn ${state.get('theme') === 'pink' ? 'active' : ''}" data-set-theme="pink" onclick="window.calendeySetTheme('pink')">
                <i class="ph-bold ph-heart"></i> Soft Pink
              </button>
            </div>
          </div>

          <!-- Informasi Status Cloud Database -->
          <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-light); margin-top: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 0.78rem; font-weight: 700; color: var(--text);">Status Supabase Database</span>
              <span style="font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: var(--radius-pill); background: ${db.client ? 'var(--success-subtle)' : 'var(--warning-subtle)'}; color: ${db.client ? 'var(--success)' : 'var(--warning)'};">
                ${db.client ? '● Terhubung Aktif' : '○ Mode Lokal'}
              </span>
            </div>
            <p style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.3;">
              Data Anda tersinkronisasi otomatis dengan aman via PostgreSQL & Supabase Auth.
            </p>
          </div>
        </div>

        <div class="modal-footer" style="justify-content: space-between;">
          <button type="button" class="btn-secondary" style="color: var(--danger);" onclick="window.calendeyLogout()">
            <i class="ph-bold ph-sign-out"></i> Keluar Akun
          </button>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn-secondary" onclick="window.calendeyCloseModal()">Batal</button>
            <button type="button" class="btn-primary" id="btnSaveSettings">Simpan Perubahan</button>
          </div>
        </div>
      </div>
    `;

    this.modalOverlay.innerHTML = modalHtml;
    this.modalOverlay.classList.add('active');

    document.getElementById('btnSaveSettings').addEventListener('click', async () => {
      const full_name = document.getElementById('settingsFullName').value.trim();
      const whatsapp_number = document.getElementById('settingsWhatsapp').value.trim();

      if (!full_name) {
        notify.error('Nama pengguna wajib diisi');
        return;
      }

      // Regex validasi nomor WA
      if (whatsapp_number && !/^62[0-9]{8,13}$/.test(whatsapp_number)) {
        notify.error('Nomor WhatsApp harus diawali kode 62 (contoh: 6281234567890)');
        return;
      }

      await auth.updateProfile({
        full_name,
        whatsapp_number
      });

      this.close();
    });
  }

  openAdminPanelModal() {
    if (!this.modalOverlay) this.init();

    // Ambil list akun tersimpan
    let accounts = [];
    try {
      accounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    } catch (e) {
      accounts = [];
    }

    if (accounts.length === 0) {
      accounts = [
        {
          id: 'acc-1',
          name: 'Dhafin Shabir Alfatih',
          email: 'dhafinshabir610@gmail.com',
          whatsapp: '6281234567890',
          role: 'Admin',
          created_at: '2026-10-28'
        }
      ];
      localStorage.setItem('calendey_all_accounts', JSON.stringify(accounts));
    }

    const modalHtml = `
      <div class="modal-card" style="max-width: 680px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="ph-bold ph-shield-check" style="font-size: 1.3rem; color: var(--primary);"></i>
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text);">Panel Admin — Kelola Akun</h3>
              <p style="font-size: 0.74rem; color: var(--text-muted);">Atur dan buat akun pengguna (username, email & password)</p>
            </div>
          </div>
          <button class="modal-close" onclick="window.calendeyCloseModal()"><i class="ph-bold ph-x"></i></button>
        </div>

        <div class="modal-body" style="gap: 20px;">
          <!-- Form Tambah Akun Baru -->
          <div style="background: var(--bg-subtle); padding: 18px; border-radius: var(--radius-lg); border: 1px solid var(--border-light);">
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
              <i class="ph-bold ph-user-plus" style="color: var(--primary);"></i> + Buat Akun Baru
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Nama / Username</label>
                <input type="text" id="adminNewName" class="form-input" style="padding-left: 14px;" placeholder="Nama Pengguna" required>
              </div>
              <div class="form-group">
                <label class="form-label">Nomor WhatsApp</label>
                <input type="text" id="adminNewWA" class="form-input" style="padding-left: 14px;" placeholder="628xxxxxxxxxx">
              </div>
              <div class="form-group">
                <label class="form-label">Email Akun</label>
                <input type="email" id="adminNewEmail" class="form-input" style="padding-left: 14px;" placeholder="user@calendey.app" required>
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" id="adminNewPass" class="form-input" style="padding-left: 14px;" placeholder="Min. 8 karakter" required>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
              <select id="adminNewRole" class="form-select" style="max-width: 160px;">
                <option value="Admin">Role: Admin</option>
                <option value="Creator" selected>Role: Creator</option>
                <option value="Member">Role: Member</option>
              </select>
              <button type="button" class="btn-primary" id="btnAdminSaveAccount" style="padding: 7px 16px; font-size: 0.84rem;">
                <i class="ph-bold ph-check"></i> Simpan Akun Baru
              </button>
            </div>
          </div>

          <!-- Daftar Akun Terdaftar -->
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text); margin-bottom: 10px;">
              Daftar Akun Terdaftar (${accounts.length})
            </h4>
            <div style="overflow-x: auto; border: 1px solid var(--border-light); border-radius: var(--radius-md);">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Pengguna</th>
                    <th>Email</th>
                    <th>Nomor WhatsApp</th>
                    <th>Role</th>
                    <th style="text-align: right;">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${accounts.map((acc, idx) => `
                    <tr>
                      <td>
                        <strong>${acc.name}</strong>
                      </td>
                      <td style="color: var(--text-muted);">${acc.email}</td>
                      <td>${acc.whatsapp ? '+' + acc.whatsapp : '-'}</td>
                      <td><span class="admin-role-badge">${acc.role || 'Member'}</span></td>
                      <td style="text-align: right;">
                        ${idx > 0 ? `<button type="button" class="btn-secondary" style="padding: 3px 8px; font-size: 0.72rem; color: var(--danger);" onclick="window.calendeyDeleteAccount(${idx})">Hapus</button>` : '<span style="font-size: 0.7rem; color: var(--text-subtle);">Utama</span>'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" onclick="window.calendeyCloseModal()">Tutup</button>
        </div>
      </div>
    `;

    this.modalOverlay.innerHTML = modalHtml;
    this.modalOverlay.classList.add('active');

    document.getElementById('btnAdminSaveAccount').addEventListener('click', async () => {
      const name = document.getElementById('adminNewName').value.trim();
      const email = document.getElementById('adminNewEmail').value.trim();
      const pass = document.getElementById('adminNewPass').value.trim();
      const wa = document.getElementById('adminNewWA').value.trim();
      const role = document.getElementById('adminNewRole').value;

      if (!name || !email || !pass) {
        notify.error('Nama, email, dan password wajib diisi');
        return;
      }

      if (pass.length < 8) {
        notify.error('Password minimal 8 karakter');
        return;
      }

      // 1. Simpan ke Supabase Auth jika cloud aktif
      if (db.client) {
        try {
          await db.client.auth.signUp({
            email,
            password: pass,
            options: { data: { full_name: name, whatsapp_number: wa } }
          });
        } catch (e) {
          console.warn('[Admin] Cloud sync note:', e);
        }
      }

      // 2. Simpan ke local accounts
      accounts.push({
        id: 'acc-' + Date.now(),
        name,
        email,
        whatsapp: wa,
        role,
        created_at: new Date().toISOString().split('T')[0]
      });

      localStorage.setItem('calendey_all_accounts', JSON.stringify(accounts));
      notify.success(`Akun ${name} berhasil dibuat!`);
      this.openAdminPanelModal();
    });
  }

  openSupabaseSettingsModal() {
    if (!this.modalOverlay) this.init();

    const currentUrl = CONFIG.SUPABASE_URL;
    const currentKey = CONFIG.SUPABASE_ANON_KEY;
    const isConnected = Boolean(db.client);

    this.modalOverlay.innerHTML = `
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header">
          <div class="modal-title-box">
            <h3><i class="ph-bold ph-database" style="color: #10b981; margin-right: 6px;"></i>Koneksi Supabase</h3>
            <p>Database Cloud & Sinkronisasi Realtime Calendey</p>
          </div>
          <button type="button" class="modal-close-btn" onclick="window.calendeyCloseModal()">
            <i class="ph-bold ph-x"></i>
          </button>
        </div>

        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Status Banner -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 8px #10b981;"></span>
              <div>
                <div style="font-weight: 700; font-size: 0.85rem; color: var(--text);">Status: Terhubung ke Cloud</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Project Ref: <code>onikjvzkbhpbubnqjmib</code> (udang610's Org)</div>
              </div>
            </div>
            <span style="font-size: 0.7rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.15); padding: 2px 8px; border-radius: var(--radius-pill);">Active</span>
          </div>

          <form id="formSupabaseConfig" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label">Supabase Project URL</label>
              <input type="text" id="supabaseUrlInput" class="form-input" value="${currentUrl}" placeholder="https://xyzcompany.supabase.co" required>
            </div>

            <div class="form-group">
              <label class="form-label">Supabase Anon Key</label>
              <textarea id="supabaseKeyInput" class="form-textarea" rows="3" style="font-family: monospace; font-size: 0.75rem;" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." required>${currentKey}</textarea>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 6px;">
              <button type="button" class="btn-secondary" style="flex: 1; justify-content: center;" onclick="window.calendeyCloseModal()">Tutup</button>
              <button type="submit" class="btn-primary" style="flex: 1.5; justify-content: center;">
                <i class="ph-bold ph-floppy-disk"></i> Simpan & Hubungkan
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.modalOverlay.classList.add('active');

    const form = document.getElementById('formSupabaseConfig');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('supabaseUrlInput').value.trim();
        const key = document.getElementById('supabaseKeyInput').value.trim();

        if (!url || !key) {
          notify.error('URL dan Anon Key wajib diisi');
          return;
        }

        localStorage.setItem('calendey_supabase_url', url);
        localStorage.setItem('calendey_supabase_anon_key', key);
        CONFIG.SUPABASE_URL = url;
        CONFIG.SUPABASE_ANON_KEY = key;

        if (window.supabase) {
          try {
            db.client = window.supabase.createClient(url, key);
            db.isCloudConnected = true;
          } catch (err) {
            console.warn('[Calendey] Client recreate note:', err);
          }
        }

        notify.success('Koneksi Supabase berhasil diperbarui!');
        this.close();
      });
    }
  }

  previewImage(src) {
    if (!this.modalOverlay) this.init();
    this.modalOverlay.innerHTML = `
      <div style="position: relative; max-width: 90vw; max-height: 90vh;">
        <button onclick="window.calendeyCloseModal()" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.7); color: #fff; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;">✕</button>
        <img src="${src}" style="max-width: 100%; max-height: 85vh; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); object-fit: contain;">
      </div>
    `;
    this.modalOverlay.classList.add('active');
  }
}

export const modals = new ModalManager();

// Global window helpers for HTML inline clicks
window.calendeyCloseModal = () => modals.close();
window.calendeyOpenAuth = (tab) => modals.openAuthModal(tab);
window.calendeyLogout = async () => {
  await auth.signOut();
  modals.close();
};
window.calendeySetTheme = async (themeName) => {
  if (!['light', 'dark', 'pink'].includes(themeName)) return;

  state.set('theme', themeName);
  document.documentElement.setAttribute('data-theme', themeName);

  // 1. Sinkronkan tampilan semua tombol tema di UI (dropdown & modal)
  if (typeof window.calendeySyncThemeButtons === 'function') {
    window.calendeySyncThemeButtons(themeName);
  } else {
    document.querySelectorAll('.profile-theme-btn, [data-set-theme]').forEach(b => {
      if (b.getAttribute('data-set-theme') === themeName) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  // 2. Simpan perubahan tema ke database Supabase Cloud
  try {
    if (auth && typeof auth.updateProfile === 'function') {
      await auth.updateProfile({ theme: themeName }, false);
    }
  } catch (err) {
    console.warn('[Calendey] Gagal update tema ke Supabase:', err);
  }

  notify.info(`Tema diubah ke ${themeName.toUpperCase()}`);
};
window.calendeyDeleteAccount = (idx) => {
  try {
    let accounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    const removed = accounts.splice(idx, 1);
    localStorage.setItem('calendey_all_accounts', JSON.stringify(accounts));
    notify.info(`Akun ${removed[0]?.name || ''} telah dihapus`);
    modals.openAdminPanelModal();
  } catch (e) { }
};

// Global window helpers for HTML inline clicks
window.calendeyCloseModal = () => modals.close();
window.calendeyPreviewImage = (src) => modals.previewImage(src);
window.calendeyRemoveAsset = (idx) => {
  modals.tempUploadedAssets.splice(idx, 1);
  const el = document.getElementById('modalAssetsPreview');
  if (el) el.innerHTML = modals.renderAssetsPreview();
};
window.calendeyOpenPlanDetail = (planId) => {
  const plan = (state.get('contentPlans') || []).find(p => p.id === planId);
  if (plan) modals.openContentForm(plan);
};
window.calendeyOpenNewPlanOnDate = (dateStr, nationalDayId) => {
  modals.openContentForm({
    planned_date: dateStr,
    national_day_id: nationalDayId || null
  });
};
window.calendeyDeletePlan = async (planId) => {
  if (confirm('Apakah Anda yakin ingin menghapus rencana konten ini?')) {
    await db.deleteContentPlan(planId);
    modals.close();
  }
};
