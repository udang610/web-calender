# Calendey — PRD & Model Database Reference

Dokumen ini adalah spesifikasi teknis resmi, *Product Requirements Document* (PRD), dan dokumentasi arsitektur database untuk aplikasi **Calendey** (*Kalender Hari Nasional Indonesia + Content Planner & WhatsApp Reminder*).

---

## 1. Ringkasan Eksekutif & Identitas Produk

* **Nama Brand:** Calendey
* **Tagline:** *Satu kalender, sejuta makna, satu rencana konten.*
* **Deskripsi:** Platform web & mobile (PWA) kalender hari nasional Indonesia yang mengintegrasikan alur kerja perencanaan konten sosial media (*content planner*), penyimpanan aset visual, checklist publikasi, serta sistem pengingat otomatis via WhatsApp langsung ke ponsel pengelola/kreator konten.
* **Target Pengguna:**
  * Admin / Pengelola media sosial UMKM, organisasi kampus, instansi, dan komunitas.
  * *Content Creator* perorangan yang membutuhkan konsistensi jadwal posting hari penting.
  * Tim agensi/kreatif skala kecil.

---

## 2. Kebutuhan Produk (PRD) & Fitur Inti

### 2.1 Autentikasi & Akun
* **FR-01 Registrasi:** Pendaftaran akun berbasis Email dan Password (minimal 8 karakter) via Supabase Auth.
* **FR-02 Login & Reset Password:** Login email/password, proteksi sesi otomatis, dan pemulihan password via email magic link / token.
* **FR-03 Profil Pengguna:**
  * Nama lengkap.
  * Nomor WhatsApp dengan validasi format standar internasional (`628xxxxxxxxxx`).
  * Pilihan tema default (*Light*, *Dark*, *Soft Pink*) yang dikonfigurasikan langsung di dalam dropdown dan modal profil pengguna.
  * Pengaturan nomor WhatsApp dan jadwal default pengingat terintegrasi penuh di dalam Profil Pengguna.
  * Zona waktu pengguna (default `Asia/Jakarta`).
  * **Alur Akses Wajib Login:** Pengguna wajib login terlebih dahulu melalui *Fullscreen Auth Screen* sebelum dapat mengakses kalender dan dashboard.
  * **Penempatan Komponen UI:** Widget Profil ditempatkan di navbar pojok kanan atas (`.topbar-right`) dengan gaya polos tanpa border pill, menyatu secara seamless dengan topbar.
  * **Panel Admin Simple:** Fitur bagi admin untuk membuat dan mengelola akun pengguna (nama, email, password, nomor WhatsApp, dan role).

### 2.2 Kalender Interaktif & Master Hari Nasional
* **FR-04 Kalender Bulanan:** Matriks kalender dinamis dengan navigasi bulan/tahun, tombol jalan pintas "Hari Ini", dan tampilan mobile-first (responsif mulai layar 360px).
* **FR-05 Indikator Visual Kategori:** Titik warna (*color-coded badge*) pada setiap tanggal yang memiliki hari nasional:
  * 🔴 **Hari Nasional** (`#ef4444`)
  * 🟠 **Hari Bersejarah** (`#f97316`)
  * 🟢 **Hari Keagamaan** (`#10b981`)
  * 🔵 **Hari Perjuangan** (`#3b82f6`)
  * 🟣 **Hari Peringatan Khusus** (`#8b5cf6`)
* **FR-06 Indikator Rencana Konten:** Ikon status penanda pada tanggal yang telah dibuatkan rencana konten (lingkaran ide, kuas desain, atau centang hijau jika siap/sudah diposting).
* **FR-07 Panel Detail Tanggal:** Saat tanggal diklik, menampilkan:
  * Nama hari penting & badge kategori.
  * Tagline inspirasi & deskripsi makna peringatan.
  * Keterangan libur nasional (*Public Holiday*).
  * Tombol aksi cepat **"Rencanakan Konten"**.
  * Daftar rencana konten yang terikat pada tanggal tersebut.
* **FR-08 Widget Hari Mendatang:** Menampilkan 4–5 hari penting berikutnya secara kronologis beserta hitung mundur hari (*countdown* H-x).
* **FR-09 Filter & Pencarian:** Pencarian hari nasional berdasarkan kata kunci dan filter multi-kategori.

### 2.3 Content Planner (Perencanaan Konten)
* **FR-10 Form Pembuatan/Edit Konten:**
  * Judul konten (maksimal 150 karakter).
  * Terikat ke hari nasional atau *custom event*.
  * Multi-platform selector: Instagram, TikTok, WhatsApp Status, Facebook, X (Twitter), LinkedIn, Threads.
  * Draft teks caption & hashtag.
  * Catatan internal / referensi brief.
  * Tanggal rencana (`planned_date`) dan target jam publikasi (`scheduled_at`).
* **FR-11 Upload & Galeri Aset Desain:**
  * Upload 1–10 file per rencana konten (ekstensi: JPG, JPEG, PNG, WebP; ukuran max 5 MB per file).
  * Penyimpanan aman di Supabase Storage bucket privat dengan signed URL.
  * Tampilan thumbnail dengan pratinjau resolusi penuh (*modal preview*) dan opsi unduh aset.
* **FR-12 Alur Status Kerja Konten:**
  1. `idea` (Ide Konten Baru)
  2. `design_done` (Desain Selesai Dibuat)
  3. `ready` (Konten Siap Diposting)
  4. `posted` (Sudah Berhasil Diposting)
* **FR-13 Ceklis Cepat Sinkron:**
  * Tombol ceklis satu klik: **"Desain Selesai"** (mengubah status ke `design_done` / `ready`).
  * Tombol ceklis satu klik: **"Sudah Diposting"** (mengubah status ke `posted`, mencatat `posted_at`, dan otomatis membatalkan reminder tertunda).
* **FR-14 View "Konten Saya":** Tampilan grid/list seluruh rencana konten milik user dengan tab filter status, filter bulan, dan pencarian.

### 2.4 Sistem Pengingat WhatsApp (Automated WhatsApp Reminder)
* **FR-15 Opsi Pengingat:**
  * H-3 pukul 09:00 WIB
  * H-1 pukul 09:00 WIB
  * Hari-H pukul 08:00 WIB
  * Waktu kustom (tanggal & jam spesifik).
* **FR-16 Arsitektur Engine Pengingat:**
  * Supabase `pg_cron` dijadwalkan berjalan setiap 5 menit.
  * Menjalankan Supabase Edge Function `send-reminders`.
  * Mengambil baris tabel `reminders` dengan kriteria:
    * `status = 'pending'`
    * `remind_at <= NOW()`
    * Konten induk belum berstatus `posted`.
    * Pengguna mengaktifkan `reminders_enabled = true`.
* **FR-17 Integrasi Gateway WhatsApp:**
  * Menggunakan endpoint API Gateway (Fonnte untuk fase MVP / WhatsApp Cloud API resmi untuk scale).
  * Format template pesan ramah & personal:
    > *"Halo [Nama Pengguna], besok adalah [Nama Hari Penting]! 🇮🇩\nKonten '[Judul Konten]' Anda saat ini berstatus [Status Desain], dengan jadwal posting jam [Jam Posting]. Jangan lupa diposting ya! ✨"*
* **FR-18 Log & Proteksi Pengiriman:**
  * Pencatatan riwayat di tabel `reminder_logs` (provider, status code, response).
  * Percobaan ulang (*retry*) maksimal 3 kali jika terjadi timeout/kegagalan gateway.

### 2.5 Multi-Tema & Desain Visual
* **3 Tema Bawaan:**
  * ☀️ **Light Theme:** Latar putih keabuan bersih (`#f8fafc`), aksen merah cerah inspirasi bendera nasional (`#e11d48`).
  * 🌙 **Dark Theme:** Latar abu-hitam elegan (`#0f172a`), kartu permukaan (`#1e293b`), aksen crimson glow (`#f43f5e`).
  * 🌸 **Soft Pink Theme:** Latar pink lembut feminin (`#fff1f2`), kartu permukaan (`#ffe4e6`), aksen rose berry (`#e11d48`).
* Menggunakan token murni via CSS variables pada elemen `<html data-theme="...">`.

---

## 3. Arsitektur Data & Model Database (PostgreSQL / Supabase)

### 3.1 Relasi Database (Entity Relationship)

```
auth.users (Supabase Auth Core)
    ├── 1:1 ── profiles
    ├── 1:N ── custom_events
    ├── 1:N ── content_plans
    │              ├── 1:N ── content_assets (Cascade Delete)
    │              └── 1:N ── reminders (Cascade Delete)
    │                             └── 1:N ── reminder_logs (Cascade Delete)
    └── 1:N ── categories
                   └── 1:N ── national_days
                                  └── 1:N ── content_plans (Optional FK)
```

### 3.2 Spesifikasi Kolom Tabel

#### Tabel: `profiles`
Menyimpan identitas tambahan pengguna yang terhubung langsung ke `auth.users`.
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | Foreign Key ke `auth.users(id)` ON DELETE CASCADE |
| `full_name` | `text` | Nama lengkap pengguna |
| `whatsapp_number` | `text` | Nomor WA format `628xxxxxxxxxx` |
| `theme` | `text` | `'light'`, `'dark'`, atau `'pink'` (default `'light'`) |
| `reminders_enabled` | `boolean` | Status global notifikasi WA (default `true`) |
| `default_remind_offset_days`| `int` | Default H-x pengingat (default `1`) |
| `default_remind_time` | `time` | Default jam pengingat (default `'09:00'`) |
| `timezone` | `text` | Default `'Asia/Jakarta'` |
| `created_at` | `timestamptz` | Waktu dibuat (default `now()`) |
| `updated_at` | `timestamptz` | Waktu diperbarui (default `now()`) |

#### Tabel: `categories`
Kategori klasifikasi hari penting Indonesia.
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `smallint` (PK) | ID kategori (1–5) |
| `name` | `text` (UNIQUE) | Cth: Hari Nasional, Hari Bersejarah |
| `slug` | `text` (UNIQUE) | Cth: `hari-nasional`, `hari-bersejarah` |
| `color_hex` | `text` | Kode warna hex untuk titik kalender (cth: `#ef4444`) |
| `icon` | `text` | Nama icon (Phosphor/Lucide) |

#### Tabel: `national_days`
Katalog master hari nasional, hari bersejarah, dan libur resmi Indonesia.
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `serial` (PK) | Auto increment ID |
| `category_id` | `smallint` (FK) | Relasi ke `categories(id)` |
| `name` | `text` | Nama peringatan (cth: Hari Sumpah Pemuda) |
| `day` | `smallint` | Tanggal (1–31) |
| `month` | `smallint` | Bulan (1–12) |
| `year` | `smallint` (NULL) | Diisi tahun tertentu untuk hari keagamaan; NULL jika berulang tahunan |
| `description` | `text` | Deskripsi sejarah & makna peringatan |
| `tagline` | `text` | Kutipan inspirasi singkat |
| `is_public_holiday` | `boolean` | Penanda tanggal merah/libur resmi pemerintah |
| `created_at` | `timestamptz` | Waktu dibuat |

#### Tabel: `custom_events`
Acara atau hari penting khusus yang ditambahkan oleh masing-masing pengguna.
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` |
| `user_id` | `uuid` (FK) | Relasi ke `auth.users(id)` ON DELETE CASCADE |
| `title` | `text` | Judul event khusus (cth: Ulang Tahun Brand) |
| `event_date` | `date` | Tanggal event berlangsung |
| `description` | `text` | Keterangan event |
| `color_hex` | `text` | Warna penanda custom |
| `created_at` | `timestamptz` | Waktu dibuat |

#### Tabel: `content_plans`
Rencana konten sosial media per pengguna.
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` |
| `user_id` | `uuid` (FK) | Pemilik konten (`auth.users(id)`) |
| `national_day_id` | `int` (FK, NULL) | Relasi opsional ke `national_days(id)` |
| `custom_event_id` | `uuid` (FK, NULL)| Relasi opsional ke `custom_events(id)` |
| `title` | `text` | Judul konten rencana (max 150 char) |
| `caption` | `text` | Teks caption dan rekomendasi hashtag |
| `notes` | `text` | Catatan internal / brief desain |
| `platforms` | `text[]` | Array platform tujuan (cth: `['instagram', 'tiktok']`) |
| `planned_date` | `date` | Tanggal hari penting yang dirujuk |
| `scheduled_at` | `timestamptz` | Target tanggal & jam posting |
| `status` | `text` | `'idea'`, `'design_done'`, `'ready'`, `'posted'` |
| `design_done` | `boolean` | Flag cepat ceklis desain selesai |
| `is_posted` | `boolean` | Flag cepat ceklis sudah diposting |
| `posted_at` | `timestamptz` | Timestamp saat status ditandai sudah diposting |
| `created_at` | `timestamptz` | Waktu pembuatan |
| `updated_at` | `timestamptz` | Waktu pembaharuan terakhir |

#### Tabel: `content_assets`
File gambar/desain poster yang diunggah untuk konten tertentu.
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` |
| `content_plan_id` | `uuid` (FK) | Relasi ke `content_plans(id)` ON DELETE CASCADE |
| `user_id` | `uuid` (FK) | Relasi ke `auth.users(id)` untuk RLS |
| `storage_path` | `text` | Path file dalam Supabase Storage bucket |
| `file_name` | `text` | Nama asli file |
| `mime_type` | `text` | Format MIME (`image/jpeg`, `image/png`, `image/webp`) |
| `file_size` | `int` | Ukuran file dalam bytes (max 5 MB) |
| `sort_order` | `smallint` | Urutan tampilan slide aset (default `0`) |
| `created_at` | `timestamptz` | Waktu upload |

#### Tabel: `reminders`
Jadwal pengingat posting yang akan dikirim via WhatsApp.
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` |
| `content_plan_id` | `uuid` (FK) | Relasi ke `content_plans(id)` ON DELETE CASCADE |
| `user_id` | `uuid` (FK) | Pemilik pengingat (`auth.users(id)`) |
| `remind_at` | `timestamptz` | Jadwal waktu pengiriman |
| `channel` | `text` | Saluran pengingat (default `'whatsapp'`) |
| `status` | `text` | `'pending'`, `'sent'`, `'failed'`, `'cancelled'` |
| `attempts` | `smallint` | Jumlah percobaan pengiriman (default `0`) |
| `sent_at` | `timestamptz` | Timestamp saat pesan berhasil diterima gateway |
| `created_at` | `timestamptz` | Waktu pembuatan reminder |

#### Tabel: `reminder_logs`
Riwayat logging dan respons API gateway WhatsApp untuk audit & debugging.
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `bigserial` (PK)| Auto increment log ID |
| `reminder_id` | `uuid` (FK) | Relasi ke `reminders(id)` ON DELETE CASCADE |
| `provider` | `text` | Penyedia gateway (cth: `'fonnte'`, `'whatsapp_cloud'`) |
| `request_summary` | `text` | Ringkasan isi pesan tanpa data kredensial |
| `response_code` | `int` | HTTP response code dari API gateway |
| `response_body` | `text` | Raw payload response dari gateway |
| `created_at` | `timestamptz` | Waktu pengiriman |

---

## 4. Struktur Direktori Proyek (Standar `website-music`)

Mengikuti filosofi modularitas tinggi pada folder `website-music`, struktur kode diorganisir bersih dengan pemisahan tanggung jawab yang jelas:

```
web-calender/
├── CALENDEY_PRD_AND_MODEL.md   # Spesifikasi PRD, arsitektur, & model database ini
├── README.md                   # Panduan instalasi cepat, local dev, & deploy PWA/APK
├── index.html                  # Single Page Application Layout (Shell, Sidebar, Modals)
├── manifest.webmanifest        # Konfigurasi PWA Standalone & TWA Android APK
├── sw.js                       # Service Worker (offline cache & asset caching)
│
├── css/
│   ├── style.css               # Base layout, typography, navigation, reset, and scrollbars
│   ├── themes.css              # Design tokens: Light, Dark, dan Soft Pink via CSS variables
│   ├── calendar.css            # Grid kalender, date cells, event indicators, countdown
│   └── planner.css             # Kanban/cards rencana konten, status badges, checklist, dropzone
│
├── js/
│   ├── app.js                  # Entry point bootstrap, lifecycle router, register Service Worker
│   ├── config.js               # Supabase URL, anon key, default timezone & constants
│   ├── auth.js                 # Autentikasi: login, signup, reset password, user state listener
│   ├── db.js                   # Supabase query client & data synchronizer
│   ├── state.js                # Global reactive state manager (active date, filters, user prefs)
│   ├── calendar.js             # Engine kalkulasi tanggal, generasi matriks hari, render dots
│   ├── views.js                # View switcher: Kalender, Konten Saya, Kategori, Profil Pengaturan
│   ├── planner.js              # Logika CRUD rencana konten, perubahan status, auto checklist
│   ├── upload.js               # Drag-and-drop file upload, kompresi klien, storage Supabase
│   ├── modals.js               # Modal controller: Form Konten, Detail Event, Image Lightbox
│   └── notifications.js        # Toast alerts, validasi pesan, & indikator status pengiriman WA
│
├── data/
│   └── national_days.json      # Master data hari libur & hari nasional Indonesia (offline ready)
│
├── images/
│   ├── icons/                  # PWA Icons (icon-192.png, icon-512.png, favicon.svg)
│   └── categories/             # Icon SVG penanda kategori nasional
│
├── supabase/
│   ├── schema.sql              # Skema lengkap DDL (tabel, foreign key, index, check constraints)
│   ├── rls_policies.sql        # Row Level Security (RLS) policies per tabel
│   ├── seed.sql                # Data awal kategori & hari penting Indonesia tahun berjalan
│   └── functions/
│       └── send-reminders/     # Supabase Edge Function untuk cron pengingat WhatsApp
│           └── index.ts
│
└── scripts/
    └── seed_national_days.js   # Script utilitas sinkronisasi data dari JSON ke Supabase
```

---

## 5. Keamanan & Konfigurasi Row Level Security (RLS)

1. **Prinsip Least Privilege:** Seluruh tabel data yang berhubungan dengan user (`profiles`, `custom_events`, `content_plans`, `content_assets`, `reminders`) wajib mengaktifkan RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
2. **Kondisi Akses Pengguna:**
   * `SELECT`, `INSERT`, `UPDATE`, `DELETE` hanya diizinkan bila `auth.uid() = user_id` (atau `id` pada tabel `profiles`).
3. **Data Master Terbuka:**
   * Tabel `categories` dan `national_days` dapat dibaca secara publik oleh semua pengguna terautentikasi (`FOR SELECT TO authenticated USING (true)`), namun hanya dapat ditulis oleh peran admin (`service_role`).
4. **Proteksi Token WhatsApp Gateway:**
   * Token autentikasi Fonnte / WhatsApp Cloud API **hanya** disimpan pada variabel rahasia (*Environment Secrets*) di Supabase Edge Function, dan tidak pernah dimuat di sisi frontend JavaScript.
