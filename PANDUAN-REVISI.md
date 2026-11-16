RuangPajak — panduan pemasangan revisi
File yang diperbarui
- App.jsx — penyimpanan progres, bank pretest/postest 10 soal, menu baru, musik sintetis, efek suara, dan tutor RMT.
- App.css dan index.css — tampilan responsif, warna lebih cerah, kartu interaktif, dan animasi.
- vite.config.js — nama PWA menjadi RuangPajak.
- public/favicon.svg dan public/pwa-icon.svg — ikon bertema belajar dan pajak.
- src/supabase.js — koneksi Supabase opsional dan sinkronisasi progres belajar.
- supabase/migrations/202611160001_student_learning_progress.sql — tabel progres belajar dengan Row Level Security.
- supabase/functions/rmt-tutor/index.ts — fungsi server yang meneruskan percakapan ke DeepSeek tanpa membuka API key di browser.
- .env.example — contoh variabel konfigurasi frontend.
main.jsx dan package.json yang kamu kirim tidak perlu diubah.
Memasang file di VS Code
1. Buat salinan/backup folder proyek lama terlebih dahulu.
2. Ganti src/App.jsx dengan file App.jsx hasil revisi.
3. Ganti src/App.css dengan file App.css hasil revisi.
4. Ganti src/index.css dengan file index.css hasil revisi. File index.css lamamu belum dikirim, jadi stylesheet ini dibuat sebagai pengganti dasar yang lengkap.
5. Ganti vite.config.js di folder utama proyek.
6. Salin public/favicon.svg dan public/pwa-icon.svg ke folder public proyek. Jangan hapus gambar lain yang sudah ada di folder public.
7. Salin folder supabase ke folder utama proyek.
8. Jangan mengganti main.jsx dan package.json.
Menjalankan aplikasi lokal
Buka terminal VS Code di folder proyek:
npm install
npm run dev
Buka alamat lokal yang ditampilkan Vite.
Penyimpanan progres
Profil, foto profil yang diperkecil, jawaban pretest/postest, jawaban kuis, hasil latihan, level, dan pembahasan disimpan di localStorage. Data ini bertahan saat halaman dimuat ulang pada browser/perangkat yang sama. Data belum otomatis tersinkron ke perangkat lain atau ke tabel database Supabase.
Mengaktifkan Tutor RMT + DeepSeek
Tutor di halaman Latihan Soal sudah disiapkan dengan alur Input–Elaboration–Output dan memanggil Supabase Edge Function. Agar AI benar-benar aktif, kamu memerlukan proyek Supabase dan API key DeepSeek milikmu.
1. Buat proyek di Supabase, lalu ambil Project URL dan anon/public key dari pengaturan API proyek.
2. Salin .env.example menjadi .env di folder utama proyek.
3. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY dengan nilai dari proyek Supabase.
4. Pasang Supabase CLI, lalu login dan hubungkan folder proyek:
npx supabase login
npx supabase link --project-ref REF_PROYEK_KAMU
5. Simpan API key DeepSeek sebagai secret server. Jangan masukkan key ini ke App.jsx, .env frontend, GitHub, atau pesan chat:
npx supabase secrets set DEEPSEEK_API_KEY=ISI_API_KEY_DEEPSEEK
6. Aktifkan Anonymous Sign-ins di Supabase Dashboard → Authentication → Sign In / Providers agar perangkat uji dapat memperoleh sesi anonim.
7. Terapkan tabel progres dan kebijakan aksesnya:
npx supabase db push
8. Deploy fungsi tutor:
npx supabase functions deploy rmt-tutor
9. Hentikan dan jalankan ulang Vite setelah .env diisi:
npm run dev
Jika tutor masih menampilkan pemberitahuan belum aktif, periksa kembali URL, anon key, secret, dan status deploy fungsi di dashboard Supabase.

Catatan keamanan: untuk uji coba siswa SMP, gunakan kode/panggilan samaran dan hindari mengisi data identitas nyata atau foto siswa jika tidak diperlukan. Data profil di perangkat bersama tetap dapat dilihat oleh pengguna perangkat tersebut.
Catatan penting tentang Supabase Database
Pada revisi ini, progres jawaban dan nilai disimpan di localStorage dan disiapkan untuk disinkronkan ke tabel student_learning_progress saat konfigurasi Supabase tersedia. Sinkronisasi menggunakan sesi anonim dan tidak mengirim nama, foto, gender, atau sekolah. Profil identitas tetap tersimpan lokal di perangkat. Untuk mengaktifkan sinkronisasi, terapkan migration dengan npx supabase db push dan aktifkan Anonymous Sign-ins. Data lokal tetap tersedia jika Supabase belum dikonfigurasi. Jangan menganggap localStorage sebagai database online.
Pemeriksaan sebelum dikumpulkan
- Pastikan menu tampil dengan urutan: Profil, Beranda, Pretest, Materi, Latihan Soal, Latihan, Kuis, Postest, Evaluasi.
- Isi profil, refresh browser, lalu periksa apakah isinya tetap ada.
- Isi sebagian pretest, refresh browser, dan pastikan jawaban/progres tetap ada.
- Periksa bahwa langkah penyelesaian latihan belum terbuka sebelum tombol Periksa Jawaban ditekan.
- Coba tombol musik dan periksa perubahan suasana audio ketika pindah halaman.
- Efek suara kuis muncul saat hasil diperiksa; nada berbeda untuk hasil benar sempurna dan hasil yang masih memiliki jawaban salah.
- Tutor RMT baru bisa menjawab setelah Supabase Edge Function dan secret DeepSeek dikonfigurasi.