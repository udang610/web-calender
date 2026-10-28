# ✦ Calendey — Kalender Nasional & Content Planner

Platform web modern & PWA kalender hari nasional Indonesia yang terintegrasi dengan **Workspace Content Planner**, upload aset poster visual, checklist progres publikasi, serta sistem **WhatsApp Reminder Otomatis**.

---

## 📁 Struktur Direktori Proyek

Struktur folder mengadopsi pola modular bersih yang mudah dipelihara dan siap dideploy ke static hosting (Vercel, Netlify, Cloudflare Pages, cPanel):

```
web-calender/
├── CALENDEY_PRD_AND_MODEL.md   # Spesifikasi lengkap PRD, Arsitektur, & Skema Database
├── README.md                   # Panduan penggunaan & instalasi ini
├── index.html                  # Halaman utama aplikasi (Single Page App Shell & Modals)
├── manifest.webmanifest        # Web App Manifest untuk PWA & TWA Android APK
├── sw.js                       # Service Worker (offline shell & cache-first engine)
│
├── css/
│   ├── themes.css              # Token 3 Tema: Light, Dark, dan Soft Pink via [data-theme]
│   ├── style.css               # Layout shell, sidebar, topbar, modal dialog, & toast alert
│   ├── calendar.css            # Matriks kalender bulanan, color dots kategori, & panel hari penting
│   └── planner.css             # Kanban cards rencana konten, status pills, fast checklist, & dropzone
│
├── js/
│   ├── config.js               # Konfigurasi Supabase, limit 5MB upload, kategori & status
│   ├── state.js                # Reactive Runtime State (active date, filters, user session)
│   ├── notifications.js        # Toast alert system
│   ├── db.js                   # Layanan Supabase & local storage cache synchronizer
│   ├── auth.js                 # Autentikasi Supabase & manajemen profil WhatsApp
│   ├── calendar.js             # Engine kalender bulanan, matriks hari, countdown H-x
│   ├── planner.js              # Engine Konten Saya: filter status, platform, search, ceklis
│   ├── upload.js               # Drag-and-drop file upload, validasi format, storage Supabase
│   ├── modals.js               # Controller modal form konten, preview aset, pengaturan profil
│   ├── views.js                # Switcher view (Kalender, Konten Saya, Kategori, Pengaturan)
│   └── app.js                  # Entry point bootstrap, lifecycle router, register Service Worker
│
├── data/
│   └── national_days.json      # Master data lengkap hari nasional & libur resmi Indonesia
│
└── supabase/
    ├── schema.sql              # Skrip DDL PostgreSQL (tabel, foreign keys, index, constraints)
    ├── rls_policies.sql        # Row Level Security (RLS) policies per tabel & storage bucket
    ├── seed.sql                # Data awal master kategori & hari besar Indonesia
    └── functions/
        └── send-reminders/     # Supabase Edge Function untuk cron pengingat WhatsApp
            └── index.ts
```

---

## ✨ Fitur-Fitur Utama

1. **Kalender Hari Nasional Indonesia Interaktif:**
   - Navigasi bulan/tahun, shortcut tombol *Hari Ini*.
   - Titik warna per kategori: 🔴 *Hari Nasional*, 🟠 *Hari Bersejarah*, 🟢 *Hari Keagamaan*, 🔵 *Hari Perjuangan*, 🟣 *Hari Peringatan Khusus*.
   - Badge penanda libur nasional dan penanda tanggal yang sudah memiliki rencana konten.
   - Widget sidebar: *Hari Nasional Mendatang* lengkap dengan hitung mundur hari (*H-x*).
2. **Content Planner Sosial Media:**
   - Formulir rencana konten: Judul, tanggal, jam posting, platform (Instagram, TikTok, WA Status, FB, X, dll.), caption, hashtag, dan catatan tim.
   - Upload aset visual (hingga 10 file per rencana, maks 5 MB per file, JPG/PNG/WebP) dengan lightbox preview.
   - Alur status 4 tahap: `Ide Baru` $\rightarrow$ `Desain Dibuat` $\rightarrow$ `Siap Posting` $\rightarrow$ `Sudah Diposting`.
   - **Fast Checklist:** Ceklis satu klik *"Desain Selesai"* dan *"Sudah Diposting"* yang otomatis menyinkronkan status konten.
3. **Sistem Pengingat WhatsApp Terjadwal:**
   - Pilihan reminder fleksibel (H-3, H-1, Hari-H jam tertentu, atau custom).
   - Cron otomatis via Supabase `pg_cron` memanggil Edge Function setiap 5 menit untuk mengirim pesan pengingat ke nomor WhatsApp pengguna via gateway Fonnte / WhatsApp Cloud API.
   - Proteksi pengingat: otomatis dibatalkan jika konten sudah berstatus *Sudah Diposting*.
4. **Multi-Tema Elegan (3 Pilihan Tema):**
   - ☀️ **Light Theme:** Latar putih bersih dengan aksen rose merah bendera.
   - 🌙 **Dark Theme:** Nuansa abu gelap modern beraksen crimson glow.
   - 🌸 **Soft Pink Theme:** Nuansa pastel feminin lembut yang estetik.
5. **PWA & Android APK Ready:**
   - Dapat diinstall langsung ke ponsel (*Add to Home Screen*) dan mendukung ekspor ke file APK via PWABuilder / Capacitor.

---

## 🚀 Cara Menjalankan Secara Lokal

1. Buka folder ini di terminal atau file explorer:
   ```bash
   cd c:\Users\dell\code\web-calender
   ```
2. Jalankan local web server (contoh menggunakan `npx serve` atau Python HTTP server):
   ```bash
   # Opsi 1: Menggunakan serve (Node.js)
   npx serve .

   # Opsi 2: Menggunakan Python
   python -m http.server 3000
   ```
3. Buka browser di `http://localhost:3000` (atau klik ganda langsung `index.html`).

---

## ☁️ Menghubungkan ke Supabase (Opsional)

Aplikasi dapat langsung berjalan secara instan (*offline/demo mode* menggunakan data lokal). Untuk menghubungkan ke database cloud Supabase:
1. Buat project baru di [Supabase Dashboard](https://supabase.com).
2. Jalankan skrip SQL di Supabase SQL Editor secara berurutan:
   - `supabase/schema.sql`
   - `supabase/rls_policies.sql`
   - `supabase/seed.sql`
3. Masukkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` Anda ke dalam `js/config.js`.
4. Deploy Edge Function `supabase/functions/send-reminders` dan aktifkan cron per 5 menit.
