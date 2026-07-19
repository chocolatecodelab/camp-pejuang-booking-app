# Camp Pejuang Booking App

A premium, high-fidelity room reservation system tailored for **Kampung Inggris Pare** (Kediri, Jawa Timur). Built on Next.js, Tailwind v4, Zod, and Supabase.

---

## 🚀 Fitur Utama

### 1. Sistem Portal Publik (Customer)
*   **Filter Gender Camp**: Memilih hunian sesuai kenyamanan (Khusus Putra, Khusus Putri, Campuran).
*   **Real-time Availability Checker**: Memasukkan tanggal Check-In & durasi sewa untuk melihat ketersediaan kamar secara instan tanpa tumpang tindih.
*   **Soft-Locking Room (Hold)**: Sistem mengunci kamar yang dipilih selama **24 jam** menggunakan transaksi database atomik (PostgreSQL Function RPC) untuk memberi waktu pengguna melakukan pembayaran.
*   **Flexible Payment Channel**: Opsi pembayaran uang muka (DP) atau lunas (Full) via QRIS statis atau Transfer Bank.
*   **Validation & Live Preview Uploader**: Validasi file bukti transfer (JPG, PNG, PDF; maks 5MB) lengkap dengan live preview gambar sebelum dikirim.
*   **Booking Tracking & Extension Priority**: Lacak pemesanan melalui Nama + Kode. Jika penyewa aktif berada dalam H-7 sebelum checkout, form **Perpanjangan Sewa (Extension Priority)** akan aktif sehingga penyewa lama dapat me-lock kamarnya kembali sebelum dibuka ke publik.

### 2. Panel Admin Terpadu
*   **Dashboard KPI**: Statistik omzet 30 hari terakhir, rata-rata okupansi hunian, dan jumlah verifikasi tertunda.
*   **Occupancy Breakdown**: Grafik persentase hunian untuk tiap-tiap unit camp.
*   **Property Drilldown Manager**: Modul 3-kolom yang mengintegrasikan pengelolaan Camp CRUD ➔ Kamar CRUD ➔ Paket Harga CRUD dalam satu halaman terpadu.
*   **Stay Timeline Calendar**: Visualisasi kalender bulanan harian untuk melihat jadwal check-in & check-out tiap kamar.
*   **Transaction Verifier**: Melihat daftar booking, detail bukti transfer via temporary signed URL, serta tombol persetujuan (Approve) atau penolakan dengan catatan (Reject) yang langsung membuka template chat WhatsApp pelanggan.
*   **System Settings**: Konfigurasi kontak WhatsApp admin, no rekening bank, dan upload gambar kode QRIS.

---

## 🛠️ Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/) (App Router)
*   **Database & Auth**: [Supabase](https://supabase.com/) (Postgres + RLS)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Vanilla CSS (Warm Vanguard palette)
*   **Validation**: [Zod](https://zod.dev/) (Sanitasi schema client & server)
*   **Alerts**: [SweetAlert2](https://sweetalert2.github.io/)

---

## ⚙️ Cara Memulai

### 1. Inisialisasi Environment
Buat file `.env.local` di root folder dengan konfigurasi Supabase Anda:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (digunakan aman di server-side)
CRON_SECRET=your-secret-token (digunakan verifikasi vercel cron)
```

### 2. Jalankan Migrasi Database
Jalankan script DDL PostgreSQL yang terletak di `/supabase/migration_kost_camp.sql` di SQL Editor Supabase Anda untuk membuat tabel, policies RLS, indeks, dan RPC lock sewa.

### 3. Jalankan Dev Server
```bash
npm install
npm run dev
```

Akses [http://localhost:3000](http://localhost:3000) untuk portal publik dan [http://localhost:3000/admin/login](http://localhost:3000/admin/login) untuk dashboard pengelola.
