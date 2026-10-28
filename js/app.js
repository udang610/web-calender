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
import { CONFIG } from './config.js';
import { notify } from './notifications.js';

class CalendeyApp {
  async init() {
    console.log(`[Calendey] Initializing ${CONFIG.APP_NAME} v${CONFIG.APP_VERSION}...`);

    // 1. Setup Theme dari State
    const savedTheme = state.get('theme') || CONFIG.DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.syncThemeButtons(savedTheme);

    // 2. Inisialisasi Service Worker (PWA)
    this.registerServiceWorker();

    // 3. Inisialisasi Core Services
    modals.init();
    calendar.init();
    planner.init();
    viewManager.init();

    // 4. Inisialisasi Database & Fetch Master Data
    await db.init();

    // 5. Setup Global DOM Event Listeners
    this.bindEvents();

    // 6. Sinkronisasi Badge & User Profile
    this.updateUserUI();

    // 7. Initial View Render
    viewManager.switchView('calendar');
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
    document.querySelectorAll('.theme-btn').forEach(btn => {
      if (btn.getAttribute('data-set-theme') === activeTheme) {
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
  }

  bindEvents() {
    // 0. Auth Screen Handlers (Login Sederhana Tanpa Tab & Tanpa Masuk Cepat)
    const formLogin = document.getElementById('authScreenLoginForm');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('authScreenLoginEmail')?.value.trim();
        const pass = document.getElementById('authScreenLoginPass')?.value.trim();
        await auth.signIn(identifier, pass);
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
    const btnMenuSupabase = document.getElementById('btnMenuSupabase');
    const btnMenuAdminPanel = document.getElementById('btnMenuAdminPanel');
    const btnMenuLogout = document.getElementById('btnMenuLogout');

    if (btnMenuEditProfile) {
      btnMenuEditProfile.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.classList.remove('open');
        modals.openSettingsModal();
      });
    }

    if (btnMenuSupabase) {
      btnMenuSupabase.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.classList.remove('open');
        modals.openSupabaseSettingsModal();
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
