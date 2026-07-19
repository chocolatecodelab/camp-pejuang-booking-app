# PRD: Sistem Booking Kost/Camp Online
**(Referensi: camp-pejuang.com)**

| Field | Detail |
|---|---|
| Versi Dokumen | 1.0 |
| Tanggal | 19 Juli 2026 |
| Status | Draft |
| Tech Stack Target | Next.js/Node.js (Vercel) + Supabase (Postgres + Storage) |
| Referensi Desain | camp-pejuang.com (multi-camp, kamar per camp, kapasitas 2-3 orang/kamar) |

---

## 1. Latar Belakang & Tujuan

### 1.1 Latar Belakang
Saat ini proses booking kost/camp (contoh kasus: camp di Kampung Inggris Pare) masih dilakukan manual lewat WhatsApp — calon penghuni chat admin satu per satu untuk tanya ketersediaan kamar, lalu transfer manual, lalu admin cocokkan bukti transfer secara manual. Proses ini rawan human error (kamar yang sudah terisi masih ditawarkan ke orang lain), sulit dilacak riwayatnya, dan admin kewalahan saat banyak calon penghuni bertanya bersamaan.

### 1.2 Perbedaan Domain vs Sistem Booking Lapangan (Referensi Sebelumnya)
Meski pola dasarnya mirip (pilih → pesan → bayar → terkonfirmasi), ada perbedaan mendasar yang mengubah desain sistem:

| Aspek | Booking Lapangan (jam) | Booking Kost/Camp (ini) |
|---|---|---|
| Satuan waktu | Per jam (07–23), sangat pendek | Per periode (minggu/bulan), sangat panjang |
| Unit yang dipesan | Slot jam di 1 court | Kamar (1 kamar = 1 penghuni) |
| Pembayaran | Otomatis via QRIS gateway | **Manual** — user upload bukti transfer, admin verifikasi manual |
| Kepastian booking | Instan setelah bayar (webhook) | **Tidak instan** — menunggu admin verifikasi bukti |
| Perlu tracking status | Tidak terlalu, karena cepat selesai | **Perlu** — proses verifikasi bisa makan waktu jam/hari, user perlu cek status sendiri |
| Satuan penguncian | Exact match per jam | **Overlap rentang tanggal** (check-in–check-out) per kamar |
| Isu unik | Race condition dalam hitungan detik | **Race condition perpanjangan sewa** (penghuni lama vs pemesan baru di kamar sama) — dibahas di bagian 5.3 |

Poin terakhir adalah tantangan desain paling penting di sistem ini dan dibahas detail di bagian 5.

### 1.3 Tujuan Produk
- Calon penghuni bisa lihat camp, kamar, dan ketersediaannya secara online tanpa harus chat admin dulu.
- Mencegah kamar yang sudah penuh/terisi tetap bisa dipesan orang lain.
- Mempermudah proses pembayaran manual (QRIS/transfer) dengan bukti upload yang terstruktur.
- Memberi kepastian & transparansi ke user lewat fitur tracking status pesanan.
- Memberi admin panel terpusat untuk kelola transaksi, harga, dan data camp/kamar.

### 1.4 Goals & Non-Goals

**Goals (MVP):**
- User bisa browse daftar camp → detail camp → pilih kamar → pilih periode sewa.
- User isi data diri (nama, WhatsApp, catatan) dan pilih metode bayar (QRIS manual/transfer bank), upload bukti bayar.
- User dapat kode booking unik, bisa dicek status-nya lewat halaman tracking (nama + kode booking).
- Admin bisa verifikasi bukti bayar (approve/reject) dari dashboard.
- Setelah approved, periode kamar yang dipesan otomatis tidak bisa dipilih pemesan lain (1 kamar = 1 penghuni per periode).
- Penghuni existing mendapat prioritas perpanjangan sewa sebelum kamar ditawarkan ke publik (lihat 5.3).
- Admin CRUD penuh untuk: Transaksi, Harga, Camp/Kamar.

**Non-Goals (di luar MVP awal):**
- Pembayaran otomatis (payment gateway) — sengaja tetap **manual** sesuai requirement Anda.
- Refund otomatis.
- Notifikasi WA otomatis dua arah (chatbot) — cukup notifikasi keluar (sistem → user) di fase awal.
- Aplikasi mobile native.

---

## 2. User Persona & Role

| Role | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Calon Penghuni (Guest)** | Umum, tidak perlu akun/login | Cari camp & kamar, booking cepat, tahu status pesanannya |
| **Admin/Owner** | Pemilik/pengelola camp | Kelola camp & kamar, verifikasi pembayaran, lihat laporan transaksi |
| **Penghuni Existing** (opsional, fase 2) | Yang sudah pernah booking | Cek riwayat, perpanjang sewa |

> Sama seperti sistem booking lapangan, **tidak perlu registrasi/login untuk user** — cukup nama & WhatsApp. Identitas pesanan dijaga lewat kombinasi **nama + kode booking unik** saat tracking.

---

## 3. Alur Bisnis (User Flow)

```
1. User buka website
      │
2. Lihat daftar Camp (kartu: nama, tipe putra/putri, lokasi, kapasitas, mulai dari harga)
      │
3. Klik salah satu Camp → Halaman Detail Camp
      → foto-foto, deskripsi, fasilitas, layout kamar per lantai
      → tiap kamar tampilkan: nama kamar, kapasitas, SISA SLOT tersedia
      │
4. Pilih kamar → pilih periode sewa (check-in date + durasi, lihat rekomendasi di bagian 5.1)
      → sistem hitung otomatis total harga & (jika ada) nominal DP minimum
      │
5. Isi form: Nama, No. WhatsApp, Catatan (opsional)
      │
6. Pilih metode & jenis pembayaran:
      - Metode: QRIS (tampilkan gambar QR statis milik owner) / Transfer Bank (tampilkan no. rekening)
      - Jenis: Bayar DP atau Bayar Full
      │
7. User transfer manual sendiri, lalu UPLOAD bukti pembayaran (foto/screenshot)
      │
8. Sistem generate KODE BOOKING unik → tampil di halaman konfirmasi
      → Status booking: "Menunggu Verifikasi"
      → Kamar/slot berstatus HOLD (belum permanen — lihat 5.4) sampai admin memutuskan
      │
9. Admin buka dashboard → lihat daftar transaksi masuk → cek bukti bayar
      │
   ┌──────────────┴──────────────┐
   │                              │
VALID                        TIDAK VALID
   │                              │
Status → CONFIRMED           Status → REJECTED
Slot kamar → TERKUNCI         Slot kamar dilepas kembali
permanen untuk periode itu    (kembali available)
   │                              │
Kirim notifikasi WA           Kirim notifikasi WA
"Booking Anda Terkonfirmasi"  "Bukti bayar tidak valid,
                               silakan hubungi admin/upload ulang"
      │
10. User bisa cek status kapan saja di halaman "Cek Pesanan"
    → input Nama + Kode Booking → tampil status & detail booking
```

---

## 4. Functional Requirements

### 4.1 Halaman Publik (User)
| ID | Requirement |
|---|---|
| FR-1 | Landing page menampilkan daftar semua camp (card: foto, nama, tipe putra/putri, lokasi singkat, "mulai dari Rp x/bulan") |
| FR-2 | Filter/kategori dasar: Putra / Putri (opsional: filter lokasi) |
| FR-3 | Halaman detail camp: galeri foto, deskripsi, fasilitas unggulan, peta lokasi, daftar kamar per lantai/bangunan |
| FR-4 | Tiap kamar menampilkan kapasitas total & sisa slot tersedia untuk rentang tanggal yang dipilih user |
| FR-5 | User memilih kamar + periode sewa (check-in date + durasi) |
| FR-6 | Sistem menghitung total harga otomatis berdasar durasi & harga kamar (mendukung harga berbeda per kamar/camp) |
| FR-7 | Form data diri: Nama, No. WhatsApp (wajib, divalidasi), Catatan (opsional) |
| FR-8 | Pilihan jenis pembayaran: DP atau Full; pilihan metode: QRIS (gambar QR statis) atau Transfer Bank |
| FR-9 | Upload bukti pembayaran (gambar, wajib) sebelum booking bisa disubmit |
| FR-10 | Generate kode booking unik (format mudah diingat & disebutkan by phone, contoh `CP-0715-XK92`) |
| FR-11 | Halaman "Cek Pesanan" — input Nama + Kode Booking → tampilkan status (Menunggu Verifikasi/Terkonfirmasi/Ditolak) + detail |
| FR-12 | Notifikasi WA otomatis dikirim ke user saat status berubah (approved/rejected) — lihat 5.6 untuk opsi implementasi |

### 4.2 Panel Admin
| ID | Requirement |
|---|---|
| FR-13 | Login admin (Supabase Auth) |
| FR-14 | **CRUD Transaksi**: list semua booking (filter status/camp/tanggal), detail per booking termasuk lihat gambar bukti bayar, tombol Approve/Reject dengan catatan alasan |
| FR-15 | **CRUD Harga**: atur harga per kamar (bisa beda antar kamar dalam 1 camp), atur skema harga per durasi (2 minggu/1 bulan/dst — lihat 5.1), atur nominal minimum DP (persen atau nominal tetap) |
| FR-16 | **CRUD Camp/Kost**: tambah/edit/hapus camp (nama, tipe, lokasi, deskripsi, foto, fasilitas), dan **CRUD Kamar** nested di dalam camp (nama kamar, lantai, kapasitas, foto kamar) |
| FR-17 | Dashboard ringkasan: jumlah booking pending verifikasi (perlu action segera), okupansi kamar terkini, omzet |
| FR-18 | Admin bisa manual override/cancel booking yang sudah confirmed (misal penghuni batal, butuh alasan) |

### 4.3 Sistem/Background
| ID | Requirement |
|---|---|
| FR-19 | Mencegah kamar yang kapasitasnya sudah penuh untuk suatu periode tetap muncul "available" |
| FR-20 | Auto-release HOLD jika user tidak upload bukti bayar dalam batas waktu tertentu (misal 1x24 jam), supaya slot tidak nyangkut karena orang iseng |
| FR-21 | Simpan riwayat perubahan status booking (audit trail) — siapa approve/reject, kapan |

---

## 5. Detail Keputusan Desain Penting

### 5.1 Rekomendasi: Satuan Booking — Per Tanggal, Per Minggu, atau Per Bulan?

Ini pertanyaan inti yang Anda tanyakan. Berikut analisisnya:

**Konteks bisnis camp di Pare (Kampung Inggris):** penghuni biasanya mengikuti program kursus bahasa Inggris dengan durasi umum **2 minggu** atau **kelipatan 1 bulan**. Harga di situs referensi juga ditampilkan "Rp 300.000/bulan" — artinya satuan harga dasarnya adalah **bulanan**, bukan harian.

**Rekomendasi: Hybrid — "Check-in date bebas + pilihan paket durasi", bukan grid kalender kaku.**

| Pendekatan | Kelebihan | Kekurangan |
|---|---|---|
| **A. Per tanggal (date range bebas, seperti booking hotel)** | Paling fleksibel, user bisa pilih persis kapan masuk-keluar | Perhitungan harga jadi rumit (harus prorata harian dari harga bulanan), UX kalender untuk durasi 1-3 bulan jadi berat dipakai |
| **B. Per bulan kaku (mis. hanya bisa booking tanggal 1 tiap bulan)** | Simpel untuk admin, mudah dihitung | Tidak realistis — orang datang kapan saja, terlalu kaku untuk kebutuhan nyata |
| **C. Hybrid (direkomendasikan): Check-in date bebas (kalender pilih 1 tanggal mulai) + pilih paket durasi (2 minggu / 1 bulan / 2 bulan / 3 bulan / Custom)** | Cocok dengan pola bisnis kursus, harga tetap simpel dihitung per paket, tapi user tetap fleksibel kapan mulai | Perlu sedikit logic tambahan untuk opsi "Custom" |

**Keputusan yang disarankan:**
1. User pilih **tanggal check-in** dari kalender (hanya 1 tanggal, bukan range).
2. User pilih **durasi** dari daftar paket yang sudah ditentukan admin per camp (contoh: `2 Minggu`, `1 Bulan`, `2 Bulan`, `3 Bulan`), masing-masing dengan harga tetap yang di-set admin (bukan hasil kali otomatis, karena kadang ada diskon durasi panjang).
3. Sistem otomatis hitung `check_out_date = check_in_date + durasi`.
4. (Opsional fase 2) sediakan opsi "Custom (harian)" dengan harga = `harga_bulanan / 30 hari` untuk kasus tertentu, ditandai jelas bahwa harga custom mungkin lebih mahal per hari dibanding paket.

Pendekatan ini membuat perhitungan ketersediaan kamar tetap berbasis **date range** (fleksibel untuk masa depan), tapi UX pemilihan tetap simpel seperti "pilih paket" — bukan drag kalender 60 hari yang membingungkan di mobile.

### 5.2 Model Kamar: 1 Kamar = 1 Penghuni

Karena tiap kamar hanya diisi 1 orang, model penguncian jadi sederhana — mirip prinsip 1 court = 1 pemesan di sistem booking lapangan, hanya saja satuan waktunya **rentang tanggal (check-in–check-out)**, bukan jam tunggal. Constraint anti-tabrakan diterapkan langsung di level kamar, dengan cek **overlap rentang tanggal** menggunakan PostgreSQL `EXCLUDE` constraint (detail SQL di `design.md`). Begitu 1 kamar `CONFIRMED` untuk suatu periode, kamar itu otomatis tidak akan muncul "available" untuk periode yang overlap ke pemesan lain.

### 5.3 Tantangan Utama: Perpanjangan Sewa (Extend) vs Pemesan Baru

Ini pertanyaan yang Anda angkat, dan penting untuk dipahami sebagai **masalah bisnis, bukan sekadar bug teknis**.

**Skenario masalahnya:**
```
Budi booking Kamar A: 1 Jan – 1 Feb (CONFIRMED)
      │
   [Budi belum menyatakan mau extend]
      │
Andi booking Kamar A: 1 Feb – 1 Mar  ← secara teknis VALID,
      │                                 karena per 1 Feb kamar "kosong"
Budi baru mau extend per 28 Jan ← TERLAMBAT, kamar sudah diambil Andi
```

Secara teknis sistem bekerja benar (tidak ada tabrakan tanggal), tapi ini merugikan penghuni lama yang sebenarnya masih berniat lanjut. Solusinya adalah memberi **hak prioritas** ke penghuni lama lewat jendela waktu tertentu sebelum kamar dibuka ke publik.

**Solusi: "Priority Extension Window"**

```
H-7 sebelum checkout (misal checkout 1 Feb → mulai H-7 = 25 Jan)
      │
Sistem otomatis:
  1. Kirim reminder WA ke Budi: "Sewa Anda berakhir 1 Feb, mau extend?"
  2. Kamar A untuk periode SETELAH 1 Feb disembunyikan dari
     listing publik (Andi tidak akan melihat Kamar A available)
      │
Budi punya window (misal 3 hari) untuk memutuskan:
      │
   ┌──────────────┴──────────────┐
   │                              │
Budi klik "Ya, Extend"        Budi tidak merespons
di halaman Cek Pesanan         sampai window habis
sebelum window habis               │
   │                           Kamar A otomatis terbuka
Lanjut ke pembayaran           kembali ke publik — Andi
extend (flow sama seperti      baru bisa booking SETELAH ini
booking baru, kamar &
penghuni sudah terisi
otomatis)
   │
Status → HOLD → PENDING_VERIFICATION → CONFIRMED
(sama seperti booking normal, terhubung ke booking sebelumnya)
```

**Kenapa bukan sekadar "siapa cepat dia dapat"?** Karena penghuni lama yang royal seharusnya tidak dirugikan hanya karena telat klik "extend" — priority window memberi mereka kepastian tanpa mengunci kamar selamanya (kalau ternyata tidak merespons dalam window, kamar tetap dilepas ke calon penghuni baru, jadi tetap adil untuk kedua sisi).

**Elemen desain yang perlu diimplementasikan:**

| Elemen | Penjelasan |
|---|---|
| `parent_booking_id` | Kolom di `bookings` — booking extend terhubung ke booking sebelumnya, `check_in` otomatis = `check_out` booking induk |
| `extension_offer_expires_at` | Timestamp kapan window prioritas berakhir |
| Query ketersediaan publik | Periode yang masih dalam window prioritas booking lain **disembunyikan** dari listing publik, kecuali booking datang dari nama/WA penghuni yang sama |
| Cron harian | Cari booking `CONFIRMED` yang mendekati `check_out` (H-7) → buka window prioritas + kirim reminder WA |
| Auto-expire window | Cron yang sama cek window yang sudah lewat & belum ada aksi → kamar kembali normal available |
| Tombol "Perpanjang" | Muncul di halaman "Cek Pesanan" begitu booking mendekati checkout — klik langsung ke flow pembayaran, skip pilih kamar/tanggal |

Jika window sudah lewat dan penghuni lama baru mau extend setelah kamar diambil orang baru, sistem harus jujur menyampaikan "maaf, slot sudah diambil" dan menawarkan kamar lain — sama seperti kasus umum di hotel/apartemen. Selama window prioritas cukup (default 7 hari, bisa diatur admin per camp), risiko ini kecil.

### 5.4 Status Booking (Berbeda dari Sistem Jam karena Verifikasi Manual)

```
DRAFT/HOLD → PENDING_VERIFICATION → CONFIRMED
                    │
                    └──► REJECTED → (slot dilepas, user bisa upload ulang bukti baru / booking ulang)
HOLD (expired, tidak upload bukti) → EXPIRED (slot dilepas otomatis)
```

- **HOLD**: begitu user memilih kamar & periode lalu lanjut ke form — slot langsung "dipesan sementara" (soft lock) supaya tidak direbut orang lain saat user masih mengisi form/upload bukti.
- **PENDING_VERIFICATION**: setelah user upload bukti bayar & submit. Slot tetap ter-hold, sekarang menunggu admin.
- **CONFIRMED**: admin approve → slot terkunci permanen untuk periode tersebut.
- **REJECTED**: admin reject (misal bukti tidak jelas/nominal salah) → slot dilepas kembali jadi available, user diberi tahu via WA untuk upload ulang atau hubungi admin.
- **EXPIRED**: kalau user tidak menyelesaikan upload bukti dalam batas waktu (misal 24 jam) → slot otomatis dilepas.

> **Rekomendasi batas waktu HOLD:** karena ini booking bulanan (bukan per jam), batas waktu hold sebaiknya lebih longgar dibanding sistem lapangan — misal **1x24 jam** untuk upload bukti, bukan 10 menit. Setelah upload & masuk status PENDING_VERIFICATION, tidak ada batas waktu otomatis lagi (karena menunggu admin, bukan menunggu user) — tapi sebaiknya ada reminder di dashboard admin untuk transaksi yang sudah pending lebih dari misal 12 jam supaya tidak ada calon penghuni menunggu terlalu lama.

### 5.4 Upload Bukti Pembayaran

- Simpan file ke **Supabase Storage** (bucket privat, bukan publik) — bukti pembayaran adalah data sensitif (nominal, nama pengirim, dll), jangan taruh di bucket publik yang bisa diakses siapa saja lewat URL tebakan.
- Generate signed URL sementara saat admin perlu melihat gambar di dashboard.
- Validasi tipe file (JPG/PNG/PDF) & ukuran maksimal (misal 5MB) di sisi client & server.
- Boleh multi-upload jika user perlu upload ulang (riwayat semua percobaan upload tetap disimpan untuk audit, bukan menimpa file lama).

### 5.5 Kode Booking & Tracking

- Format kode sebaiknya pendek, mudah dibacakan lewat telepon/WA, dan tidak mudah ditebak orang lain. Contoh: `CP-0719-7XQ2` (prefix camp + tanggal + random 4 karakter alfanumerik, exclude karakter ambigu seperti `0/O`, `1/I`).
- Halaman tracking **wajib** meminta kombinasi **Nama + Kode Booking** (bukan kode saja) sebagai lapisan keamanan minimal, supaya orang lain tidak asal coba-coba kode untuk mengintip data booking orang lain.
- Tampilkan di halaman tracking: status terkini, detail kamar & periode, riwayat status (kapan submit, kapan diverifikasi), dan tombol "Hubungi Admin via WhatsApp" jika ada masalah.

### 5.6 Notifikasi WhatsApp

Untuk MVP, ada 2 opsi realistis:
1. **Manual-assisted (tercepat untuk MVP):** setelah admin klik "Approve/Reject" di dashboard, sistem generate **link `wa.me` dengan pesan template siap kirim** yang otomatis terbuka di tab baru — admin tinggal klik "Kirim" di WhatsApp Web/App miliknya. Tidak perlu API berbayar, tidak perlu approval Meta Business.
2. **Full otomatis (fase 2):** integrasi API pihak ketiga (Fonnte/Wablas) atau WhatsApp Business Cloud API resmi, sistem kirim WA otomatis tanpa campur tangan admin sama sekali.

**Rekomendasi:** mulai dengan opsi 1 untuk MVP (lebih cepat rilis, tanpa biaya API tambahan), upgrade ke opsi 2 begitu volume booking sudah cukup tinggi sehingga proses klik manual mulai memberatkan admin.

### 5.7 Harga & DP

- Harga di-set **per kamar** (bukan per camp), karena tiap kamar bisa beda ukuran/fasilitas meski dalam 1 camp yang sama (sesuai contoh di camp-pejuang.com, biasanya seragam per camp tapi sistem tetap harus mendukung kalau beda).
- Skema harga disimpan per **kombinasi kamar + paket durasi** (bukan dihitung otomatis dari harga/bulan × jumlah bulan), supaya admin bisa kasih harga khusus untuk paket lebih panjang (misal diskon untuk 3 bulan).
- DP: admin set aturan DP per camp (misal "minimal DP 30% atau Rp 100.000") — sistem validasi nominal yang diklaim user tidak kurang dari minimum ini sebelum submit (walau nominal sebenarnya baru dipastikan admin lewat cek bukti transfer manual).

---

## 6. Non-Functional Requirements

| Aspek | Kebutuhan |
|---|---|
| Performa | Halaman detail camp (dengan galeri foto) tetap load cepat — gunakan image optimization (Next.js Image, lazy load) |
| Keamanan | Bucket bukti bayar privat + signed URL; validasi input server-side; rate-limit endpoint booking & tracking (cegah brute-force tebak kode booking) |
| Skalabilitas | Skema mendukung penambahan camp/kamar baru tanpa migrasi struktur besar |
| Mobile-friendly | User Kampung Inggris mayoritas akses dari HP — wajib responsive, terutama form upload bukti bayar (akses kamera langsung) |
| Auditability | Semua perubahan status booking & keputusan admin tercatat dengan timestamp + siapa yang melakukan |
| Privasi Data | Data pribadi (nama, WA, bukti transfer) hanya bisa diakses admin yang login — tidak ada endpoint publik yang membocorkan data booking orang lain |

---

## 7. Tech Stack & Arsitektur (Sesuai Rencana Anda)

```
Frontend + Backend : Next.js (App Router) — deploy di Vercel
Database            : Supabase (Postgres) + Supabase Auth (admin)
File Storage        : Supabase Storage (bucket privat untuk bukti pembayaran & foto kamar/camp)
Cron (auto-expire)  : Vercel Cron Jobs — lepas HOLD yang kedaluwarsa
Notifikasi WA       : wa.me link template (MVP) → Fonnte/Wablas API (fase 2)
```

Stack ini identik dengan sistem booking lapangan sebelumnya — perbedaan utama hanya di skema data (date range + slot kapasitas, bukan hour grid) dan alur verifikasi (manual, bukan payment gateway otomatis). Sengaja disamakan supaya kalau Anda ingin, kedua sistem bisa berbagi banyak pola kode/komponen di kemudian hari.

---

## 8. MVP Scope — Prioritas Pembangunan

**Fase 1 (MVP inti, wajib ada sebelum launch):**
1. Skema database: `camps`, `rooms`, `room_slots`, `pricing_packages`, `bookings`, `payment_proofs`
2. Halaman publik: daftar camp → detail camp → pilih kamar & durasi → form data diri → upload bukti → kode booking
3. Halaman "Cek Pesanan" (tracking by nama + kode)
4. Panel admin: login, list transaksi + approve/reject dengan lihat bukti bayar
5. Panel admin: CRUD Camp & Kamar (termasuk upload foto)
6. Panel admin: CRUD Harga (paket durasi per kamar)
7. Auto-expire HOLD via Vercel Cron
8. Notifikasi WA via wa.me template link (opsi 1 di 5.6)

**Fase 2:**
- Notifikasi WA otomatis penuh (Fonnte/Wablas)
- Dashboard laporan okupansi & omzet lebih lengkap
- Opsi custom date range (di luar paket durasi)
- Riwayat & perpanjangan sewa untuk penghuni existing

**Fase 3 (nice-to-have):**
- Integrasi payment gateway QRIS otomatis (upgrade dari manual)
- Sistem ulasan/rating camp
- Multi-admin dengan role berbeda (super admin vs admin per camp)

---

## 9. Best Practice — Ringkasan Rekomendasi

1. **Model kamar sebagai kumpulan slot**, bukan 1 unit tunggal — ini satu-satunya cara realistis menangani kapasitas >1 orang per kamar dengan booking dari orang berbeda & tanggal berbeda.
2. **Gunakan constraint database (`EXCLUDE` dengan range tanggal)** untuk cegah overbooking per slot — jangan andalkan validasi aplikasi saja, sama seperti prinsip di sistem booking lapangan.
3. **Pisahkan status HOLD (soft lock sementara) dari CONFIRMED (terkunci permanen)** — supaya slot tidak "mati" gara-gara orang isi form lalu kabur tanpa upload bukti.
4. **Beri batas waktu HOLD yang proporsional dengan konteks bisnis** — untuk booking bulanan, 24 jam jauh lebih masuk akal daripada 10 menit ala booking jam.
5. **Simpan bukti pembayaran di storage privat**, bukan publik — ini data finansial & personal yang sensitif.
6. **Kode booking + nama sebagai kunci tracking**, bukan kode saja — mencegah orang asal tebak kode untuk mengintip booking orang lain.
7. **Mulai dengan notifikasi WA semi-manual (wa.me link)** dulu untuk MVP — hemat biaya & waktu development, upgrade ke API otomatis saat skala sudah butuh.
8. **Harga per paket durasi, bukan hasil kalkulasi otomatis per bulan** — memberi keleluasaan bisnis untuk diskon durasi panjang tanpa perlu ubah logic kode tiap kali ada promo.
9. **Catat semua riwayat perubahan status** (audit trail) — penting untuk kepercayaan, terutama saat ada dispute "saya sudah bayar tapi kok ditolak?".

---

## 10. Langkah Simpel Memulai Development

1. **Setup project**: `create-next-app` → hubungkan Supabase (aktifkan extension `btree_gist` untuk exclude constraint range tanggal).
2. **Bangun skema database** camps → rooms → room_slots → pricing_packages, lalu bookings & payment_proofs.
3. **Bangun halaman publik read-only dulu**: daftar camp → detail camp → tampilan sisa slot per kamar (tanpa booking dulu), pastikan query ketersediaan sudah benar.
4. **Bangun flow booking + HOLD slot** dengan exclude constraint — test dengan skenario 2 booking berbeda pada kamar kapasitas 2, pastikan booking ke-3 pada periode sama otomatis ditolak.
5. **Bangun upload bukti bayar** ke Supabase Storage (bucket privat) + generate kode booking.
6. **Bangun halaman Cek Pesanan** (tracking).
7. **Bangun panel admin**: login, list & approve/reject transaksi (dengan preview bukti bayar via signed URL), CRUD Camp/Kamar/Harga.
8. **Tambahkan Vercel Cron** untuk auto-expire HOLD yang lewat 24 jam tanpa upload bukti.
9. **Testing end-to-end**: booking sukses (approve), booking ditolak (reject + slot kembali available), kamar penuh (booking ke-N ditolak), tracking pesanan.
10. **Deploy ke Vercel**, uji coba dengan 1 camp dulu sebelum onboarding semua camp.

---

*Dokumen ini adalah draft awal. Bagian yang paling disarankan untuk didiskusikan lebih dulu dengan stakeholder/pemilik camp sebelum development: kebijakan durasi paket sewa (5.1), aturan minimum DP (5.7), dan batas waktu HOLD (5.3) — karena ini murni keputusan bisnis, bukan teknis.*
