// ========================================================================
// CALENDEY — Auth & User Profile Management (Superadmin & Dhafin Accounts)
// ========================================================================

import { state } from './state.js';
import { db } from './db.js';
import { notify } from './notifications.js';

// Akun Utama Bawaan Sesuai Permintaan
export const DEFAULT_ACCOUNTS = [
  {
    id: '3c72477c-5c56-44a8-91aa-8cfd1367db06',
    username: 'Superadmin',
    email: 'superadmin@calendey.app',
    password: 'admin-calender',
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
    password: 'dhafin12345',
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

    // Jika Supabase cloud aktif, dengarkan perubahan sesi
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
      } catch (err) {
        console.warn('[Calendey Auth] Session error:', err);
      }
    }
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

    // 1. Cek dari daftar akun terdaftar (Superadmin, dhafin, atau akun yang dibuat admin)
    let accounts = [];
    try {
      accounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    } catch (e) {
      accounts = DEFAULT_ACCOUNTS;
    }

    const matchedAccount = accounts.find(
      a => (a.username?.toLowerCase() === cleanId || a.email?.toLowerCase() === cleanId) && a.password === cleanPass
    );

    if (matchedAccount) {
      // 1. Simpan sesi lokal terlebih dahulu
      state.set('user', matchedAccount);
      localStorage.setItem('calendey_user_profile', JSON.stringify(matchedAccount));

      // 2. Jika Supabase Cloud aktif, otomatis sinkronkan ke auth.users dan tabel public.profiles
      if (db.client && matchedAccount.email) {
        try {
          let supaUserId = null;
          const { data: signInData } = await db.client.auth.signInWithPassword({
            email: matchedAccount.email,
            password: matchedAccount.password
          });

          if (signInData?.user) {
            supaUserId = signInData.user.id;
          } else {
            const { data: signUpData } = await db.client.auth.signUp({
              email: matchedAccount.email,
              password: matchedAccount.password,
              options: {
                data: {
                  full_name: matchedAccount.full_name,
                  whatsapp_number: matchedAccount.whatsapp_number
                }
              }
            });
            if (signUpData?.user) {
              supaUserId = signUpData.user.id;
            }
          }

          if (supaUserId) {
            matchedAccount.id = supaUserId;
            state.set('user', matchedAccount);
            localStorage.setItem('calendey_user_profile', JSON.stringify(matchedAccount));

            const { error: profErr } = await db.client.from('profiles').upsert({
              id: supaUserId,
              full_name: matchedAccount.full_name,
              whatsapp_number: matchedAccount.whatsapp_number,
              theme: matchedAccount.theme || 'light',
              reminders_enabled: true,
              updated_at: new Date().toISOString()
            });

            if (!profErr) {
              console.log('[Calendey Auth] Data profil berhasil masuk ke public.profiles Supabase:', supaUserId);
            } else {
              console.warn('[Calendey Auth] Upsert public.profiles notice:', profErr);
            }
          }
        } catch (syncErr) {
          console.warn('[Calendey Auth] Sinkronisasi cloud Supabase:', syncErr);
        }
      }

      notify.success(`Selamat datang, ${matchedAccount.full_name}!`);
      return { success: true, user: matchedAccount };
    }

    // 2. Jika ada Supabase Auth terhubung, coba verifikasi ke cloud
    if (db.client && cleanId.includes('@')) {
      try {
        const { data, error } = await db.client.auth.signInWithPassword({
          email: cleanId,
          password: cleanPass
        });
        if (!error && data?.user) {
          await this.loadUserProfile(data.user.id, data.user.email);
          notify.success(`Selamat datang, ${state.get('user')?.full_name || 'User'}!`);
          return { success: true, user: state.get('user') };
        }
      } catch (err) {
        console.warn('[Calendey Auth] Cloud auth check:', err);
      }
    }

    notify.error('Username/Email atau password salah!');
    return { success: false, error: 'Kredensial tidak valid' };
  }

  async signUp(email, password, fullName, whatsappNumber) {
    if (!email || !password || !fullName) {
      notify.error('Nama, email, dan password wajib diisi');
      return { success: false };
    }

    const profile = {
      id: 'user-' + Date.now(),
      username: email.split('@')[0],
      email: email.trim(),
      password: password.trim(),
      full_name: fullName.trim(),
      role: 'User',
      whatsapp_number: whatsappNumber ? whatsappNumber.trim() : '',
      theme: state.get('theme') || 'light',
      reminders_enabled: true,
      default_remind_offset_days: 1,
      default_remind_time: '09:00',
      timezone: 'Asia/Jakarta'
    };

    // Tambah ke daftar akun
    let accounts = [];
    try {
      accounts = JSON.parse(localStorage.getItem('calendey_all_accounts') || '[]');
    } catch (e) {
      accounts = [];
    }
    accounts.push(profile);
    localStorage.setItem('calendey_all_accounts', JSON.stringify(accounts));

    state.set('user', profile);
    localStorage.setItem('calendey_user_profile', JSON.stringify(profile));

    if (db.client) {
      try {
        await db.client.auth.signUp({
          email: profile.email,
          password: profile.password,
          options: { data: { full_name: profile.full_name, whatsapp_number: profile.whatsapp_number } }
        });
      } catch (e) { }
    }

    notify.success(`Akun ${profile.full_name} berhasil dibuat!`);
    return { success: true, user: profile };
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
    if (!db.client || !user?.email) return null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id || '');
    if (isUUID) return user.id;

    try {
      const { data: signInData } = await db.client.auth.signInWithPassword({
        email: user.email,
        password: user.password || 'admin-calender'
      });
      if (signInData?.user?.id) return signInData.user.id;

      const { data: signUpData } = await db.client.auth.signUp({
        email: user.email,
        password: user.password || 'admin-calender',
        options: { data: { full_name: user.full_name, whatsapp_number: user.whatsapp_number } }
      });
      return signUpData?.user?.id || null;
    } catch (e) {
      return null;
    }
  }

  async updateProfile(updates) {
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

            const { error: profErr } = await db.client.from('profiles').upsert(profilePayload);
            if (!profErr) {
              console.log('[Calendey Auth] Profile & WhatsApp tersimpan ke Supabase Database dengan UUID:', validUUID);
            } else {
              console.warn('[Calendey Auth] Supabase profiles upsert info:', profErr);
            }
          }
        } catch (dbErr) {
          console.warn('[Calendey Auth] Cloud sync warning:', dbErr);
        }
      }

      notify.success('Pengaturan profil & nomor WhatsApp berhasil disimpan!');
    } catch (err) {
      console.error('[Calendey Auth] Gagal update profil:', err);
      notify.error('Gagal memperbarui profil');
    }
  }
}

export const auth = new AuthService();
