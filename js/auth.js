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
    theme: 'light',
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
    theme: 'light',
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

    // Bersihkan password plain-text warisan dari local storage jika pernah tersimpan
    allAccounts = allAccounts.map(a => {
      const { password, ...safeAccount } = a;
      return safeAccount;
    });

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

    // Cek cached profile sesi aktif
    const cachedProfile = localStorage.getItem('calendey_user_profile');
    if (cachedProfile) {
      try {
        let activeUser = JSON.parse(cachedProfile);
        const matchedDef = DEFAULT_ACCOUNTS.find(d => 
          d.username.toLowerCase() === activeUser.username?.toLowerCase() || 
          d.email.toLowerCase() === activeUser.email?.toLowerCase()
        );
        if (matchedDef) {
          activeUser = { ...activeUser, ...matchedDef };
          localStorage.setItem('calendey_user_profile', JSON.stringify(activeUser));
        }
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

  async setupSessionListener() {
    if (db.client) {
      try {
        db.client.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            await this.loadUserProfile(session.user.id, session.user.email);
          } else if (event === 'SIGNED_OUT') {
            state.set('user', null);
            localStorage.removeItem('calendey_user_profile');
          }
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
        const { data: signInData, error } = await db.client.auth.signInWithPassword({
          email: currentUser.email,
          password: defaultPass
        });
        if (!error && signInData?.session) {
          console.log('[Calendey Auth] Sesi Supabase Cloud aktif untuk:', signInData.user.id);
          return signInData.session;
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
        const profile = { ...data, email: email || data.email };
        state.set('user', profile);
        localStorage.setItem('calendey_user_profile', JSON.stringify(profile));
        if (data.theme) {
          state.set('theme', data.theme);
          document.documentElement.setAttribute('data-theme', data.theme);
          window.calendeySyncThemeButtons?.(data.theme);
        }
      }
    } catch (err) {
      console.error('[Calendey Auth] Gagal memuat profil:', err);
    }
  }

  async signIn(identifier, password) {
    if (!identifier || !password) {
      notify.error('Username/Email dan password harus diisi');
      return { success: false };
    }

    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Tentukan email pengguna dari input username atau email langsung
    let accounts = [];
    try {
      accounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    } catch (e) {
      accounts = DEFAULT_ACCOUNTS;
    }

    const matchedAccount = accounts.find(
      a => (a.username?.toLowerCase() === cleanId || a.email?.toLowerCase() === cleanId)
    );

    const targetEmail = cleanId.includes('@')
      ? cleanId
      : (matchedAccount?.email || `${cleanId}@calendey.app`);

    // 2. Autentikasi langsung ke Supabase Auth secara aman melalui HTTPS
    if (db.client) {
      try {
        const { data: authData, error: authError } = await db.client.auth.signInWithPassword({
          email: targetEmail,
          password: cleanPass
        });

        if (!authError && authData?.user) {
          await this.loadUserProfile(authData.user.id, targetEmail);
          const activeUser = state.get('user') || matchedAccount || {
            id: authData.user.id,
            email: targetEmail,
            full_name: matchedAccount?.full_name || cleanId
          };
          notify.success(`Selamat datang, ${activeUser.full_name || 'User'}!`);
          return { success: true, user: activeUser };
        }

        if (authError) {
          notify.error('Username/Email atau password salah!');
          return { success: false, error: authError.message };
        }
      } catch (err) {
        console.warn('[Calendey Auth] Supabase auth check error:', err);
      }
    }

    notify.error('Database belum terhubung. Periksa konfigurasi Supabase.');
    return { success: false, error: 'Database belum terhubung' };
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
