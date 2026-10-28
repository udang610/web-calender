// ========================================================================
// CALENDEY — Application Entry Point & Orchestrator
// Inisialisasi Lifecycle, Event Listeners Global, & Registrasi Service Worker
// ========================================================================

import { state } from './state.js';
import { db } from './db.js';
import { auth } from './auth.js';
import { calendar } from './calendar.js';
import { planner } from './planner.js';
import { viewManager } from './views.js';
import { modals } from './modals.js';
import { CONFIG, loadRuntimeConfig } from './config.js';
import { notify } from './notifications.js';
import { waGateway } from './whatsapp-gateway.js';

class CalendeyApp {
  async init() {
    console.log(`[Calendey] Initializing ${CONFIG.APP_NAME} v${CONFIG.APP_VERSION}...`);

    // 1. Setup Theme dari LocalStorage & State
    const savedTheme = localStorage.getItem('calendey_theme') || state.get('theme') || CONFIG.DEFAULT_THEME;
    state.set('theme', savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    window.calendeySyncThemeButtons = (theme) => this.syncThemeButtons(theme);
    this.syncThemeButtons(savedTheme);

    // 2. Inisialisasi Service Worker (PWA)
    this.registerServiceWorker();

    // 3. Inisialisasi Core Services
    modals.init();
    calendar.init();
    planner.init();
    viewManager.init();

    // 4. Inisialisasi Kredensial Runtime Aman & Database
    await loadRuntimeConfig();
    await db.init();
    auth.setupSessionListener();

    // 5. Setup Global DOM Event Listeners
    this.bindEvents();

    // 6. Sinkronisasi Badge & User Profile
    this.updateUserUI();

    // 7. Initial View Render
    viewManager.switchView('calendar');

    // 8. In-App Realtime Reminder Watcher
    this.initReminderChecker();

    console.log('[Calendey] Ready!');
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then(reg => console.log('[Calendey SW] Registered successfully:', reg.scope))
          .catch(err => console.log('[Calendey SW] Registration failed:', err));
      });
    }
  }

  syncThemeButtons(activeTheme) {
    const currentTheme = activeTheme || state.get('theme') || CONFIG.DEFAULT_THEME;
    document.querySelectorAll('.profile-theme-btn, [data-set-theme]').forEach(btn => {
      const btnTheme = btn.getAttribute('data-set-theme');
      if (btnTheme === currentTheme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  updateUserUI() {
    const user = state.get('user');
    const authScreen = document.getElementById('authScreen');
    const appContainer = document.getElementById('appContainer');
    const profileDropdown = document.getElementById('navbarProfileDropdown');
    const loginBtn = document.getElementById('navbarLoginBtn');

    if (!user) {
      // Belum login: Tampilkan Auth Screen, sembunyikan Dashboard
      if (authScreen) authScreen.style.display = 'flex';
      if (appContainer) appContainer.style.display = 'none';
      if (profileDropdown) profileDropdown.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      return;
    }

    // Sudah login: Sembunyikan Auth Screen, tampilkan Dashboard
    if (authScreen) authScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
    if (profileDropdown) profileDropdown.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'none';

    const name = user.full_name || 'Pengguna Calendey';
    const wa = user.whatsapp_number ? `+${user.whatsapp_number}` : 'Belum Ada Nomor WA';

    // Update in navbar (hanya Full Name)
    const navNameEl = document.getElementById('navbarUserName');
    const menuNameEl = document.getElementById('menuHeaderName');
    const menuWaEl = document.getElementById('menuHeaderWA');

    if (navNameEl) navNameEl.textContent = name;
    if (menuNameEl) menuNameEl.textContent = name;
    if (menuWaEl) menuWaEl.textContent = wa;

    // Sinkronkan tombol tema sesuai preferensi user
    this.syncThemeButtons(state.get('theme'));
  }

  initReminderChecker() {
    setInterval(async () => {
      const user = state.get('user');
      if (!user || user.reminders_enabled === false) return;

      const plans = state.get('contentPlans') || [];
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const nowTimeStr = `${currentHours}:${currentMinutes}`;
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      for (const plan of plans) {
        if (plan.is_posted) continue;
        if (plan.reminder_enabled === false) continue;
        if (!plan.planned_date) continue;

        const offset = parseInt(plan.remind_offset_days ?? user.default_remind_offset_days ?? 1, 10);
        const targetDate = new Date(plan.planned_date + 'T00:00:00');
        targetDate.setDate(targetDate.getDate() - offset);
        const planRemindDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        const planRemindTime = plan.remind_time || user.default_remind_time || '09:00';

        if (planRemindDateStr === todayDateStr && nowTimeStr >= planRemindTime) {
          const notifiedKey = `calendey_alerted_${plan.id}_${planRemindDateStr}_${planRemindTime}`;
          if (!sessionStorage.getItem(notifiedKey)) {
            sessionStorage.setItem(notifiedKey, 'true');

            // Cek apakah fitur kirim otomatis via WhatsApp Gateway aktif & memiliki token
            if (waGateway.isAutoSendEnabled() && waGateway.hasToken()) {
              console.log(`[Calendey Auto] Mengirim pengingat otomatis untuk "${plan.title}" ke HP...`);
              const res = await waGateway.dispatchPlanReminder(plan, user);
              if (res.success) {
                notify.success(`Pesan pengingat otomatis "${plan.title}" telah terkirim ke WhatsApp HP Anda!`);
                break;
              } else {
                console.warn('[Calendey Auto] Dispatch gateway error:', res.error);
                if (modals && typeof modals.openReminderAlertModal === 'function') {
                  modals.openReminderAlertModal(plan);
                }
                break;
              }
            } else {
              // Jika belum memiliki token gateway, tampilkan alert modal interaktif
              if (modals && typeof modals.openReminderAlertModal === 'function') {
                modals.openReminderAlertModal(plan);
              }
              break;
            }
          }
        }
      }
    }, 15000);
  }

  bindEvents() {
    // 0. Auth Screen Handlers (Login Sederhana Tanpa Tab & Tanpa Masuk Cepat)
    const formLogin = document.getElementById('authScreenLoginForm');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('authScreenLoginEmail')?.value.trim();
        const pass = document.getElementById('authScreenLoginPass')?.value.trim();
        const submitBtn = formLogin.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Memproses...';
        }

        const res = await auth.signIn(identifier, pass);

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="ph-bold ph-sign-in"></i> Masuk Sekarang';
        }

        if (res && res.success) {
          this.updateUserUI();
          viewManager.switchView('calendar');
        }
      });
    }

    // 1. Sidebar Nav Switching
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        if (view) {
          state.set('currentView', view);
          // Tutup sidebar di layar HP
          const sidebar = document.getElementById('mainSidebar');
          if (sidebar) sidebar.classList.remove('open');
        }
      });
    });

    // 2. Mobile Sidebar Toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('mainSidebar');
    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // 3. Theme Switcher Buttons (di Dalam Profile Dropdown & Modal)
    document.querySelectorAll('.profile-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosenTheme = btn.getAttribute('data-set-theme');
        window.calendeySetTheme(chosenTheme);
      });
    });

    // 4. Month Navigation Buttons
    const prevMonthBtn = document.getElementById('btnPrevMonth');
    const nextMonthBtn = document.getElementById('btnNextMonth');
    const todayBtn = document.getElementById('btnTodayShortcut');

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => calendar.prevMonth());
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => calendar.nextMonth());
    if (todayBtn) todayBtn.addEventListener('click', () => calendar.goToToday());

    // 5. Category Filter Chips in Calendar View
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const catIdAttr = chip.getAttribute('data-category');
        const catId = catIdAttr === 'all' ? null : parseInt(catIdAttr);

        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        state.set('categoryFilter', catId);
      });
    });

    // 6. Tombol Login di Navbar
    const loginBtn = document.getElementById('navbarLoginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => modals.openAuthModal('login'));
    }

    // 7. Navbar Profile Dropdown Toggle
    const profileDropdown = document.getElementById('navbarProfileDropdown');
    const userBtn = document.getElementById('navbarUserBtn');

    if (userBtn && profileDropdown) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('open');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target)) {
          profileDropdown.classList.remove('open');
        }
      });
    }

    // Dropdown Action Items
    const btnMenuEditProfile = document.getElementById('btnMenuEditProfile');
    const btnMenuAdminPanel = document.getElementById('btnMenuAdminPanel');
    const btnMenuLogout = document.getElementById('btnMenuLogout');

    if (btnMenuEditProfile) {
      btnMenuEditProfile.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.classList.remove('open');
        modals.openSettingsModal();
      });
    }

    if (btnMenuAdminPanel) {
      btnMenuAdminPanel.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.classList.remove('open');
        modals.openAdminPanelModal();
      });
    }

    if (btnMenuLogout) {
      btnMenuLogout.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.classList.remove('open');
        window.calendeyLogout();
      });
    }

    // Subscribe to state changes for plan count badge
    state.subscribe('contentPlans', (plans) => {
      const badge = document.getElementById('sidebarPlansBadge');
      if (badge) badge.textContent = (plans || []).length;
    });

    state.subscribe('user', () => this.updateUserUI());
  }
}

// Bootstrap saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  const app = new CalendeyApp();
  app.init();
});
