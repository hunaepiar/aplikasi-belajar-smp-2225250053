
# Aplikasi Pembelajaran Pajak

## Identitas Pengembang

- **Nama:** KHUNAEPI
- **NIM:** 2225250053

## Deskripsi

Aplikasi Pembelajaran Pajak merupakan aplikasi pembelajaran berbasis web yang dirancang untuk membantu siswa SMP memahami materi pajak melalui kegiatan belajar yang interaktif, latihan soal, kuis, dan evaluasi hasil belajar.

## Fitur Aplikasi

- Profil Siswa
- Beranda
- Pretest
- Materi Pembelajaran
- Latihan Soal
- Kuis
- Posttest
- Evaluasi Hasil Belajar
- Tutor RMT
- Progress Belajar
- Progressive Web App (PWA)

## Teknologi yang Digunakan

- React
- Vite
- JavaScript
- CSS
- Supabase
- Vite PWA Plugin

## Menjalankan Proyek

1. Clone repositori:

   ```bash
   git clone https://github.com/hunaepiar/aplikasi-belajar-smp-2225250053.git
   ```

2. Masuk ke folder proyek:

   ```bash
   cd aplikasi-belajar-smp-2225250053
   ```

3. Instal dependensi:

   ```bash
   npm.cmd install
   ```

4. Jalankan aplikasi:

   ```bash
   npm.cmd run dev
   ```

5. Build aplikasi:

   ```bash
   npm.cmd run build
   ```

## Konfigurasi Supabase

Buat file `.env` di folder utama proyek dan masukkan konfigurasi Supabase:

```env
VITE_SUPABASE_URL=URL_SUPABASE
VITE_SUPABASE_ANON_KEY=ANON_KEY_SUPABASE
```

Jangan membagikan file `.env` yang berisi kredensial proyek.

## Deployment

Aplikasi di-deploy menggunakan Vercel dengan menghubungkan repositori GitHub.

Setiap perubahan yang di-push ke branch utama dapat memicu deployment otomatis.

## Tujuan Pengembangan

Aplikasi ini dikembangkan sebagai media pembelajaran digital untuk membantu siswa memahami materi pajak melalui pembelajaran yang interaktif, terstruktur, dan mudah diakses.
