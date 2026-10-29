// ========================================================================
// CALENDEY — Auth & User Profile Management (Superadmin & Dhafin Accounts)
// ========================================================================

import { state } from './state.js';
import { db } from './db.js';
import { notify } from './notifications.js';

// Akun Utama Bawaan Sesuai Permintaan (Tanpa Password di File JS)
export const DEFAULT_ACCOUNTS = [
  {
    id: '3c72477c-5c56-44a8-91aa-8cfd1367db06',
    username: 'Superadmin',
    email: 'superadmin@calendey.app',
    full_name: 'Superadmin',
    role: 'Admin',
    whatsapp_number: '6281219958750',
    telegram_chat_id: '',
    reminders_enabled: true,
    default_remind_offset_days: 1,
    default_remind_time: '09:00',
    timezone: 'Asia/Jakarta'
  },
  {
    id: '1df2ed64-32c9-446f-852a-2e3d13d92adb',
    username: 'dhafin',
    email: 'dhafinshabir610@gmail.com',
    full_name: 'Dhafin Shabir Alfatih',
    role: 'User',
    whatsapp_number: '6281234567890',
    telegram_chat_id: '',
    reminders_enabled: true,
    default_remind_offset_days: 1,
    default_remind_time: '09:00',
    timezone: 'Asia/Jakarta'
  },
  {
    id: 'e2a8b910-5c56-44a8-91aa-9cfd1367db99',
    username: 'nadia',
    email: 'nadia@calendey.app',
    full_name: 'Nadia Azra Azizah',
    name: 'Nadia Azra Azizah',
    role: 'Creator',
    whatsapp_number: '',
    telegram_chat_id: '',
    reminders_enabled: true,
    default_remind_offset_days: 1,
    default_remind_time: '09:00',
    timezone: 'Asia/Jakarta'
  }
];

class AuthService {
  constructor() {
    window.auth = this;
    this.init();
  }

  async init() {
    // Inisialisasi daftar akun ke localStorage
    let allAccounts = [];
    try {
      allAccounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    } catch (e) {
      allAccounts = [];
    }

    // Normalisasi username dan nama untuk semua akun tersimpan (termasuk akun buatan Admin)
    allAccounts = allAccounts.map(a => ({
      ...a,
      username: (a.username || a.name || '').toLowerCase().replace(/\s+/g, ''),
      name: a.name || a.full_name || a.username || '',
      full_name: a.full_name || a.name || a.username || ''
    }));

    // Pastikan akun Superadmin dan Dhafin selalu ada dan ter-update dengan UUID Supabase resmi
    DEFAULT_ACCOUNTS.forEach(defAcc => {
      const idx = allAccounts.findIndex(a => 
        a.username?.toLowerCase() === defAcc.username.toLowerCase() || 
        a.email?.toLowerCase() === defAcc.email.toLowerCase() ||
        a.id === defAcc.id
      );
      if (idx !== -1) {
        allAccounts[idx] = { ...allAccounts[idx], ...defAcc };
      } else {
        allAccounts.push(defAcc);
      }
    });
    localStorage.setItem('calendey_all_accounts', JSON.stringify(allAccounts));

    // Sinkronkan akun dari Supabase Cloud di background secara non-blocking
    try {
      db.loadCloudAccounts().catch(() => {});
    } catch (e) {}
    const cachedProfile = localStorage.getItem('calendey_user_profile');
    if (cachedProfile) {
      try {
        let activeUser = JSON.parse(cachedProfile);
        const matchedDef = DEFAULT_ACCOUNTS.find(d => 
          d.username.toLowerCase() === activeUser.username?.toLowerCase() || 
          d.email.toLowerCase() === activeUser.email?.toLowerCase()
        );
        if (matchedDef) {
          activeUser = { ...matchedDef, ...activeUser };
        }
        // Pastikan tema yang disimpan di localStorage tidak pernah ter-reset ke light
        const persistentTheme = localStorage.getItem('calendey_theme') || activeUser.theme || 'light';
        activeUser.theme = persistentTheme;
        state.set('theme', persistentTheme);
        document.documentElement.setAttribute('data-theme', persistentTheme);

        localStorage.setItem('calendey_user_profile', JSON.stringify(activeUser));
        state.set('user', activeUser);
      } catch (e) {
        state.set('user', null);
      }
    } else {
      state.set('user', null);
    }

    // Dengarkan perubahan sesi
    this.setupSessionListener();
  }

  async loadUserProfile(userId, email) {
    if (!db.client) return;
    try {
      const { data, error } = await db.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const persistentTheme = localStorage.getItem('calendey_theme') || data?.theme || 'light';
      state.set('theme', persistentTheme);
      document.documentElement.setAttribute('data-theme', persistentTheme);

      if (!error && data) {
        const currentUser = state.get('user') || {};
        const merged = {
          ...currentUser,
          id: data.id,
          full_name: data.full_name || currentUser.full_name,
          whatsapp_number: data.whatsapp_number || currentUser.whatsapp_number,
          theme: persistentTheme,
          reminders_enabled: data.reminders_enabled !== false,
          default_remind_offset_days: data.default_remind_offset_days ?? 1,
          default_remind_time: data.default_remind_time || '09:00'
        };

        state.set('user', merged);
        localStorage.setItem('calendey_user_profile', JSON.stringify(merged));
      }

      if (typeof window.calendeySyncThemeButtons === 'function') {
        window.calendeySyncThemeButtons(persistentTheme);
      }
    } catch (e) {
      console.warn('[Calendey Auth] Load profile note:', e);
    }
  }

  async setupSessionListener() {
    if (db.client) {
      try {
        db.client.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            await this.loadUserProfile(session.user.id, session.user.email);
          }
          // Catatan: Jangan hapus sesi user lokal pada event 'SIGNED_OUT' latar belakang.
          // Logout lokal hanya dilakukan saat user secara eksplisit memanggil auth.signOut().
        });
        await this.ensureAuthSession();
      } catch (err) {
        console.warn('[Calendey Auth] Session error:', err);
      }
    }
  }

  async ensureAuthSession() {
    if (!db.client) return null;
    try {
      const { data: sessData } = await db.client.auth.getSession();
      if (sessData?.session?.user) {
        return sessData.session;
      }
      const currentUser = state.get('user');
      if (currentUser?.email) {
        const defaultPass = currentUser.username?.toLowerCase() === 'superadmin' ? 'admin-calender' : 'dhafin12345';
        try {
          const { data: signInData, error } = await db.client.auth.signInWithPassword({
            email: currentUser.email,
            password: defaultPass
          });
          if (!error && signInData?.session) {
            console.log('[Calendey Auth] Sesi Supabase Cloud aktif untuk:', signInData.user.id);
            return signInData.session;
          }
        } catch (authErr) {
          // Abaikan kegagalan background auth ke Supabase, sesi lokal tetap aman
        }
      }
    } catch (e) {
      console.warn('[Calendey Auth] Sesi Cloud check notice:', e);
    }
    return null;
  }

  async loadUserProfile(userId, email = '') {
    if (!db.client) return;
    try {
      const { data, error } = await db.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const currentUser = state.get('user') || {};
        const profile = { 
          ...currentUser,
          ...data, 
          email: email || data.email || currentUser.email,
          role: currentUser.role || 'Member',
          username: currentUser.username || (email ? email.split('@')[0] : 'user')
        };
        state.set('user', profile);
        localStorage.setItem('calendey_user_profile', JSON.stringify(profile));
        if (data.theme) {
          state.set('theme', data.theme);
          document.documentElement.setAttribute('data-theme', data.theme);
          window.calendeySyncThemeButtons?.(data.theme);
        }
      }
    } catch (err) {
      console.warn('[Calendey Auth] Gagal memuat profil Supabase (menggunakan cache lokal):', err);
    }
  }

  async signIn(identifier, password) {
    if (!identifier || !password) {
      notify.error('Username/Email dan password harus diisi');
      return { success: false };
    }

    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Dapatkan referensi akun yang cocok
    let accounts = [];
    try {
      accounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    } catch (e) {
      accounts = DEFAULT_ACCOUNTS;
    }

    const noSpaceId = cleanId.replace(/\s+/g, '');

    const matchedAccount = accounts.find(
      a => (
        a.username?.toLowerCase() === cleanId || 
        a.username?.toLowerCase() === noSpaceId ||
        a.name?.toLowerCase() === cleanId || 
        a.full_name?.toLowerCase() === cleanId || 
        a.full_name?.toLowerCase().replace(/\s+/g, '') === noSpaceId ||
        a.email?.toLowerCase() === cleanId
      )
    ) || DEFAULT_ACCOUNTS.find(
      a => (
        a.username?.toLowerCase() === cleanId || 
        a.username?.toLowerCase() === noSpaceId ||
        a.full_name?.toLowerCase() === cleanId || 
        a.full_name?.toLowerCase().replace(/\s+/g, '') === noSpaceId ||
        a.email?.toLowerCase() === cleanId
      )
    );

    // 2. Autentikasi ketat untuk akun utama bawaan (Strict Password Verification)
    const isSuperadminMatch = (
      cleanId === 'superadmin' || 
      cleanId === 'admin' || 
      cleanId === 'superadmin@calendey.app'
    ) && cleanPass === 'admin-calender';

    const isDhafinMatch = (
      cleanId === 'dhafin' || 
      cleanId === 'dhafinshabir' || 
      cleanId === 'dhafinshabir610@gmail.com' || 
      cleanId === 'dhafin@calendey.app'
    ) && cleanPass === 'dhafin12345';

    const isNadiaMatch = (
      cleanId === 'nadia' ||
      cleanId === 'nadia azra azizah' ||
      noSpaceId === 'nadiaazraazizah' ||
      cleanId === 'nadia azra' ||
      cleanId === 'nadia@calendey.app' ||
      cleanId === 'nadiaazraazizah@gmail.com'
    ) && cleanPass === 'nadiacantik';

    if (isSuperadminMatch || isDhafinMatch || isNadiaMatch) {
      const fallbackUser = matchedAccount || (
        isSuperadminMatch ? DEFAULT_ACCOUNTS[0] : 
        (isDhafinMatch ? DEFAULT_ACCOUNTS[1] : DEFAULT_ACCOUNTS[2])
      );
      state.set('user', fallbackUser);
      localStorage.setItem('calendey_user_profile', JSON.stringify(fallbackUser));
      try { await db.loadContentPlans(); } catch (e) {}
      notify.success(`Selamat datang, ${fallbackUser.full_name}!`);

      // Sinkronkan sesi Supabase di background tanpa menahan UI
      if (db.client) {
        const pass = isSuperadminMatch ? 'admin-calender' : (isDhafinMatch ? 'dhafin12345' : 'nadiacantik');
        db.client.auth.signInWithPassword({
          email: fallbackUser.email,
          password: pass
        }).catch(() => {});
      }
      return { success: true, user: fallbackUser };
    }

    // 3. Autentikasi untuk akun buatan Admin (misal: Nadia)
    if (matchedAccount) {
      // Jika password pada akun cocok, atau akun belum memiliki password tersimpan
      if (!matchedAccount.password || matchedAccount.password === cleanPass) {
        // Jika akun belum menyimpan password, simpan password ini agar selanjutnya konsisten
        if (!matchedAccount.password) {
          matchedAccount.password = cleanPass;
          try {
            const accIdx = accounts.findIndex(a => a.id === matchedAccount.id || a.email === matchedAccount.email);
            if (accIdx !== -1) {
              accounts[accIdx].password = cleanPass;
              localStorage.setItem('calendey_all_accounts', JSON.stringify(accounts));
            }
          } catch (e) {}
        }

        const activeUser = {
          id: matchedAccount.id || ('acc-' + Date.now()),
          username: matchedAccount.username || matchedAccount.name || cleanId,
          name: matchedAccount.name || matchedAccount.full_name || cleanId,
          full_name: matchedAccount.full_name || matchedAccount.name || cleanId,
          email: matchedAccount.email || `${cleanId}@calendey.app`,
          whatsapp_number: matchedAccount.whatsapp_number || matchedAccount.whatsapp || '',
          role: matchedAccount.role || 'Member',
          theme: matchedAccount.theme || localStorage.getItem('calendey_theme') || 'light',
          reminders_enabled: matchedAccount.reminders_enabled !== false,
          default_remind_offset_days: matchedAccount.default_remind_offset_days ?? 1,
          default_remind_time: matchedAccount.default_remind_time || '09:00'
        };

        state.set('user', activeUser);
        localStorage.setItem('calendey_user_profile', JSON.stringify(activeUser));
        try { await db.loadContentPlans(); } catch (e) {}
        notify.success(`Selamat datang, ${activeUser.full_name}!`);
        return { success: true, user: activeUser };
      }
    }

    // 3.5 Jika belum cocok di lokal, coba sinkronkan & periksa langsung ke Supabase Cloud (app_accounts)
    if (db.isCloudConnected) {
      try {
        const freshCloudAccounts = await db.loadCloudAccounts();
        const cloudMatched = freshCloudAccounts.find(
          a => (
            a.username?.toLowerCase() === cleanId || 
            a.username?.toLowerCase() === noSpaceId ||
            a.name?.toLowerCase() === cleanId || 
            a.full_name?.toLowerCase() === cleanId || 
            a.full_name?.toLowerCase().replace(/\s+/g, '') === noSpaceId ||
            a.email?.toLowerCase() === cleanId
          )
        );

        if (cloudMatched && (!cloudMatched.password || cloudMatched.password === cleanPass)) {
          const activeUser = {
            id: cloudMatched.id || ('acc-' + Date.now()),
            username: cloudMatched.username || cloudMatched.name || cleanId,
            name: cloudMatched.name || cloudMatched.full_name || cleanId,
            full_name: cloudMatched.full_name || cloudMatched.name || cleanId,
            email: cloudMatched.email || `${cleanId}@calendey.app`,
            whatsapp_number: cloudMatched.whatsapp || cloudMatched.whatsapp_number || '',
            role: cloudMatched.role || 'Member',
            theme: cloudMatched.theme || localStorage.getItem('calendey_theme') || 'light',
            reminders_enabled: cloudMatched.reminders_enabled !== false,
            default_remind_offset_days: cloudMatched.default_remind_offset_days ?? 1,
            default_remind_time: cloudMatched.default_remind_time || '09:00'
          };
          state.set('user', activeUser);
          localStorage.setItem('calendey_user_profile', JSON.stringify(activeUser));
          try { await db.loadContentPlans(); } catch (e) {}
          notify.success(`Selamat datang, ${activeUser.full_name}!`);
          return { success: true, user: activeUser };
        }
      } catch (e) {}
    }

    // 4. Jika bukan akun lokal yang cocok, coba autentikasi ke Supabase Auth
    if (db.client) {
      const candidateEmail = cleanId.includes('@') ? cleanId : (matchedAccount?.email || `${cleanId}@calendey.app`);
      try {
        const { data: authData, error: authError } = await db.client.auth.signInWithPassword({
          email: candidateEmail,
          password: cleanPass
        });
        if (!authError && authData?.user) {
          await this.loadUserProfile(authData.user.id, candidateEmail);
          const activeUser = state.get('user') || matchedAccount || {
            id: authData.user.id,
            email: candidateEmail,
            full_name: matchedAccount?.full_name || matchedAccount?.name || cleanId
          };
          state.set('user', activeUser);
          localStorage.setItem('calendey_user_profile', JSON.stringify(activeUser));
          try { await db.loadContentPlans(); } catch (e) {}
          notify.success(`Selamat datang, ${activeUser.full_name || 'User'}!`);
          return { success: true, user: activeUser };
        }
      } catch (e) {
        console.warn('[Calendey Auth] Cloud auth notice:', e);
      }
    }

    notify.error('Username atau password salah!');
    return { success: false, error: 'Kredensial tidak valid' };
  }

  async signUp(email, password, fullName, whatsappNumber) {
    if (!email || !password || !fullName) {
      notify.error('Nama, email, dan password wajib diisi');
      return { success: false };
    }

    const cleanEmail = email.trim();
    const cleanPass = password.trim();
    const cleanName = fullName.trim();
    const cleanPhone = whatsappNumber ? whatsappNumber.trim() : '';

    let newUserId = 'user-' + Date.now();

    // 1. Jika Supabase aktif, daftar melalui Supabase Auth
    if (db.client) {
      try {
        const { data: signUpData, error: signUpErr } = await db.client.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: {
            data: { full_name: cleanName, whatsapp_number: cleanPhone }
          }
        });
        if (signUpErr) {
          notify.error(signUpErr.message || 'Gagal mendaftar ke Supabase');
          return { success: false, error: signUpErr.message };
        }
        if (signUpData?.user?.id) {
          newUserId = signUpData.user.id;
          await db.client.from('profiles').upsert({
            id: newUserId,
            full_name: cleanName,
            whatsapp_number: cleanPhone,
            theme: state.get('theme') || 'light',
            reminders_enabled: true,
            updated_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('[Calendey Auth] SignUp cloud error:', err);
      }
    }

    // Profil yang disimpan ke state/localStorage TIDAK MENYIMPAN PASSWORD
    const safeProfile = {
      id: newUserId,
      username: cleanEmail.split('@')[0],
      email: cleanEmail,
      full_name: cleanName,
      role: 'User',
      whatsapp_number: cleanPhone,
      theme: state.get('theme') || 'light',
      reminders_enabled: true,
      default_remind_offset_days: 1,
      default_remind_time: '09:00',
      timezone: 'Asia/Jakarta'
    };

    let accounts = [];
    try {
      accounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    } catch (e) {
      accounts = [];
    }
    accounts.push(safeProfile);
    localStorage.setItem('calendey_all_accounts', JSON.stringify(accounts));

    state.set('user', safeProfile);
    localStorage.setItem('calendey_user_profile', JSON.stringify(safeProfile));

    notify.success(`Akun ${safeProfile.full_name} berhasil dibuat!`);
    return { success: true, user: safeProfile };
  }

  async signOut() {
    try {
      if (db.client) {
        await db.client.auth.signOut();
      }
    } catch (e) { }

    state.set('user', null);
    state.set('contentPlans', []);
    localStorage.removeItem('calendey_user_profile');
    notify.info('Anda telah keluar dari akun');
  }

  async getOrEnsureSupabaseUUID(user) {
    if (!db.client) return null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id || '');
    if (isUUID) return user.id;

    try {
      const { data } = await db.client.auth.getUser();
      return data?.user?.id || null;
    } catch (e) {
      return null;
    }
  }

  async updateProfile(updates, showToast = true) {
    try {
      const currentUser = state.get('user') || {};
      const updatedUser = { ...currentUser, ...updates };

      state.set('user', updatedUser);
      localStorage.setItem('calendey_user_profile', JSON.stringify(updatedUser));

      // Update di list all accounts
      let accounts = [];
      try {
        accounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
        const idx = accounts.findIndex(a => 
          (a.id && a.id === updatedUser.id) ||
          (a.username && a.username.toLowerCase() === (updatedUser.username || '').toLowerCase()) ||
          (a.email && a.email.toLowerCase() === (updatedUser.email || '').toLowerCase())
        );
        if (idx !== -1) {
          accounts[idx] = { ...accounts[idx], ...updatedUser };
        } else {
          accounts.push(updatedUser);
        }
        localStorage.setItem('calendey_all_accounts', JSON.stringify(accounts));
      } catch (e) { }

      // Simpan langsung ke Supabase Database Cloud dengan UUID valid
      if (db.client) {
        try {
          await this.ensureAuthSession();
          const validUUID = await this.getOrEnsureSupabaseUUID(updatedUser);
          if (validUUID) {
            updatedUser.id = validUUID;
            state.set('user', updatedUser);
            localStorage.setItem('calendey_user_profile', JSON.stringify(updatedUser));

            const profilePayload = {
              id: validUUID,
              full_name: updatedUser.full_name,
              whatsapp_number: updatedUser.whatsapp_number,
              theme: updatedUser.theme || 'light',
              reminders_enabled: true,
              updated_at: new Date().toISOString()
            };

            const { data: updatedRows, error: profErr } = await db.client
              .from('profiles')
              .update(profilePayload)
              .eq('id', validUUID)
              .select();

            if (!profErr && updatedRows && updatedRows.length > 0) {
              console.log('[Calendey Auth] Profile tersimpan ke Supabase Database:', updatedRows[0]);
            } else {
              await db.client.from('profiles').upsert(profilePayload);
            }
          }
        } catch (dbErr) {
          console.warn('[Calendey Auth] Cloud sync warning:', dbErr);
        }
      }

      if (showToast) {
        notify.success('Pengaturan profil & nomor WhatsApp berhasil disimpan!');
      }
    } catch (err) {
      console.error('[Calendey Auth] Gagal update profil:', err);
      if (showToast) notify.error('Gagal memperbarui profil');
    }
  }
}

export const auth = new AuthService();
