import { useEffect, useState } from "react";
import "./App.css";
import { syncLearningProgress } from "./supabase.js";

function readSaved(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => readSaved(key, initialValue));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Data ${key} tidak dapat disimpan di perangkat ini.`, error);
    }
  }, [key, value]);
  return [value, setValue];
}

function playQuizFeedback(results) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = 0.16;
    master.connect(context.destination);
    results.forEach((isCorrect, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + index * 0.13;
      oscillator.type = isCorrect ? "sine" : "triangle";
      oscillator.frequency.value = isCorrect ? 720 : 185;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.65, startAt + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.11);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.12);
    });
    window.setTimeout(() => context.close(), results.length * 135 + 250);
  } catch (error) {
    console.warn("Efek suara kuis tidak dapat diputar.", error);
  }
}


function useAmbientMusic(enabled, page) {
  useEffect(() => {
    if (!enabled) return;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    let timer;
    let step = 0;

    const gameMode = ["Kuis", "Latihan", "Latihan Soal"].includes(page);

    // Nada dasar C mayor dengan nuansa ceria.
    const melody = gameMode
      ? [
          523, 659, 784, 659, 587, 698, 880, 784,
          659, 784, 988, 880, 784, 659, 587, 659,
          523, 587, 659, 784, 880, 784, 659, 587,
          659, 784, 880, 1047, 880, 784, 659, 784,
          880, 784, 659, 587, 523, 659, 784, 880,
          988, 880, 784, 659, 587, 659, 784, 523
        ]
      : [
          392, 494, 587, 659, 587, 494, 440, 523,
          587, 659, 784, 659, 587, 523, 494, 587,
          659, 784, 880, 784, 659, 587, 523, 587,
          659, 587, 494, 523, 587, 659, 784, 659,
          587, 659, 784, 880, 784, 659, 587, 523,
          494, 587, 659, 784, 880, 784, 659, 587
        ];

    // Progression chord yang berganti sepanjang musik.
    const chords = [
      [261.63, 329.63, 392],
      [349.23, 440, 523.25],
      [392, 493.88, 587.33],
      [329.63, 392, 493.88]
    ];

    function note(freq, start, duration, volume, type) {
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        volume,
        start + 0.025
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + duration
      );

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start(start);
      osc.stop(start + duration + 0.04);
    }

    function playStep() {
      if (context.state !== "running") return;

      const now = context.currentTime;
      const index = step % melody.length;
      const frequency = melody[index];

      // Melodi utama.
      if (frequency) {
        note(frequency, now, 0.30, 0.065, "triangle");
      }

      // Nada tinggi sebagai hiasan melodi.
      if (index % 4 === 2) {
        note(frequency * 2, now, 0.16, 0.018, "sine");
      }

      // Bass berganti mengikuti progresi akor.
      if (index % 8 === 0) {
        const chord = chords[
          Math.floor(index / 8) % chords.length
        ];

        note(chord[0] / 2, now, 0.55, 0.055, "sine");
        note(chord[1], now, 0.42, 0.018, "triangle");
        note(chord[2], now + 0.10, 0.35, 0.015, "sine");
      }

      // Irama pendamping yang lebih lembut.
      if (index % 2 === 1) {
        note(1046.5, now, 0.07, 0.008, "sine");
      }

      step++;
    }

    context.resume().then(() => {
      playStep();
      timer = window.setInterval(playStep, 250);
    }).catch((error) => {
      console.warn("Musik tidak dapat dimulai:", error);
    });

    return () => {
      if (timer) window.clearInterval(timer);
      if (context.state !== "closed") {
        context.close();
      }
    };
  }, [enabled, page]);
}


const soalPretest = [
  { soal: "Sebuah buku berharga Rp80.000,00. Dalam soal ini dikenakan pajak 5%. Berapa besar pajaknya?", pilihan: ["Rp2.000,00", "Rp4.000,00", "Rp5.000,00", "Rp8.000,00"], jawaban: 1 },
  { soal: "Harga sebuah tas Rp100.000,00 dan pajaknya 10%. Berapa harga setelah pajak?", pilihan: ["Rp100.000,00", "Rp105.000,00", "Rp110.000,00", "Rp120.000,00"], jawaban: 2 },
  { soal: "Sepatu seharga Rp150.000,00 mendapat diskon 20%. Berapa harga setelah diskon?", pilihan: ["Rp100.000,00", "Rp110.000,00", "Rp120.000,00", "Rp130.000,00"], jawaban: 2 },
  { soal: "Toko A menjual tas Rp120.000,00 dengan pajak 10%. Toko B menjual tas Rp115.000,00 dengan pajak 12%. Toko mana yang lebih murah setelah pajak?", pilihan: ["Toko A, Rp132.000,00", "Toko B, Rp128.800,00", "Keduanya sama", "Tidak dapat ditentukan"], jawaban: 1 },
  { soal: "Harga makanan Rp250.000,00. Jika pajak dalam soal sebesar 4%, berapa pajaknya?", pilihan: ["Rp5.000,00", "Rp8.000,00", "Rp10.000,00", "Rp12.000,00"], jawaban: 2 },
  { soal: "Barang Rp400.000,00 mendapat diskon 10%, kemudian dikenakan pajak 2,5% dari harga setelah diskon. Berapa harga akhirnya?", pilihan: ["Rp360.000,00", "Rp369.000,00", "Rp370.000,00", "Rp380.000,00"], jawaban: 1 },
  { soal: "Pajak sebesar Rp12.000,00 dikenakan pada harga Rp300.000,00. Berapa persentase pajaknya?", pilihan: ["2%", "3%", "4%", "5%"], jawaban: 2 },
  { soal: "Pada struk, harga barang Rp200.000,00 dan pajak Rp10.000,00. Berapa total yang dibayar?", pilihan: ["Rp190.000,00", "Rp200.000,00", "Rp210.000,00", "Rp220.000,00"], jawaban: 2 },
  { soal: "Mengapa 7% perlu diubah menjadi 0,07 saat menghitung pajak dengan perkalian?", pilihan: ["Karena persen berarti per seratus", "Agar angkanya lebih besar", "Karena semua pajak dikurangi", "Agar harga menjadi nol"], jawaban: 0 },
  { soal: "Dina membawa uang Rp150.000,00. Total belanja setelah pajak Rp138.000,00. Berapa uang kembalian Dina?", pilihan: ["Rp10.000,00", "Rp12.000,00", "Rp15.000,00", "Rp18.000,00"], jawaban: 1 }
];

const soalPosttest = [
  { soal: "Sebuah jaket berharga Rp320.000,00 dikenakan pajak 5%. Berapa total pembayarannya?", pilihan: ["Rp326.000,00", "Rp336.000,00", "Rp340.000,00", "Rp352.000,00"], jawaban: 1 },
  { soal: "Harga sepeda Rp1.200.000,00 mendapat diskon 15%. Berapa harga setelah diskon?", pilihan: ["Rp1.000.000,00", "Rp1.020.000,00", "Rp1.050.000,00", "Rp1.080.000,00"], jawaban: 1 },
  { soal: "Setelah diskon 10%, sebuah barang menjadi Rp270.000,00. Berapa harga sebelum diskon?", pilihan: ["Rp280.000,00", "Rp290.000,00", "Rp300.000,00", "Rp310.000,00"], jawaban: 2 },
  { soal: "Harga barang Rp500.000,00 mendapat diskon 20%, lalu pajak 5% dari harga setelah diskon. Berapa totalnya?", pilihan: ["Rp400.000,00", "Rp410.000,00", "Rp420.000,00", "Rp425.000,00"], jawaban: 2 },
  { soal: "Dua toko menawarkan barang sama. Toko A Rp250.000,00 dengan pajak 4%; Toko B Rp245.000,00 dengan pajak 6%. Berapa total harga di Toko B?", pilihan: ["Rp249.900,00", "Rp254.700,00", "Rp259.700,00", "Rp260.000,00"], jawaban: 2 },
  { soal: "Pajak 3% dari suatu pembelian adalah Rp18.000,00. Berapa harga sebelum pajak?", pilihan: ["Rp500.000,00", "Rp550.000,00", "Rp600.000,00", "Rp650.000,00"], jawaban: 2 },
  { soal: "Seseorang membayar Rp525.000,00 untuk barang yang harganya Rp500.000,00 sebelum pajak. Berapa persentase pajaknya?", pilihan: ["2%", "4%", "5%", "10%"], jawaban: 2 },
  { soal: "Harga awal dua barang adalah Rp150.000,00 dan Rp250.000,00. Keduanya dikenakan pajak 2,5%. Berapa total pajak?", pilihan: ["Rp7.500,00", "Rp10.000,00", "Rp12.500,00", "Rp15.000,00"], jawaban: 1 },
  { soal: "Rani memiliki Rp500.000,00. Ia membeli barang Rp420.000,00 dengan pajak 5%. Berapa sisa uangnya?", pilihan: ["Rp49.000,00", "Rp59.000,00", "Rp69.000,00", "Rp79.000,00"], jawaban: 1 },
  { soal: "Mengapa pembeli perlu membandingkan harga akhir, bukan hanya harga awal, ketika ada pajak berbeda?", pilihan: ["Karena pajak memengaruhi total pembayaran", "Karena harga awal selalu salah", "Karena diskon tidak boleh dihitung", "Karena pajak selalu sama"], jawaban: 0 }
];

function Assessment({ type, questions }) {
  const title = type === "pretest" ? "Pretest" : "Postest";
  const storageKey = `ruangpajak_${type}`;
  const [nomor, setNomor] = usePersistentState(`${storageKey}_nomor`, 0);
  const [jawabanSiswa, setJawabanSiswa] = usePersistentState(`${storageKey}_jawaban`, {});
  const [selesai, setSelesai] = usePersistentState(`${storageKey}_selesai`, false);
  const benar = questions.filter((soal, i) => jawabanSiswa[i] === soal.jawaban).length;
  const nilai = Math.round((benar / questions.length) * 100);

  function simpanHasil() {
    localStorage.setItem(type === "pretest" ? "nilaiPretest" : "nilaiPosttest", String(nilai));
    syncLearningProgress({
      nilaiPretest: localStorage.getItem("nilaiPretest"),
      nilaiPosttest: localStorage.getItem("nilaiPosttest"),
      nilaiLatihan: localStorage.getItem("nilaiLatihan"),
      jawabanKuis: readSaved("ruangpajak_jawaban_kuis", {}),
      kuisDiperiksa: readSaved("ruangpajak_kuis_diperiksa", false),
      levelLatihan: readSaved("ruangpajak_level_latihan", 1),
      jawabanLatihan: readSaved("ruangpajak_jawaban_latihan", {}),
      hasilLatihan: readSaved("ruangpajak_hasil_latihan", {}),
    }).catch((error) => console.warn("Sinkronisasi hasil asesmen belum berhasil:", error));
    setSelesai(true);
  }

  return (
    <section className="halaman-kosong assessment-page">
      <p className="sapaan">PENGUKURAN PEMAHAMAN</p>
      <h1>{title}</h1>
      <p>{type === "pretest" ? "Kerjakan sebelum mempelajari materi untuk mengetahui pemahaman awalmu." : "Kerjakan setelah belajar untuk melihat perkembangan pemahamanmu."}</p>
      {!selesai ? (
        <div className="form-profil assessment-card">
          <div className="assessment-progress"><span>Soal {nomor + 1} dari {questions.length}</span><span>{Object.keys(jawabanSiswa).length}/{questions.length} terjawab</span></div>
          <div className="assessment-track"><span style={{ width: `${((nomor + 1) / questions.length) * 100}%` }} /></div>
          <h2>{questions[nomor].soal}</h2>
          <div className="assessment-options">
            {questions[nomor].pilihan.map((pilihan, i) => (
              <label className={`assessment-option ${jawabanSiswa[nomor] === i ? "selected" : ""}`} key={i}>
                <input type="radio" name={`${type}-${nomor}`} checked={jawabanSiswa[nomor] === i} onChange={() => setJawabanSiswa((old) => ({ ...old, [nomor]: i }))} />
                <span>{String.fromCharCode(65 + i)}. {pilihan}</span>
              </label>
            ))}
          </div>
          <div className="assessment-actions">
            <button className="tombol-sekunder" disabled={nomor === 0} onClick={() => setNomor((n) => Math.max(0, n - 1))}>Sebelumnya</button>
            {nomor < questions.length - 1 ? (
              <button className="tombol-utama" disabled={jawabanSiswa[nomor] === undefined} onClick={() => setNomor((n) => Math.min(questions.length - 1, n + 1))}>Selanjutnya</button>
            ) : (
              <button className="tombol-utama" disabled={Object.keys(jawabanSiswa).length !== questions.length} onClick={simpanHasil}>Selesai {title}</button>
            )}
          </div>
        </div>
      ) : (
        <div className="form-profil assessment-result">
          <div className="result-emoji">{nilai >= 70 ? "🌟" : "💪"}</div>
          <h2>{title} selesai!</h2>
          <strong>{nilai}/100</strong>
          <p>Jawaban benar: {benar} dari {questions.length} soal.</p>
          <button className="tombol-sekunder" onClick={() => { setNomor(0); setJawabanSiswa({}); setSelesai(false); localStorage.removeItem(type === "pretest" ? "nilaiPretest" : "nilaiPosttest"); }}>Kerjakan ulang</button>
        </div>
      )}
    </section>
  );
}

function Pretest() { return <Assessment type="pretest" questions={soalPretest} />; }
function Posttest() { return <Assessment type="posttest" questions={soalPosttest} />; }

function Evaluasi() {
  const nilaiPretest = localStorage.getItem("nilaiPretest");
  const nilaiPosttest = localStorage.getItem("nilaiPosttest");

  const nilaiLatihan = localStorage.getItem("nilaiLatihan");

  const pretest = nilaiPretest !== null ? Number(nilaiPretest) : null;
  const posttest = nilaiPosttest !== null ? Number(nilaiPosttest) : null;
  const latihan = nilaiLatihan !== null ? Number(nilaiLatihan) : null;

  const peningkatan =
    pretest !== null && posttest !== null
      ? posttest - pretest
      : null;

  return (
    <section className="halaman-kosong">
      <h1>Evaluasi Pembelajaran</h1>
      <p>Berikut adalah rekap hasil belajar kamu.</p>

      <div className="form-profil">
        <h2>Hasil Pretest</h2>
        <h2>{pretest !== null ? pretest : "Belum dikerjakan"}</h2>
      </div>

      <div className="form-profil">
        <h2>Hasil Posttest</h2>
        <h2>{posttest !== null ? posttest : "Belum dikerjakan"}</h2>
      </div>

      <div className="form-profil">
        <h2>Hasil Latihan Soal</h2>
        <h2>{latihan !== null ? latihan : "Belum dikerjakan"}</h2>
      </div>

      <div className="form-profil">
        <h2>Analisis Peningkatan</h2>

        {peningkatan !== null ? (
          <>
            <h2>
              {peningkatan > 0
                ? `Meningkat ${peningkatan} poin`
                : peningkatan < 0
                ? `Menurun ${Math.abs(peningkatan)} poin`
                : "Nilai tetap"}
            </h2>
            <p>
              Perbandingan nilai Posttest dengan Pretest.
            </p>
          </>
        ) : (
          <p>
            Selesaikan Pretest dan Posttest terlebih dahulu
            untuk melihat peningkatan hasil belajar.
          </p>
        )}
      </div>
    </section>
  );
}

function TutorRMT() {
  const [messages, setMessages] = usePersistentState("ruangpajak_percakapan_rmt", []);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const configured = Boolean(supabaseUrl && supabaseAnonKey);
  console.log("Status konfigurasi RMT:", {
  urlAda: Boolean(supabaseUrl),
  keyAda: Boolean(supabaseAnonKey),
});

  async function kirimPesan(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading || !configured) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);
    try {
      const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/rmt-tutor`, {
        method: "POST",
        headers: {
  "Content-Type": "application/json",
  apikey: supabaseAnonKey
},
          
        body: JSON.stringify({ messages: nextMessages.slice(-12) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Layanan tutor belum dapat digunakan.");
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages([...nextMessages, { role: "assistant", content: `Maaf, tutor belum dapat dihubungi. ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rmt-panel">
      <div className="rmt-heading"><span className="rmt-icon">🧩</span><div><p className="sapaan">PENDAMPING BELAJAR</p><h2>Tutor Matematika RMT</h2></div></div>
      <p className="rmt-intro">Tutor membimbing cara berpikirmu melalui tiga tahap: <strong>Input</strong> (memahami informasi), <strong>Elaboration</strong> (menghubungkan informasi dan memilih strategi), dan <strong>Output</strong> (menjelaskan hasil). Tutor tidak langsung memberikan jawaban akhir.</p>
      {!configured && <div className="rmt-notice">AI belum diaktifkan. Tambahkan <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> pada file <code>.env</code>, lalu deploy fungsi Supabase dan simpan <code>DEEPSEEK_API_KEY</code> sebagai secret di Supabase.</div>}
      <div className="rmt-chat" aria-live="polite">
        {messages.length === 0 ? <div className="rmt-empty">Mulai dengan menuliskan bagian soal pajak yang membuatmu bingung. Contoh: “Aku belum paham informasi apa yang harus dicari dari soal harga dan pajak.”</div> : messages.map((message, index) => <div className={`rmt-message ${message.role === "user" ? "from-student" : "from-tutor"}`} key={`${index}-${message.role}`}><strong>{message.role === "user" ? "Kamu" : "Tutor RMT"}</strong><p>{message.content}</p></div>)}
        {loading && <div className="rmt-loading">Tutor sedang menyiapkan pertanyaan pembimbing…</div>}
      </div>
      <form className="rmt-form" onSubmit={kirimPesan}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Tulis pemikiran atau kesulitanmu di sini…" rows={3} disabled={!configured || loading} />
        <div className="rmt-form-actions"><button type="button" className="tombol-sekunder" onClick={() => setMessages([])}>Hapus percakapan</button><button className="tombol-utama" type="submit" disabled={!configured || loading || !draft.trim()}>{loading ? "Mengirim…" : "Kirim ke tutor"}</button></div>
      </form>
    </section>
  );
}

function App() {
  const [halaman, setHalaman] = useState("Beranda");
    // Penyimpanan jawaban untuk setiap level kuis
  const [jawabanPerLevel, setJawabanPerLevel] = usePersistentState(
    "ruangpajak_jawaban_kuis_per_level",
    { 1: readSaved("ruangpajak_jawaban_kuis", {}) }
  );

  const [diperiksaPerLevel, setDiperiksaPerLevel] = usePersistentState(
    "ruangpajak_kuis_diperiksa_per_level",
    { 1: readSaved("ruangpajak_kuis_diperiksa", false) }
  );

  const [levelAktifKuis, setLevelAktifKuis] = usePersistentState(
    "ruangpajak_level_aktif_kuis",
    1
  );

  const [hasilKuisPerLevel, setHasilKuisPerLevel] = usePersistentState(
    "ruangpajak_hasil_kuis_per_level",
    {}
  );

  const jawabanKuis = jawabanPerLevel[levelAktifKuis] || {};
  const kuisDiperiksa = Boolean(diperiksaPerLevel[levelAktifKuis]);

  const setJawabanKuis = (updater) =>
    setJawabanPerLevel((prev) => ({
      ...prev,
      [levelAktifKuis]:
        typeof updater === "function"
          ? updater(prev[levelAktifKuis] || {})
          : updater,
    }));
 
  const [levelLatihan, setLevelLatihan] = usePersistentState("ruangpajak_level_latihan", 1);
  const [jawabanLatihan, setJawabanLatihan] = usePersistentState("ruangpajak_jawaban_latihan", {});
  const [hasilLatihan, setHasilLatihan] = usePersistentState("ruangpajak_hasil_latihan", {});
  const [pembahasanLatihan, setPembahasanLatihan] = usePersistentState("ruangpajak_pembahasan_latihan", []);
  const [fotoProfil, setFotoProfil] = usePersistentState("ruangpajak_foto_profil", "");
  const [namaSiswa, setNamaSiswa] = usePersistentState("ruangpajak_nama", "");
  const [genderSiswa, setGenderSiswa] = usePersistentState("ruangpajak_gender", "");
  const [sekolahSiswa, setSekolahSiswa] = usePersistentState("ruangpajak_sekolah", "");
  const [kelasSiswa, setKelasSiswa] = usePersistentState("ruangpajak_kelas", "");
  const [daerahSiswa, setDaerahSiswa] = usePersistentState("ruangpajak_daerah", "");
  const [musicOn, setMusicOn] = usePersistentState("ruangpajak_musik", false);
  useAmbientMusic(musicOn, halaman);

    useEffect(() => {
    const timeout = window.setTimeout(() => {
      syncLearningProgress({
        nilaiPretest: localStorage.getItem("nilaiPretest"),
        nilaiPosttest: localStorage.getItem("nilaiPosttest"),
        nilaiLatihan: localStorage.getItem("nilaiLatihan"),
        jawabanKuis: jawabanPerLevel,
        kuisDiperiksa: diperiksaPerLevel,
        hasilKuisPerLevel,
        levelAktifKuis,
        levelLatihan,
        jawabanLatihan,
        hasilLatihan,
      }).catch((error) =>
        console.warn("Sinkronisasi Supabase belum berhasil:", error)
      );
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [
    jawabanPerLevel,
    diperiksaPerLevel,
    hasilKuisPerLevel,
    levelAktifKuis,
    levelLatihan,
    jawabanLatihan,
    hasilLatihan,
  ]);

  const menu = [
    { nama: "Profil", ikon: "👤" },
    { nama: "Beranda", ikon: "🏠" },
    { nama: "Pretest", ikon: "📝" },
    { nama: "Materi", ikon: "📚" },
    { nama: "Latihan Soal", ikon: "🧠" },
    { nama: "Latihan", ikon: "✏️" },
    { nama: "Kuis", ikon: "🎯" },
    { nama: "Postest", ikon: "📋" },
    { nama: "Evaluasi", ikon: "📊" },
  ];

  const contohSoal = [
    {
      nomor: 1,
      kategori: "Perhitungan Dasar",
      tingkat: "Mudah",
      soal: "Ani menerima gaji sebesar Rp2.500.000,00. Jika persentase pajak yang dikenakan adalah 2,5%, berapakah besar pajak dan gaji bersih Ani?",
      diketahui: ["Gaji = Rp2.500.000,00", "Pajak = 2,5%"],
      ditanya: "Besar pajak dan gaji bersih Ani.",
      langkah: [
        "Ubah persentase menjadi desimal: 2,5% = 2,5 ÷ 100 = 0,025.",
        "Hitung pajak = 0,025 × Rp2.500.000,00 = Rp62.500,00.",
        "Gaji bersih = Rp2.500.000,00 − Rp62.500,00 = Rp2.437.500,00."
      ],
      jawaban: "Pajak = Rp62.500,00 dan gaji bersih = Rp2.437.500,00."
    },
    {
      nomor: 2,
      kategori: "Perhitungan Dasar",
      tingkat: "Mudah",
      soal: "Sebuah barang memiliki harga Rp800.000,00. Dalam soal ini, barang tersebut dikenakan pajak sebesar 5% dari harga barang. Berapakah pajaknya?",
      diketahui: ["Harga barang = Rp800.000,00", "Pajak = 5%"],
      ditanya: "Besar pajak.",
      langkah: [
        "Ubah 5% menjadi desimal: 5 ÷ 100 = 0,05.",
        "Pajak = 0,05 × Rp800.000,00.",
        "Pajak = Rp40.000,00."
      ],
      jawaban: "Besar pajak adalah Rp40.000,00."
    },
    {
      nomor: 3,
      kategori: "Perhitungan Dasar",
      tingkat: "Mudah",
      soal: "Harga sebuah barang adalah Rp1.200.000,00. Jika dikenakan pajak sebesar 10%, tentukan besar pajak dan harga setelah ditambah pajak.",
      diketahui: ["Harga barang = Rp1.200.000,00", "Pajak = 10%"],
      ditanya: "Besar pajak dan harga akhir.",
      langkah: [
        "10% = 10 ÷ 100 = 0,1.",
        "Pajak = 0,1 × Rp1.200.000,00 = Rp120.000,00.",
        "Harga akhir = Rp1.200.000,00 + Rp120.000,00 = Rp1.320.000,00."
      ],
      jawaban: "Pajak = Rp120.000,00 dan harga akhir = Rp1.320.000,00."
    },
    {
      nomor: 4,
      kategori: "Perhitungan Dasar",
      tingkat: "Sedang",
      soal: "Sebuah barang berharga Rp400.000,00 mendapat diskon 10%. Setelah diskon, barang dikenakan pajak sebesar 2,5%. Berapakah harga yang harus dibayar?",
      diketahui: ["Harga awal = Rp400.000,00", "Diskon = 10%", "Pajak = 2,5%"],
      ditanya: "Harga akhir setelah diskon dan pajak.",
      langkah: [
        "Diskon = 10% × Rp400.000,00 = Rp40.000,00.",
        "Harga setelah diskon = Rp400.000,00 − Rp40.000,00 = Rp360.000,00.",
        "Pajak = 2,5% × Rp360.000,00 = 0,025 × Rp360.000,00 = Rp9.000,00.",
        "Harga akhir = Rp360.000,00 + Rp9.000,00 = Rp369.000,00."
      ],
      jawaban: "Harga yang harus dibayar adalah Rp369.000,00."
    },
    {
      nomor: 5,
      kategori: "Perhitungan Dasar",
      tingkat: "Sedang",
      soal: "Seseorang memperoleh penghasilan sebesar Rp1.500.000,00. Jika penghasilan tersebut dikenakan pajak sebesar 4%, berapakah penghasilan setelah dipotong pajak?",
      diketahui: ["Penghasilan = Rp1.500.000,00", "Pajak = 4%"],
      ditanya: "Penghasilan bersih.",
      langkah: [
        "4% = 4 ÷ 100 = 0,04.",
        "Pajak = 0,04 × Rp1.500.000,00 = Rp60.000,00.",
        "Penghasilan bersih = Rp1.500.000,00 − Rp60.000,00 = Rp1.440.000,00."
      ],
      jawaban: "Penghasilan bersih adalah Rp1.440.000,00."
    },
    {
      nomor: 6,
      kategori: "Kehidupan Sehari-hari",
      tingkat: "Mudah",
      soal: "Rina membeli sepasang sepatu di sebuah toko dengan harga Rp250.000,00. Pada struk pembelian tercantum pajak sebesar 4% dari harga sepatu. Berapa pajak yang harus dibayar dan berapa total belanja Rina?",
      diketahui: ["Harga sepatu = Rp250.000,00", "Pajak = 4%"],
      ditanya: "Besar pajak dan total belanja.",
      langkah: [
        "4% = 4 ÷ 100 = 0,04.",
        "Pajak = 0,04 × Rp250.000,00 = Rp10.000,00.",
        "Total belanja = Rp250.000,00 + Rp10.000,00 = Rp260.000,00."
      ],
      jawaban: "Pajak = Rp10.000,00 dan total belanja = Rp260.000,00."
    },
    {
      nomor: 7,
      kategori: "Kehidupan Sehari-hari",
      tingkat: "Mudah",
      soal: "Ayah bekerja di sebuah perusahaan dan menerima gaji bulanan sebesar Rp3.200.000,00. Untuk latihan ini, anggap pajak penghasilannya sebesar 2,5%. Berapa uang yang diterima Ayah setelah dipotong pajak?",
      diketahui: ["Gaji = Rp3.200.000,00", "Pajak = 2,5%"],
      ditanya: "Gaji setelah dipotong pajak.",
      langkah: [
        "2,5% = 0,025.",
        "Pajak = 0,025 × Rp3.200.000,00 = Rp80.000,00.",
        "Gaji bersih = Rp3.200.000,00 − Rp80.000,00 = Rp3.120.000,00."
      ],
      jawaban: "Gaji bersih Ayah adalah Rp3.120.000,00."
    },
    {
      nomor: 8,
      kategori: "Belanja dan Diskon",
      tingkat: "Sedang",
      soal: "Doni membeli sebuah laptop seharga Rp5.500.000,00. Toko memberikan diskon 10%. Setelah diskon, harga laptop dikenakan pajak sebesar 2%. Berapa total uang yang harus disiapkan Doni?",
      diketahui: ["Harga laptop = Rp5.500.000,00", "Diskon = 10%", "Pajak = 2%"],
      ditanya: "Total harga setelah diskon dan pajak.",
      langkah: [
        "Diskon = 10% × Rp5.500.000,00 = Rp550.000,00.",
        "Harga setelah diskon = Rp5.500.000,00 − Rp550.000,00 = Rp4.950.000,00.",
        "Pajak = 2% × Rp4.950.000,00 = Rp99.000,00.",
        "Total = Rp4.950.000,00 + Rp99.000,00 = Rp5.049.000,00."
      ],
      jawaban: "Doni harus membayar Rp5.049.000,00."
    },
    {
      nomor: 9,
      kategori: "Belanja dan Pajak",
      tingkat: "Sedang",
      soal: "Salsa membeli beberapa buku pelajaran dengan total harga Rp180.000,00. Jika dalam soal ini dikenakan pajak sebesar 5%, berapakah jumlah uang yang harus dibayar Salsa?",
      diketahui: ["Harga buku = Rp180.000,00", "Pajak = 5%"],
      ditanya: "Total pembayaran.",
      langkah: [
        "5% = 0,05.",
        "Pajak = 0,05 × Rp180.000,00 = Rp9.000,00.",
        "Total pembayaran = Rp180.000,00 + Rp9.000,00 = Rp189.000,00."
      ],
      jawaban: "Salsa harus membayar Rp189.000,00."
    },
    {
      nomor: 10,
      kategori: "Belanja dan Pajak",
      tingkat: "Sedang",
      soal: "Ibu berbelanja kebutuhan rumah tangga dengan total harga Rp640.000,00. Dalam perhitungan latihan ini, dikenakan pajak sebesar 2,5%. Berapa besar pajak dan total pembayaran Ibu?",
      diketahui: ["Total belanja = Rp640.000,00", "Pajak = 2,5%"],
      ditanya: "Pajak dan total pembayaran.",
      langkah: [
        "2,5% = 0,025.",
        "Pajak = 0,025 × Rp640.000,00 = Rp16.000,00.",
        "Total pembayaran = Rp640.000,00 + Rp16.000,00 = Rp656.000,00."
      ],
      jawaban: "Pajak = Rp16.000,00 dan total pembayaran = Rp656.000,00."
    },
    {
      nomor: 11,
      kategori: "Usaha dan Perdagangan",
      tingkat: "Sedang",
      soal: "Seorang pemilik toko roti menerima pesanan 12 kotak roti. Harga setiap kotak adalah Rp35.000,00. Pesanan tersebut dikenakan pajak sebesar 5% dari seluruh harga roti. Berapa total pembayaran pelanggan?",
      diketahui: ["Jumlah kotak = 12", "Harga per kotak = Rp35.000,00", "Pajak = 5%"],
      ditanya: "Total pembayaran pelanggan.",
      langkah: [
        "Harga seluruh roti = 12 × Rp35.000,00 = Rp420.000,00.",
        "Pajak = 5% × Rp420.000,00 = 0,05 × Rp420.000,00 = Rp21.000,00.",
        "Total pembayaran = Rp420.000,00 + Rp21.000,00 = Rp441.000,00."
      ],
      jawaban: "Total pembayaran pelanggan adalah Rp441.000,00."
    },
    {
      nomor: 12,
      kategori: "Belanja dan Diskon",
      tingkat: "Sedang",
      soal: "Toko elektronik memberikan diskon 15% untuk sebuah telepon genggam seharga Rp2.400.000,00. Setelah diskon, harga tersebut dikenakan pajak sebesar 2,5%. Hitunglah total harga yang harus dibayar pembeli.",
      diketahui: ["Harga awal = Rp2.400.000,00", "Diskon = 15%", "Pajak = 2,5%"],
      ditanya: "Total harga setelah diskon dan pajak.",
      langkah: [
        "Diskon = 15% × Rp2.400.000,00 = Rp360.000,00.",
        "Harga setelah diskon = Rp2.400.000,00 − Rp360.000,00 = Rp2.040.000,00.",
        "Pajak = 2,5% × Rp2.040.000,00 = Rp51.000,00.",
        "Total harga = Rp2.040.000,00 + Rp51.000,00 = Rp2.091.000,00."
      ],
      jawaban: "Total harga yang dibayar adalah Rp2.091.000,00."
    },
    {
      nomor: 13,
      kategori: "Penghasilan",
      tingkat: "Sulit",
      soal: "Seorang pegawai memperoleh penghasilan selama satu tahun sebesar Rp48.000.000,00. Untuk latihan ini, diasumsikan pajak sebesar 5% dari seluruh penghasilan tersebut. Berapa pajak yang harus dibayar dan berapa sisa penghasilannya setelah dipotong pajak?",
      diketahui: ["Penghasilan setahun = Rp48.000.000,00", "Pajak = 5%"],
      ditanya: "Pajak dan penghasilan setelah dipotong pajak.",
      langkah: [
        "5% = 0,05.",
        "Pajak = 0,05 × Rp48.000.000,00 = Rp2.400.000,00.",
        "Sisa penghasilan = Rp48.000.000,00 − Rp2.400.000,00 = Rp45.600.000,00."
      ],
      jawaban: "Pajak = Rp2.400.000,00 dan sisa penghasilan = Rp45.600.000,00."
    },
    {
      nomor: 14,
      kategori: "Belanja dan Perdagangan",
      tingkat: "Sulit",
      soal: "Pak Budi membeli tiga barang di sebuah toko. Harga barang pertama Rp125.000,00, barang kedua Rp85.000,00, dan barang ketiga Rp90.000,00. Seluruh pembelian dikenakan pajak sebesar 4%. Berapa total yang harus dibayar Pak Budi?",
      diketahui: ["Barang pertama = Rp125.000,00", "Barang kedua = Rp85.000,00", "Barang ketiga = Rp90.000,00", "Pajak = 4%"],
      ditanya: "Total pembayaran.",
      langkah: [
        "Jumlah harga barang = Rp125.000,00 + Rp85.000,00 + Rp90.000,00 = Rp300.000,00.",
        "Pajak = 4% × Rp300.000,00 = Rp12.000,00.",
        "Total pembayaran = Rp300.000,00 + Rp12.000,00 = Rp312.000,00."
      ],
      jawaban: "Pak Budi harus membayar Rp312.000,00."
    },
    {
      nomor: 15,
      kategori: "Belanja dan Diskon",
      tingkat: "Sulit",
      soal: "Sebuah jaket memiliki harga awal Rp480.000,00. Saat promosi, toko memberikan diskon 25%. Setelah diskon, harga jaket dikenakan pajak sebesar 5%. Berapakah harga akhir jaket?",
      diketahui: ["Harga awal = Rp480.000,00", "Diskon = 25%", "Pajak = 5%"],
      ditanya: "Harga akhir jaket.",
      langkah: [
        "Diskon = 25% × Rp480.000,00 = Rp120.000,00.",
        "Harga setelah diskon = Rp480.000,00 − Rp120.000,00 = Rp360.000,00.",
        "Pajak = 5% × Rp360.000,00 = Rp18.000,00.",
        "Harga akhir = Rp360.000,00 + Rp18.000,00 = Rp378.000,00."
      ],
      jawaban: "Harga akhir jaket adalah Rp378.000,00."
    },
    {
      nomor: 16,
      kategori: "Transportasi",
      tingkat: "Sulit",
      soal: "Sebuah keluarga membeli 4 tiket perjalanan. Harga satu tiket adalah Rp75.000,00. Seluruh tiket dikenakan pajak sebesar 2%. Berapa jumlah pembayaran untuk keempat tiket tersebut?",
      diketahui: ["Jumlah tiket = 4", "Harga satu tiket = Rp75.000,00", "Pajak = 2%"],
      ditanya: "Jumlah pembayaran seluruh tiket.",
      langkah: [
        "Harga empat tiket = 4 × Rp75.000,00 = Rp300.000,00.",
        "Pajak = 2% × Rp300.000,00 = Rp6.000,00.",
        "Total pembayaran = Rp300.000,00 + Rp6.000,00 = Rp306.000,00."
      ],
      jawaban: "Jumlah pembayaran adalah Rp306.000,00."
    },
    {
      nomor: 17,
      kategori: "Kebutuhan Sekolah",
      tingkat: "Sulit",
      soal: "Sebuah toko alat tulis menerima pesanan 5 paket perlengkapan sekolah. Harga setiap paket adalah Rp42.000,00. Pesanan tersebut dikenakan pajak sebesar 3%. Berapa total harga yang harus dibayar?",
      diketahui: ["Jumlah paket = 5", "Harga satu paket = Rp42.000,00", "Pajak = 3%"],
      ditanya: "Total harga pesanan.",
      langkah: [
        "Harga seluruh paket = 5 × Rp42.000,00 = Rp210.000,00.",
        "Pajak = 3% × Rp210.000,00 = Rp6.300,00.",
        "Total harga = Rp210.000,00 + Rp6.300,00 = Rp216.300,00."
      ],
      jawaban: "Total harga pesanan adalah Rp216.300,00."
    },
    {
      nomor: 18,
      kategori: "Penghasilan",
      tingkat: "Sulit",
      soal: "Seorang pekerja memperoleh penghasilan Rp4.800.000,00 setiap bulan. Dalam soal ini, pajak diasumsikan sebesar 2,5% dari penghasilan bulanan. Hitunglah pajak selama satu bulan dan jumlah penghasilan bersih selama 3 bulan jika gaji dan persentase pajak tetap.",
      diketahui: ["Gaji per bulan = Rp4.800.000,00", "Pajak = 2,5%", "Waktu = 3 bulan"],
      ditanya: "Pajak sebulan dan penghasilan bersih selama 3 bulan.",
      langkah: [
        "Pajak sebulan = 2,5% × Rp4.800.000,00 = Rp120.000,00.",
        "Gaji bersih sebulan = Rp4.800.000,00 − Rp120.000,00 = Rp4.680.000,00.",
        "Penghasilan bersih 3 bulan = 3 × Rp4.680.000,00 = Rp14.040.000,00."
      ],
      jawaban: "Pajak sebulan = Rp120.000,00 dan penghasilan bersih 3 bulan = Rp14.040.000,00."
    },
    {
      nomor: 19,
      kategori: "Belanja dan Diskon",
      tingkat: "Sulit",
      soal: "Sebuah toko furnitur menjual meja seharga Rp2.800.000,00. Pembeli mendapat diskon 12,5%. Setelah diskon, harga meja dikenakan pajak sebesar 4%. Hitunglah besar diskon, besar pajak, dan harga akhir meja.",
      diketahui: ["Harga meja = Rp2.800.000,00", "Diskon = 12,5%", "Pajak = 4%"],
      ditanya: "Diskon, pajak, dan harga akhir.",
      langkah: [
        "Diskon = 12,5% × Rp2.800.000,00 = Rp350.000,00.",
        "Harga setelah diskon = Rp2.800.000,00 − Rp350.000,00 = Rp2.450.000,00.",
        "Pajak = 4% × Rp2.450.000,00 = Rp98.000,00.",
        "Harga akhir = Rp2.450.000,00 + Rp98.000,00 = Rp2.548.000,00."
      ],
      jawaban: "Diskon = Rp350.000,00, pajak = Rp98.000,00, dan harga akhir = Rp2.548.000,00."
    },
    {
      nomor: 20,
      kategori: "Belanja dan Perhitungan Gabungan",
      tingkat: "Sulit",
      soal: "Dina membeli perlengkapan rumah tangga dengan total harga sebelum pajak Rp3.600.000,00. Dalam soal ini, pajak ditetapkan sebesar 5%. Dina membayar menggunakan uang Rp4.000.000,00. Berapakah pajak, total belanja setelah pajak, dan uang kembalian Dina?",
      diketahui: ["Harga belanja = Rp3.600.000,00", "Pajak = 5%", "Uang dibayarkan = Rp4.000.000,00"],
      ditanya: "Pajak, total belanja, dan uang kembalian.",
      langkah: [
        "Pajak = 5% × Rp3.600.000,00 = Rp180.000,00.",
        "Total belanja = Rp3.600.000,00 + Rp180.000,00 = Rp3.780.000,00.",
        "Uang kembalian = Rp4.000.000,00 − Rp3.780.000,00 = Rp220.000,00."
      ],
      jawaban: "Pajak = Rp180.000,00, total belanja = Rp3.780.000,00, dan kembalian = Rp220.000,00."
    }
  ];
  const bankKuis = {
  1: [
    {
      soal: "Rina membeli tas seharga Rp200.000,00. Dalam soal ini, tas dikenakan pajak sebesar 5%. Berapakah besar pajaknya?",
      pilihan: ["Rp5.000,00", "Rp10.000,00", "Rp15.000,00", "Rp20.000,00"],
      benar: 1,
      bahas: "Pajak = 5% × Rp200.000,00 = 0,05 × Rp200.000,00 = Rp10.000,00."
    },
    {
      soal: "Ayah memperoleh gaji Rp3.000.000,00. Jika pajak dalam soal ini sebesar 2%, berapakah besar pajaknya?",
      pilihan: ["Rp30.000,00", "Rp50.000,00", "Rp60.000,00", "Rp90.000,00"],
      benar: 2,
      bahas: "Pajak = 2% × Rp3.000.000,00 = 0,02 × Rp3.000.000,00 = Rp60.000,00."
    },
    {
      soal: "Sebuah barang berharga Rp500.000,00 dikenakan pajak 4%. Berapakah harga barang setelah ditambah pajak?",
      pilihan: ["Rp504.000,00", "Rp510.000,00", "Rp520.000,00", "Rp540.000,00"],
      benar: 2,
      bahas: "Pajak = 4% × Rp500.000,00 = Rp20.000,00. Harga akhir = Rp500.000,00 + Rp20.000,00 = Rp520.000,00."
    },
    {
      soal: "Bentuk desimal dari 5% adalah ...",
      pilihan: ["0,5", "0,05", "0,005", "5,0"],
      benar: 1,
      bahas: "Persentase diubah menjadi desimal dengan membagi 100. Jadi, 5% = 5 ÷ 100 = 0,05."
    },
    {
      soal: "Sebuah barang seharga Rp400.000,00 mendapat diskon 10%. Berapakah besar diskonnya?",
      pilihan: ["Rp20.000,00", "Rp30.000,00", "Rp40.000,00", "Rp50.000,00"],
      benar: 2,
      bahas: "Diskon = 10% × Rp400.000,00 = 0,1 × Rp400.000,00 = Rp40.000,00."
    },
    {
      soal: "Harga sebuah barang adalah Rp800.000,00. Barang tersebut dikenakan pajak 5%. Berapakah jumlah pajaknya?",
      pilihan: ["Rp20.000,00", "Rp30.000,00", "Rp40.000,00", "Rp50.000,00"],
      benar: 2,
      bahas: "Pajak = 5% × Rp800.000,00 = 0,05 × Rp800.000,00 = Rp40.000,00."
    },
    {
      soal: "Gaji seorang pegawai Rp2.000.000,00. Setelah dipotong pajak Rp50.000,00, berapakah gaji bersihnya?",
      pilihan: ["Rp1.900.000,00", "Rp1.950.000,00", "Rp2.050.000,00", "Rp2.100.000,00"],
      benar: 1,
      bahas: "Gaji bersih = gaji awal − pajak = Rp2.000.000,00 − Rp50.000,00 = Rp1.950.000,00."
    },
    {
      soal: "Harga sebuah barang Rp600.000,00. Jika pajaknya 10%, berapakah harga setelah pajak?",
      pilihan: ["Rp610.000,00", "Rp630.000,00", "Rp660.000,00", "Rp700.000,00"],
      benar: 2,
      bahas: "Pajak = 10% × Rp600.000,00 = Rp60.000,00. Harga akhir = Rp600.000,00 + Rp60.000,00 = Rp660.000,00."
    },
    {
      soal: "Sebuah barang berharga Rp300.000,00 mendapat diskon 20%. Berapakah harga setelah diskon?",
      pilihan: ["Rp220.000,00", "Rp230.000,00", "Rp240.000,00", "Rp260.000,00"],
      benar: 2,
      bahas: "Diskon = 20% × Rp300.000,00 = Rp60.000,00. Harga setelah diskon = Rp300.000,00 − Rp60.000,00 = Rp240.000,00."
    },
    {
      soal: "Sebuah barang seharga Rp1.000.000,00 dikenakan pajak 3%. Berapakah total harga yang harus dibayar?",
      pilihan: ["Rp1.003.000,00", "Rp1.020.000,00", "Rp1.030.000,00", "Rp1.300.000,00"],
      benar: 2,
      bahas: "Pajak = 3% × Rp1.000.000,00 = Rp30.000,00. Total = Rp1.000.000,00 + Rp30.000,00 = Rp1.030.000,00."
        }
  ],
  2: [
    { soal: "Harga sebuah jaket Rp250.000,00 dikenakan pajak 8%. Berapa pajaknya?", pilihan: ["Rp10.000,00", "Rp15.000,00", "Rp20.000,00", "Rp25.000,00"], benar: 2, bahas: "8% × Rp250.000,00 = Rp20.000,00." },
    { soal: "Harga makanan Rp80.000,00 dan pajak 10%. Berapa total yang dibayar?", pilihan: ["Rp82.000,00", "Rp88.000,00", "Rp90.000,00", "Rp98.000,00"], benar: 1, bahas: "Pajak = Rp8.000,00. Total = Rp88.000,00." },
    { soal: "Pajak 5% dari Rp360.000,00 adalah ...", pilihan: ["Rp16.000,00", "Rp18.000,00", "Rp20.000,00", "Rp36.000,00"], benar: 1, bahas: "0,05 × Rp360.000,00 = Rp18.000,00." },
    { soal: "Harga barang setelah pajak 10% adalah Rp220.000,00. Harga sebelum pajak ialah ...", pilihan: ["Rp180.000,00", "Rp190.000,00", "Rp200.000,00", "Rp210.000,00"], benar: 2, bahas: "Rp220.000,00 ÷ 1,10 = Rp200.000,00." },
    { soal: "Tiket Rp150.000,00 dikenakan pajak 6%. Berapa harga akhirnya?", pilihan: ["Rp156.000,00", "Rp159.000,00", "Rp160.000,00", "Rp165.000,00"], benar: 1, bahas: "Pajak = Rp9.000,00. Harga akhir = Rp159.000,00." },
    { soal: "Pajak dari transaksi Rp1.200.000,00 dengan tarif 2,5% adalah ...", pilihan: ["Rp20.000,00", "Rp25.000,00", "Rp30.000,00", "Rp35.000,00"], benar: 2, bahas: "2,5% × Rp1.200.000,00 = Rp30.000,00." },
    { soal: "Total pembayaran Rp330.000,00 sudah termasuk pajak 10%. Berapa pajaknya?", pilihan: ["Rp20.000,00", "Rp25.000,00", "Rp30.000,00", "Rp33.000,00"], benar: 2, bahas: "Harga awal Rp300.000,00. Pajak = Rp30.000,00." },
    { soal: "Harga awal Rp450.000,00, pajak 4%. Total pembayaran adalah ...", pilihan: ["Rp454.000,00", "Rp468.000,00", "Rp470.000,00", "Rp486.000,00"], benar: 1, bahas: "Pajak = Rp18.000,00. Total = Rp468.000,00." },
    { soal: "Pajak Rp12.000,00 dikenakan pada harga Rp300.000,00. Tarif pajaknya ...", pilihan: ["2%", "3%", "4%", "5%"], benar: 2, bahas: "Rp12.000,00 ÷ Rp300.000,00 × 100% = 4%." },
    { soal: "Harga setelah pajak 5% adalah Rp525.000,00. Harga awalnya ...", pilihan: ["Rp475.000,00", "Rp490.000,00", "Rp500.000,00", "Rp505.000,00"], benar: 2, bahas: "Rp525.000,00 ÷ 1,05 = Rp500.000,00." }
  ],
  3: [
    { soal: "Baju Rp200.000,00 mendapat diskon 20%, lalu pajak 5% dari harga setelah diskon. Totalnya ...", pilihan: ["Rp160.000,00", "Rp168.000,00", "Rp170.000,00", "Rp180.000,00"], benar: 1, bahas: "Harga setelah diskon Rp160.000,00. Pajak Rp8.000,00. Total Rp168.000,00." },
    { soal: "Sepatu Rp300.000,00 didiskon 10%. Berapa harga setelah diskon?", pilihan: ["Rp260.000,00", "Rp270.000,00", "Rp280.000,00", "Rp290.000,00"], benar: 1, bahas: "Diskon Rp30.000,00. Harga menjadi Rp270.000,00." },
    { soal: "Barang Rp500.000,00 didiskon 20%, kemudian dikenai pajak 10%. Totalnya ...", pilihan: ["Rp400.000,00", "Rp420.000,00", "Rp440.000,00", "Rp450.000,00"], benar: 2, bahas: "Harga setelah diskon Rp400.000,00. Pajak Rp40.000,00. Total Rp440.000,00." },
    { soal: "Harga tas Rp150.000,00 mendapat diskon Rp15.000,00. Persentase diskonnya ...", pilihan: ["5%", "10%", "15%", "20%"], benar: 1, bahas: "Rp15.000,00 ÷ Rp150.000,00 × 100% = 10%." },
    { soal: "Harga Rp250.000,00 didiskon 12%. Besar diskonnya ...", pilihan: ["Rp25.000,00", "Rp30.000,00", "Rp32.000,00", "Rp35.000,00"], benar: 1, bahas: "12% × Rp250.000,00 = Rp30.000,00." },
    { soal: "Barang Rp400.000,00 didiskon 25%, lalu pajak 2%. Berapa total?", pilihan: ["Rp300.000,00", "Rp306.000,00", "Rp310.000,00", "Rp320.000,00"], benar: 1, bahas: "Harga setelah diskon Rp300.000,00. Pajak Rp6.000,00. Total Rp306.000,00." },
    { soal: "Harga awal Rp100.000,00 menjadi Rp85.000,00 setelah diskon. Diskonnya ...", pilihan: ["10%", "12%", "15%", "20%"], benar: 2, bahas: "Diskon Rp15.000,00 atau 15%." },
    { soal: "Harga Rp600.000,00 dikenai pajak 5% setelah diskon 10%. Totalnya ...", pilihan: ["Rp567.000,00", "Rp570.000,00", "Rp585.000,00", "Rp630.000,00"], benar: 0, bahas: "Harga setelah diskon Rp540.000,00. Pajak Rp27.000,00. Total Rp567.000,00." },
    { soal: "Sebuah barang Rp80.000,00 mendapat diskon 5%. Harga setelah diskon ...", pilihan: ["Rp74.000,00", "Rp75.000,00", "Rp76.000,00", "Rp78.000,00"], benar: 2, bahas: "Diskon Rp4.000,00. Harga setelah diskon Rp76.000,00." },
    { soal: "Harga Rp200.000,00 didiskon 10%, kemudian pajak 10%. Total pembayaran ...", pilihan: ["Rp180.000,00", "Rp198.000,00", "Rp200.000,00", "Rp220.000,00"], benar: 1, bahas: "Harga setelah diskon Rp180.000,00. Pajak Rp18.000,00. Total Rp198.000,00." }
  ],
  4: [
    { soal: "Toko A menjual barang Rp200.000,00 dengan pajak 5%. Toko B Rp195.000,00 dengan pajak 8%. Mana total yang lebih murah?", pilihan: ["Rp210.000,00 (Toko A)", "Rp210.600,00 (Toko B)", "Rp215.000,00 (Toko A)", "Rp216.000,00 (Toko B)"], benar: 0, bahas: "A = Rp210.000,00. B = Rp210.600,00. Toko A lebih murah." },
    { soal: "Dua barang masing-masing Rp100.000,00 dan Rp150.000,00 dikenai pajak 4%. Total pajaknya ...", pilihan: ["Rp8.000,00", "Rp10.000,00", "Rp12.000,00", "Rp15.000,00"], benar: 1, bahas: "Total harga Rp250.000,00. Pajak 4% = Rp10.000,00." },
    { soal: "Tagihan Rp500.000,00 dikenai pajak 6%. Jika membayar Rp550.000,00, kembaliannya ...", pilihan: ["Rp10.000,00", "Rp15.000,00", "Rp20.000,00", "Rp25.000,00"], benar: 2, bahas: "Total tagihan Rp530.000,00. Kembalian Rp20.000,00." },
    { soal: "Tarif pajak naik dari 5% menjadi 8% pada harga Rp400.000,00. Selisih pajak ...", pilihan: ["Rp8.000,00", "Rp10.000,00", "Rp12.000,00", "Rp20.000,00"], benar: 2, bahas: "Selisih tarif 3%. 3% × Rp400.000,00 = Rp12.000,00." },
    { soal: "Pembelian Rp750.000,00 dibagi rata oleh 3 orang. Pajak total 4% dibagi rata juga. Pajak per orang ...", pilihan: ["Rp8.000,00", "Rp10.000,00", "Rp12.000,00", "Rp15.000,00"], benar: 1, bahas: "Pajak total Rp30.000,00. Per orang Rp10.000,00." },
    { soal: "Harga barang Rp320.000,00. Pajak 5% dan biaya layanan tetap Rp5.000,00. Totalnya ...", pilihan: ["Rp336.000,00", "Rp341.000,00", "Rp345.000,00", "Rp350.000,00"], benar: 1, bahas: "Pajak Rp16.000,00. Total Rp341.000,00." },
    { soal: "Toko memberi pilihan: harga Rp180.000,00 tanpa pajak tambahan atau Rp170.000,00 ditambah pajak 6%. Pilihan lebih murah ...", pilihan: ["Pilihan pertama", "Pilihan kedua", "Sama", "Tidak dapat ditentukan"], benar: 0, bahas: "Pilihan kedua Rp180.200,00. Pilihan pertama Rp180.000,00, jadi lebih murah." },
    { soal: "Pajak 2% dari pembelian Rp1.500.000,00 dibayar bersama uang Rp1.600.000,00. Kembalian ...", pilihan: ["Rp50.000,00", "Rp60.000,00", "Rp70.000,00", "Rp80.000,00"], benar: 2, bahas: "Pajak Rp30.000,00. Total Rp1.530.000,00. Kembalian Rp70.000,00." },
    { soal: "Harga sebelum pajak Rp240.000,00 dan setelah pajak Rp252.000,00. Tarif pajak ...", pilihan: ["3%", "4%", "5%", "6%"], benar: 2, bahas: "Pajak Rp12.000,00. Tarif = 5%." },
    { soal: "Toko A: Rp400.000,00 + pajak 5%. Toko B: Rp410.000,00 tanpa pajak tambahan. Selisih total harga ...", pilihan: ["Rp5.000,00", "Rp10.000,00", "Rp15.000,00", "Rp20.000,00"], benar: 1, bahas: "A = Rp420.000,00 dan B = Rp410.000,00. Selisih Rp10.000,00." }
  ],
  5: [
    { soal: "Sebuah keluarga membayar tagihan Rp660.000,00 termasuk pajak 10%. Berapa harga sebelum pajak?", pilihan: ["Rp550.000,00", "Rp580.000,00", "Rp600.000,00", "Rp620.000,00"], benar: 2, bahas: "Rp660.000,00 ÷ 1,1 = Rp600.000,00." },
    { soal: "Toko A menjual barang Rp250.000,00 dengan diskon 10% lalu pajak 5%. Toko B menjual barang Rp240.000,00 dengan pajak 5%. Berapa harga akhir masing-masing?", pilihan: ["A Rp236.250,00 dan B Rp252.000,00", "A Rp240.000,00 dan B Rp250.000,00", "A Rp252.000,00 dan B Rp236.250,00", "A Rp225.000,00 dan B Rp240.000,00"], benar: 0, bahas: "A: Rp250.000,00 × 90% × 1,05 = Rp236.250,00. B: Rp240.000,00 × 1,05 = Rp252.000,00." },
    { soal: "Pajak sebuah transaksi Rp24.000,00 dengan tarif 6%. Nilai transaksi sebelum pajak ...", pilihan: ["Rp300.000,00", "Rp350.000,00", "Rp400.000,00", "Rp450.000,00"], benar: 2, bahas: "Rp24.000,00 ÷ 0,06 = Rp400.000,00." },
    { soal: "Harga barang naik dari Rp500.000,00 menjadi Rp540.000,00 karena pajak. Tarif pajaknya ...", pilihan: ["6%", "7%", "8%", "9%"], benar: 2, bahas: "Pajak Rp40.000,00. Tarif = 8%." },
    { soal: "Seseorang membeli 2 barang masing-masing Rp125.000,00. Pajak 8% dikenakan pada total harga. Total pembayaran ...", pilihan: ["Rp250.000,00", "Rp260.000,00", "Rp270.000,00", "Rp280.000,00"], benar: 2, bahas: "Total awal Rp250.000,00. Pajak Rp20.000,00. Total Rp270.000,00." },
    { soal: "Harga Rp800.000,00 mendapat diskon 15%, lalu pajak 10%. Total akhir ...", pilihan: ["Rp720.000,00", "Rp748.000,00", "Rp752.000,00", "Rp760.000,00"], benar: 1, bahas: "Setelah diskon Rp680.000,00. Pajak Rp68.000,00. Total Rp748.000,00." },
    { soal: "Anggaran belanja Rp500.000,00. Barang seharga Rp460.000,00 dikenai pajak 8%. Apakah cukup?", pilihan: ["Cukup, sisa Rp3.200,00", "Tidak, kurang Rp3.200,00", "Cukup, sisa Rp40.000,00", "Tidak, kurang Rp36.800,00"], benar: 0, bahas: "Total Rp496.800,00. Sisa anggaran Rp3.200,00." },
    { soal: "Tagihan Rp1.050.000,00 sudah termasuk pajak 5%. Besar pajaknya ...", pilihan: ["Rp45.000,00", "Rp50.000,00", "Rp55.000,00", "Rp60.000,00"], benar: 1, bahas: "Harga awal Rp1.000.000,00. Pajak Rp50.000,00." },
    { soal: "Toko memberi diskon 20% pada harga Rp350.000,00. Setelah itu pajak 4%. Total yang dibayar ...", pilihan: ["Rp280.000,00", "Rp291.200,00", "Rp294.000,00", "Rp300.000,00"], benar: 1, bahas: "Harga setelah diskon Rp280.000,00. Pajak Rp11.200,00. Total Rp291.200,00." },
    { soal: "Dua toko menawarkan barang sama. A Rp600.000,00 termasuk pajak. B Rp570.000,00 belum termasuk pajak 6%. Kesimpulan ...", pilihan: ["A lebih murah Rp4.200,00", "B lebih murah Rp4.200,00", "A lebih murah Rp30.000,00", "Harganya sama"], benar: 0, bahas: "B setelah pajak Rp604.200,00. A lebih murah Rp4.200,00." }
  ]
};

const bankLatihan = {
  1: [
    {
      nomor: 1,
      tingkat: "Mudah",
      soal: "Dina membeli sebuah buku seharga Rp50.000,00. Dalam soal ini, buku tersebut dikenakan pajak sebesar 2%. Berapakah besar pajak yang harus dibayar Dina?",
      petunjuk: "Ubah persentase menjadi desimal, kemudian kalikan dengan harga buku.",
      jawaban: "1000",
      langkah: [
        "Diketahui: Harga buku = Rp50.000,00 dan pajak = 2%.",
        "Ubah 2% menjadi desimal: 2 ÷ 100 = 0,02.",
        "Pajak = 0,02 × Rp50.000,00.",
        "Pajak = Rp1.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Mudah",
      soal: "Rudi membeli sepatu dengan harga Rp200.000,00. Jika sepatu tersebut dikenakan pajak sebesar 5%, berapakah jumlah pajak yang harus dibayar Rudi?",
      petunjuk: "Gunakan rumus pajak = persentase pajak × harga barang.",
      jawaban: "10000",
      langkah: [
        "Diketahui: Harga sepatu = Rp200.000,00 dan pajak = 5%.",
        "Ubah 5% menjadi desimal: 5 ÷ 100 = 0,05.",
        "Pajak = 0,05 × Rp200.000,00.",
        "Pajak = Rp10.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Mudah",
      soal: "Ibu membeli peralatan dapur seharga Rp150.000,00. Dalam soal ini, pajak yang dikenakan adalah 4%. Hitunglah total uang yang harus dibayarkan Ibu setelah ditambah pajak.",
      petunjuk: "Hitung pajaknya terlebih dahulu, kemudian tambahkan ke harga awal.",
      jawaban: "156000",
      langkah: [
        "Diketahui: Harga barang = Rp150.000,00 dan pajak = 4%.",
        "Pajak = 4 ÷ 100 × Rp150.000,00.",
        "Pajak = Rp6.000,00.",
        "Total pembayaran = Rp150.000,00 + Rp6.000,00.",
        "Total pembayaran = Rp156.000,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Mudah",
      soal: "Andi mendapatkan uang sebesar Rp1.500.000,00. Dalam suatu perhitungan, uang tersebut dikenakan potongan pajak sebesar 2%. Berapakah uang yang diterima Andi setelah dipotong pajak?",
      petunjuk: "Hitung potongan pajak, kemudian kurangkan dari uang awal.",
      jawaban: "1470000",
      langkah: [
        "Diketahui: Uang awal = Rp1.500.000,00 dan pajak = 2%.",
        "Pajak = 0,02 × Rp1.500.000,00.",
        "Pajak = Rp30.000,00.",
        "Uang bersih = Rp1.500.000,00 − Rp30.000,00.",
        "Uang bersih = Rp1.470.000,00."
      ]
    },
    {
      nomor: 5,
      tingkat: "Mudah",
      soal: "Sebuah tas dijual dengan harga Rp250.000,00. Toko mengenakan pajak sebesar 10% dalam soal ini. Jika Siska membeli tas tersebut, berapakah total harga yang harus dibayarnya?",
      petunjuk: "Ingat bahwa total harga merupakan harga awal ditambah pajak.",
      jawaban: "275000",
      langkah: [
        "Diketahui: Harga tas = Rp250.000,00 dan pajak = 10%.",
        "Pajak = 0,10 × Rp250.000,00.",
        "Pajak = Rp25.000,00.",
        "Total harga = Rp250.000,00 + Rp25.000,00.",
        "Total harga = Rp275.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Mudah",
      soal: "Budi membeli alat tulis seharga Rp80.000,00. Ia harus membayar pajak sebesar 5%. Budi membayar menggunakan uang Rp100.000,00. Berapakah uang kembalian yang diterima Budi?",
      petunjuk: "Hitung pajak, total pembayaran, lalu kurangi dari uang Budi.",
      jawaban: "16000",
      langkah: [
        "Diketahui: Harga alat tulis = Rp80.000,00, pajak = 5%, uang Budi = Rp100.000,00.",
        "Pajak = 0,05 × Rp80.000,00 = Rp4.000,00.",
        "Total pembayaran = Rp80.000,00 + Rp4.000,00 = Rp84.000,00.",
        "Kembalian = Rp100.000,00 − Rp84.000,00.",
        "Kembalian = Rp16.000,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Mudah",
      soal: "Pak Dedi memperoleh penghasilan sebesar Rp2.500.000,00. Untuk latihan ini, diasumsikan terdapat potongan pajak sebesar 3% dari penghasilannya. Berapakah besar pajak dan penghasilan bersih Pak Dedi?",
      petunjuk: "Hitung 3% dari penghasilan, kemudian kurangkan hasilnya.",
      jawaban: "2425000",
      langkah: [
        "Diketahui: Penghasilan = Rp2.500.000,00 dan pajak = 3%.",
        "Pajak = 0,03 × Rp2.500.000,00.",
        "Pajak = Rp75.000,00.",
        "Penghasilan bersih = Rp2.500.000,00 − Rp75.000,00.",
        "Penghasilan bersih = Rp2.425.000,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Mudah",
      soal: "Sebuah keluarga membeli kebutuhan rumah tangga seharga Rp600.000,00. Dalam soal ini dikenakan pajak sebesar 5%. Berapakah total pembayaran setelah pajak?",
      petunjuk: "Hitung pajak terlebih dahulu, kemudian tambahkan ke harga awal.",
      jawaban: "630000",
      langkah: [
        "Diketahui: Harga belanja = Rp600.000,00 dan pajak = 5%.",
        "Pajak = 0,05 × Rp600.000,00 = Rp30.000,00.",
        "Total pembayaran = Rp600.000,00 + Rp30.000,00 = Rp630.000,00."
      ]
    }
  ],
    2: [
    {
      nomor: 1,
      tingkat: "Sedang",
      soal: "Sebuah jaket seharga Rp400.000,00 mendapat diskon 15%. Setelah diskon, dikenakan pajak 5%. Berapa total harga yang harus dibayar?",
      petunjuk: "Hitung harga setelah diskon, lalu tambahkan pajak.",
      jawaban: "357000",
      langkah: [
        "Diketahui: Harga awal = Rp400.000,00, diskon = 15%, pajak = 5%.",
        "Diskon = 15% × Rp400.000,00 = Rp60.000,00.",
        "Harga setelah diskon = Rp400.000,00 − Rp60.000,00 = Rp340.000,00.",
        "Pajak = 5% × Rp340.000,00 = Rp17.000,00.",
        "Total pembayaran = Rp340.000,00 + Rp17.000,00 = Rp357.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Sedang",
      soal: "Sebuah televisi berharga Rp2.500.000,00 dikenakan pajak 4%. Berapa harga televisi setelah pajak?",
      petunjuk: "Tambahkan pajak ke harga awal.",
      jawaban: "2600000",
      langkah: [
        "Pajak = 4% × Rp2.500.000,00 = Rp100.000,00.",
        "Harga akhir = Rp2.500.000,00 + Rp100.000,00.",
        "Jadi, harga akhir = Rp2.600.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Sedang",
      soal: "Pak Andi memperoleh gaji Rp4.000.000,00. Jika dipotong pajak 3%, berapa gaji bersihnya?",
      petunjuk: "Kurangi gaji awal dengan pajak.",
      jawaban: "3880000",
      langkah: [
        "Pajak = 3% × Rp4.000.000,00 = Rp120.000,00.",
        "Gaji bersih = Rp4.000.000,00 − Rp120.000,00.",
        "Jadi, gaji bersih = Rp3.880.000,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Sedang",
      soal: "Sebuah meja seharga Rp800.000,00 mendapat diskon 20%. Berapa harga meja setelah diskon?",
      petunjuk: "Hitung besar diskon, lalu kurangkan dari harga awal.",
      jawaban: "640000",
      langkah: [
        "Diskon = 20% × Rp800.000,00 = Rp160.000,00.",
        "Harga setelah diskon = Rp800.000,00 − Rp160.000,00.",
        "Jadi, harga meja = Rp640.000,00."
      ]
    },
    {
      nomor: 5,
      tingkat: "Sedang",
      soal: "Sebuah toko menjual 3 tas dengan harga masing-masing Rp150.000,00. Seluruh pembelian dikenakan pajak 4%. Berapa total pembayaran?",
      petunjuk: "Hitung harga seluruh tas terlebih dahulu.",
      jawaban: "468000",
      langkah: [
        "Harga seluruh tas = 3 × Rp150.000,00 = Rp450.000,00.",
        "Pajak = 4% × Rp450.000,00 = Rp18.000,00.",
        "Total pembayaran = Rp450.000,00 + Rp18.000,00.",
        "Jadi, total pembayaran = Rp468.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Sedang",
      soal: "Ibu memiliki uang Rp1.200.000,00. Uang tersebut digunakan untuk membeli barang seharga Rp950.000,00 yang dikenakan pajak 5%. Berapa sisa uang Ibu?",
      petunjuk: "Hitung total belanja setelah pajak, lalu kurangkan dari uang Ibu.",
      jawaban: "202500",
      langkah: [
        "Pajak = 5% × Rp950.000,00 = Rp47.500,00.",
        "Total belanja = Rp950.000,00 + Rp47.500,00 = Rp997.500,00.",
        "Sisa uang = Rp1.200.000,00 − Rp997.500,00.",
        "Jadi, sisa uang Ibu = Rp202.500,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Sedang",
      soal: "Sebuah barang memiliki harga Rp600.000,00. Barang tersebut mendapat diskon 10%, kemudian dikenakan pajak 2%. Berapa harga akhirnya?",
      petunjuk: "Kerjakan diskon terlebih dahulu, kemudian pajak.",
      jawaban: "550800",
      langkah: [
        "Diskon = 10% × Rp600.000,00 = Rp60.000,00.",
        "Harga setelah diskon = Rp600.000,00 − Rp60.000,00 = Rp540.000,00.",
        "Pajak = 2% × Rp540.000,00 = Rp10.800,00.",
        "Harga akhir = Rp540.000,00 + Rp10.800,00.",
        "Jadi, harga akhir = Rp550.800,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Sedang",
      soal: "Seorang pegawai memperoleh gaji Rp5.000.000,00 setiap bulan. Jika pajak yang diasumsikan dalam soal sebesar 4%, berapa total gaji bersih selama 2 bulan?",
      petunjuk: "Hitung gaji bersih satu bulan, lalu kalikan 2.",
      jawaban: "9600000",
      langkah: [
        "Pajak sebulan = 4% × Rp5.000.000,00 = Rp200.000,00.",
        "Gaji bersih sebulan = Rp5.000.000,00 − Rp200.000,00 = Rp4.800.000,00.",
        "Gaji bersih 2 bulan = 2 × Rp4.800.000,00.",
        "Jadi, total gaji bersih = Rp9.600.000,00."
      ]
    }
  ],

  3: [
    {
      nomor: 1,
      tingkat: "Sulit",
      soal: "Sebuah tas memiliki harga Rp850.000,00. Tas tersebut mendapat diskon 20%, kemudian dikenakan pajak 11% dari harga setelah diskon. Berapa harga akhirnya?",
      petunjuk: "Hitung diskon terlebih dahulu, lalu tambahkan pajak 11%.",
      jawaban: "754800",
      langkah: [
        "Diskon = 20% × 850.000 = 170.000",
        "Harga setelah diskon = 850.000 − 170.000 = 680.000",
        "Pajak = 11% × 680.000 = 74.800",
        "Harga akhir = 680.000 + 74.800 = 754.800"
      ]
    },
    {
      nomor: 2,
      tingkat: "Sulit",
      soal: "Seorang pegawai menerima gaji pokok Rp5.200.000,00 dan tunjangan Rp650.000,00. Jika terdapat potongan sebesar 5% dari gaji pokok, berapa gaji bersih yang diterima?",
      petunjuk: "Jumlahkan gaji dan tunjangan, kemudian kurangi potongan.",
      jawaban: "5590000",
      langkah: [
        "Total pendapatan = 5.200.000 + 650.000 = 5.850.000",
        "Potongan = 5% × 5.200.000 = 260.000",
        "Gaji bersih = 5.850.000 − 260.000 = 5.590.000"
      ]
    },
    {
      nomor: 3,
      tingkat: "Sulit",
      soal: "Sebuah barang berharga Rp1.250.000,00 mendapat diskon 15%. Setelah diskon, barang dikenakan pajak 10%. Berapa harga akhirnya?",
      petunjuk: "Hitung harga setelah diskon, kemudian tambahkan pajak.",
      jawaban: "1168750",
      langkah: [
        "Diskon = 15% × 1.250.000 = 187.500",
        "Harga setelah diskon = 1.250.000 − 187.500 = 1.062.500",
        "Pajak = 10% × 1.062.500 = 106.250",
        "Harga akhir = 1.062.500 + 106.250 = 1.168.750"
      ]
    },
    {
      nomor: 4,
      tingkat: "Sulit",
      soal: "Rani membeli 3 buku dengan harga masing-masing Rp85.000,00. Ia mendapat diskon 10% dari total harga buku dan membayar ongkos kirim Rp15.000,00. Berapa total pembayaran Rani?",
      petunjuk: "Hitung total harga buku, diskon, lalu tambahkan ongkos kirim.",
      jawaban: "244500",
      langkah: [
        "Total harga buku = 3 × 85.000 = 255.000",
        "Diskon = 10% × 255.000 = 25.500",
        "Harga setelah diskon = 255.000 − 25.500 = 229.500",
        "Total pembayaran = 229.500 + 15.000 = 244.500"
      ]
    },
    {
      nomor: 5,
      tingkat: "Sulit",
      soal: "Seorang pegawai memiliki gaji kotor Rp7.500.000,00. Ia mendapat dua potongan, yaitu 2% dan 3% dari gaji kotor. Berapa gaji bersihnya?",
      petunjuk: "Jumlahkan kedua persentase potongan terlebih dahulu.",
      jawaban: "7125000",
      langkah: [
        "Total potongan = 2% + 3% = 5%",
        "Jumlah potongan = 5% × 7.500.000 = 375.000",
        "Gaji bersih = 7.500.000 − 375.000 = 7.125.000"
      ]
    },
    {
      nomor: 6,
      tingkat: "Sulit",
      soal: "Seorang tenaga penjual memperoleh komisi sebesar 4% dari total penjualan Rp12.500.000,00. Berapa komisi yang diterima?",
      petunjuk: "Kalikan total penjualan dengan persentase komisi.",
      jawaban: "500000",
      langkah: [
        "Komisi = 4% × 12.500.000",
        "Komisi = 500.000"
      ]
    },
    {
      nomor: 7,
      tingkat: "Sulit",
      soal: "Setelah mendapat diskon 25%, harga sebuah barang menjadi Rp900.000,00. Berapa harga barang sebelum diskon?",
      petunjuk: "Harga setelah diskon adalah 75% dari harga awal.",
      jawaban: "1200000",
      langkah: [
        "Persentase harga setelah diskon = 100% − 25% = 75%",
        "Harga awal = 900.000 ÷ 75%",
        "Harga awal = 900.000 ÷ 0,75 = 1.200.000"
      ]
    },
    {
      nomor: 8,
      tingkat: "Sulit",
      soal: "Sebuah toko menjual barang dengan total harga Rp4.800.000,00. Pembeli mendapat diskon 12,5%, kemudian dikenakan pajak 10% dari harga setelah diskon. Berapa total pembayaran?",
      petunjuk: "Kurangi diskon terlebih dahulu, kemudian hitung pajaknya.",
      jawaban: "4620000",
      langkah: [
        "Diskon = 12,5% × 4.800.000 = 600.000",
        "Harga setelah diskon = 4.800.000 − 600.000 = 4.200.000",
        "Pajak = 10% × 4.200.000 = 420.000",
        "Total pembayaran = 4.200.000 + 420.000 = 4.620.000"
      ]
    }
  ],
    4: [
    {
      nomor: 1,
      tingkat: "Sedang",
      soal: "Sebuah sepeda berharga Rp1.200.000,00 mendapat diskon 15%. Berapa harga setelah diskon?",
      petunjuk: "Hitung 15% dari harga awal, lalu kurangkan.",
      jawaban: "1020000",
      langkah: [
        "Diskon = 15% × Rp1.200.000,00 = Rp180.000,00.",
        "Harga setelah diskon = Rp1.200.000,00 − Rp180.000,00.",
        "Jadi, harga setelah diskon = Rp1.020.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Sedang",
      soal: "Harga sebuah lemari Rp2.000.000,00 dikenakan pajak 5%. Berapa total harganya?",
      petunjuk: "Hitung pajak, kemudian tambahkan ke harga awal.",
      jawaban: "2100000",
      langkah: [
        "Pajak = 5% × Rp2.000.000,00 = Rp100.000,00.",
        "Total harga = Rp2.000.000,00 + Rp100.000,00.",
        "Jadi, total harga = Rp2.100.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Sedang",
      soal: "Gaji Raka Rp3.600.000,00 dipotong pajak 2,5%. Berapa gaji bersihnya?",
      petunjuk: "Kurangi gaji awal dengan pajak.",
      jawaban: "3510000",
      langkah: [
        "Pajak = 2,5% × Rp3.600.000,00 = Rp90.000,00.",
        "Gaji bersih = Rp3.600.000,00 − Rp90.000,00.",
        "Jadi, gaji bersih = Rp3.510.000,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Sedang",
      soal: "Sebuah tas Rp500.000,00 mendapat diskon 20%, lalu dikenakan pajak 5%. Berapa harga akhirnya?",
      petunjuk: "Kerjakan diskon lebih dahulu, lalu pajak.",
      jawaban: "420000",
      langkah: [
        "Diskon = 20% × Rp500.000,00 = Rp100.000,00.",
        "Harga setelah diskon = Rp400.000,00.",
        "Pajak = 5% × Rp400.000,00 = Rp20.000,00.",
        "Harga akhir = Rp400.000,00 + Rp20.000,00 = Rp420.000,00."
      ]
    },
    {
      nomor: 5,
      tingkat: "Sedang",
      soal: "Toko menjual 4 buku seharga Rp35.000,00 per buku. Jika pajaknya 5%, berapa total pembayaran?",
      petunjuk: "Kalikan jumlah buku dengan harga satuan terlebih dahulu.",
      jawaban: "147000",
      langkah: [
        "Harga seluruh buku = 4 × Rp35.000,00 = Rp140.000,00.",
        "Pajak = 5% × Rp140.000,00 = Rp7.000,00.",
        "Total pembayaran = Rp140.000,00 + Rp7.000,00 = Rp147.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Sedang",
      soal: "Harga sebuah barang setelah diskon 10% adalah Rp720.000,00. Berapa harga awalnya?",
      petunjuk: "Harga setelah diskon merupakan 90% dari harga awal.",
      jawaban: "800000",
      langkah: [
        "Persentase setelah diskon = 100% − 10% = 90%.",
        "Harga awal = Rp720.000,00 ÷ 0,9.",
        "Jadi, harga awal = Rp800.000,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Sedang",
      soal: "Seseorang menerima komisi 3% dari penjualan Rp8.000.000,00. Berapa komisinya?",
      petunjuk: "Kalikan penjualan dengan 3%.",
      jawaban: "240000",
      langkah: [
        "Komisi = 3% × Rp8.000.000,00.",
        "Komisi = 0,03 × Rp8.000.000,00.",
        "Jadi, komisi = Rp240.000,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Sedang",
      soal: "Ibu memiliki Rp1.000.000,00. Ia membeli barang Rp750.000,00 dengan pajak 4%. Berapa sisa uang Ibu?",
      petunjuk: "Hitung total belanja setelah pajak, lalu kurangkan dari uang awal.",
      jawaban: "220000",
      langkah: [
        "Pajak = 4% × Rp750.000,00 = Rp30.000,00.",
        "Total belanja = Rp750.000,00 + Rp30.000,00 = Rp780.000,00.",
        "Sisa uang = Rp1.000.000,00 − Rp780.000,00 = Rp220.000,00."
      ]
    }
  ],

  5: [
    {
      nomor: 1,
      tingkat: "Sedang",
      soal: "Sebuah ponsel seharga Rp3.200.000,00 mendapat diskon 12,5%. Berapa harga setelah diskon?",
      petunjuk: "Ubah 12,5% menjadi 0,125.",
      jawaban: "2800000",
      langkah: [
        "Diskon = 12,5% × Rp3.200.000,00 = Rp400.000,00.",
        "Harga setelah diskon = Rp3.200.000,00 − Rp400.000,00.",
        "Jadi, harga setelah diskon = Rp2.800.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Sedang",
      soal: "Harga barang Rp1.750.000,00 dikenakan pajak 8%. Berapa total pembayaran?",
      petunjuk: "Tambahkan pajak ke harga awal.",
      jawaban: "1890000",
      langkah: [
        "Pajak = 8% × Rp1.750.000,00 = Rp140.000,00.",
        "Total = Rp1.750.000,00 + Rp140.000,00.",
        "Jadi, total pembayaran = Rp1.890.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Sedang",
      soal: "Gaji bulanan Rp6.400.000,00 dipotong 3,5%. Berapa gaji bersih?",
      petunjuk: "Hitung 3,5% dari gaji lalu kurangkan.",
      jawaban: "6176000",
      langkah: [
        "Potongan = 3,5% × Rp6.400.000,00 = Rp224.000,00.",
        "Gaji bersih = Rp6.400.000,00 − Rp224.000,00.",
        "Jadi, gaji bersih = Rp6.176.000,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Sedang",
      soal: "Barang seharga Rp900.000,00 mendapat diskon 20%, lalu pajak 10%. Berapa harga akhir?",
      petunjuk: "Diskon dihitung sebelum pajak.",
      jawaban: "792000",
      langkah: [
        "Diskon = 20% × Rp900.000,00 = Rp180.000,00.",
        "Harga setelah diskon = Rp720.000,00.",
        "Pajak = 10% × Rp720.000,00 = Rp72.000,00.",
        "Harga akhir = Rp720.000,00 + Rp72.000,00 = Rp792.000,00."
      ]
    },
    {
      nomor: 5,
      tingkat: "Sedang",
      soal: "Toko menjual 6 pasang sepatu, masing-masing Rp250.000,00. Dikenakan pajak 4%. Berapa totalnya?",
      petunjuk: "Cari jumlah harga sepatu dahulu.",
      jawaban: "1560000",
      langkah: [
        "Harga seluruh sepatu = 6 × Rp250.000,00 = Rp1.500.000,00.",
        "Pajak = 4% × Rp1.500.000,00 = Rp60.000,00.",
        "Total = Rp1.560.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Sedang",
      soal: "Harga setelah diskon 25% adalah Rp1.125.000,00. Berapa harga awal?",
      petunjuk: "Harga akhir adalah 75% dari harga awal.",
      jawaban: "1500000",
      langkah: [
        "Persentase harga akhir = 100% − 25% = 75%.",
        "Harga awal = Rp1.125.000,00 ÷ 0,75.",
        "Jadi, harga awal = Rp1.500.000,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Sedang",
      soal: "Penjualan sebesar Rp15.000.000,00 mendapat komisi 2,5%. Berapa komisi?",
      petunjuk: "Kalikan total penjualan dengan 0,025.",
      jawaban: "375000",
      langkah: [
        "Komisi = 2,5% × Rp15.000.000,00.",
        "Komisi = 0,025 × Rp15.000.000,00.",
        "Jadi, komisi = Rp375.000,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Sedang",
      soal: "Uang Dita Rp2.000.000,00. Ia membeli barang Rp1.600.000,00 dengan diskon 10% dan pajak 5% setelah diskon. Berapa sisa uangnya?",
      petunjuk: "Terapkan diskon, lalu pajak, kemudian kurangi dari uang Dita.",
      jawaban: "488000",
      langkah: [
        "Diskon = 10% × Rp1.600.000,00 = Rp160.000,00.",
        "Harga setelah diskon = Rp1.440.000,00.",
        "Pajak = 5% × Rp1.440.000,00 = Rp72.000,00.",
        "Total = Rp1.512.000,00.",
        "Sisa uang = Rp2.000.000,00 − Rp1.512.000,00 = Rp488.000,00."
      ]
    }
  ],

  6: [
    {
      nomor: 1,
      tingkat: "Sedang",
      soal: "Harga komputer Rp7.500.000,00 mendapat diskon 18%. Berapa harga setelah diskon?",
      petunjuk: "Hitung 18% dari harga awal.",
      jawaban: "6150000",
      langkah: [
        "Diskon = 18% × Rp7.500.000,00 = Rp1.350.000,00.",
        "Harga setelah diskon = Rp7.500.000,00 − Rp1.350.000,00.",
        "Jadi, harga setelah diskon = Rp6.150.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Sedang",
      soal: "Penghasilan Rp8.250.000,00 dikenakan potongan 4%. Berapa penghasilan bersih?",
      petunjuk: "Kurangkan 4% dari penghasilan.",
      jawaban: "7920000",
      langkah: [
        "Potongan = 4% × Rp8.250.000,00 = Rp330.000,00.",
        "Penghasilan bersih = Rp8.250.000,00 − Rp330.000,00.",
        "Jadi, penghasilan bersih = Rp7.920.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Sedang",
      soal: "Harga barang Rp2.400.000,00 mendapat diskon 15% dan pajak 11% setelah diskon. Berapa totalnya?",
      petunjuk: "Hitung diskon dahulu, kemudian pajak.",
      jawaban: "2264400",
      langkah: [
        "Diskon = 15% × Rp2.400.000,00 = Rp360.000,00.",
        "Harga setelah diskon = Rp2.040.000,00.",
        "Pajak = 11% × Rp2.040.000,00 = Rp224.400,00.",
        "Total = Rp2.264.400,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Sedang",
      soal: "Sebuah toko membeli barang Rp4.500.000,00 dan menjualnya Rp5.400.000,00. Berapa persentase keuntungan dari harga beli?",
      petunjuk: "Keuntungan dibagi harga beli, lalu dikali 100%.",
      jawaban: "20",
      langkah: [
        "Keuntungan = Rp5.400.000,00 − Rp4.500.000,00 = Rp900.000,00.",
        "Persentase keuntungan = (Rp900.000,00 ÷ Rp4.500.000,00) × 100%.",
        "Persentase keuntungan = 20%."
      ]
    },
    {
      nomor: 5,
      tingkat: "Sedang",
      soal: "Sebuah barang Rp3.000.000,00 didiskon 10% kemudian didiskon lagi 5%. Berapa harga akhirnya?",
      petunjuk: "Diskon kedua dihitung dari harga setelah diskon pertama.",
      jawaban: "2565000",
      langkah: [
        "Diskon pertama = 10% × Rp3.000.000,00 = Rp300.000,00.",
        "Harga pertama = Rp2.700.000,00.",
        "Diskon kedua = 5% × Rp2.700.000,00 = Rp135.000,00.",
        "Harga akhir = Rp2.565.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Sedang",
      soal: "Gaji Rp5.500.000,00 ditambah tunjangan Rp750.000,00. Potongan 4% dihitung dari gaji pokok. Berapa pendapatan bersih?",
      petunjuk: "Jumlahkan gaji dan tunjangan, lalu kurangi potongan dari gaji pokok.",
      jawaban: "6030000",
      langkah: [
        "Total pendapatan = Rp5.500.000,00 + Rp750.000,00 = Rp6.250.000,00.",
        "Potongan = 4% × Rp5.500.000,00 = Rp220.000,00.",
        "Pendapatan bersih = Rp6.250.000,00 − Rp220.000,00 = Rp6.030.000,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Sedang",
      soal: "Harga setelah pajak 5% adalah Rp2.100.000,00. Berapa harga sebelum pajak?",
      petunjuk: "Harga setelah pajak merupakan 105% dari harga awal.",
      jawaban: "2000000",
      langkah: [
        "Harga setelah pajak = 105% dari harga awal.",
        "Harga awal = Rp2.100.000,00 ÷ 1,05.",
        "Jadi, harga sebelum pajak = Rp2.000.000,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Sedang",
      soal: "Toko memberi diskon 20% pada barang Rp1.800.000,00. Pembeli membayar pajak 5% setelah diskon. Berapa besar pajaknya?",
      petunjuk: "Cari harga setelah diskon, kemudian hitung 5%.",
      jawaban: "72000",
      langkah: [
        "Diskon = 20% × Rp1.800.000,00 = Rp360.000,00.",
        "Harga setelah diskon = Rp1.440.000,00.",
        "Pajak = 5% × Rp1.440.000,00 = Rp72.000,00."
      ]
    }
  ],
    7: [
    {
      nomor: 1,
      tingkat: "Sulit",
      soal: "Sebuah barang Rp2.750.000,00 mendapat diskon 16%. Berapa harga setelah diskon?",
      petunjuk: "Kurangi 16% dari harga awal.",
      jawaban: "2310000",
      langkah: [
        "Diskon = 16% × Rp2.750.000,00 = Rp440.000,00.",
        "Harga setelah diskon = Rp2.750.000,00 − Rp440.000,00.",
        "Jadi, harga setelah diskon = Rp2.310.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Sulit",
      soal: "Penghasilan Rp9.600.000,00 dipotong 7,5%. Berapa penghasilan bersih?",
      petunjuk: "Hitung potongan lalu kurangkan.",
      jawaban: "8880000",
      langkah: [
        "Potongan = 7,5% × Rp9.600.000,00 = Rp720.000,00.",
        "Penghasilan bersih = Rp9.600.000,00 − Rp720.000,00 = Rp8.880.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Sulit",
      soal: "Barang Rp1.850.000,00 mendapat diskon 10%, lalu pajak 11%. Berapa total harga?",
      petunjuk: "Pajak dihitung dari harga setelah diskon.",
      jawaban: "1848150",
      langkah: [
        "Diskon = 10% × Rp1.850.000,00 = Rp185.000,00.",
        "Harga setelah diskon = Rp1.665.000,00.",
        "Pajak = 11% × Rp1.665.000,00 = Rp183.150,00.",
        "Total = Rp1.848.150,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Sulit",
      soal: "Harga jual barang Rp3.600.000,00 sudah termasuk keuntungan 20% dari modal. Berapa modalnya?",
      petunjuk: "Harga jual adalah 120% dari modal.",
      jawaban: "3000000",
      langkah: [
        "Harga jual = 120% × modal.",
        "Modal = Rp3.600.000,00 ÷ 1,2.",
        "Jadi, modal = Rp3.000.000,00."
      ]
    },
    {
      nomor: 5,
      tingkat: "Sulit",
      soal: "Toko membeli 15 barang seharga Rp80.000,00 per barang. Semua barang dijual Rp100.000,00 per barang. Berapa total keuntungan?",
      petunjuk: "Hitung total harga beli dan total harga jual.",
      jawaban: "300000",
      langkah: [
        "Total harga beli = 15 × Rp80.000,00 = Rp1.200.000,00.",
        "Total harga jual = 15 × Rp100.000,00 = Rp1.500.000,00.",
        "Keuntungan = Rp1.500.000,00 − Rp1.200.000,00 = Rp300.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Sulit",
      soal: "Harga Rp4.000.000,00 didiskon 15%, kemudian dikenakan pajak 10%. Berapa total pembayaran?",
      petunjuk: "Hitung harga diskon sebelum menambahkan pajak.",
      jawaban: "3740000",
      langkah: [
        "Diskon = 15% × Rp4.000.000,00 = Rp600.000,00.",
        "Harga setelah diskon = Rp3.400.000,00.",
        "Pajak = 10% × Rp3.400.000,00 = Rp340.000,00.",
        "Total = Rp3.740.000,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Sulit",
      soal: "Seseorang menerima komisi 4,5% dari penjualan Rp18.000.000,00. Berapa komisi?",
      petunjuk: "Kalikan 0,045 dengan total penjualan.",
      jawaban: "810000",
      langkah: [
        "Komisi = 4,5% × Rp18.000.000,00.",
        "Komisi = 0,045 × Rp18.000.000,00 = Rp810.000,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Sulit",
      soal: "Setelah pajak 8%, harga suatu barang menjadi Rp2.700.000,00. Berapa pajaknya?",
      petunjuk: "Cari harga awal dengan membagi 1,08, lalu cari selisihnya.",
      jawaban: "200000",
      langkah: [
        "Harga awal = Rp2.700.000,00 ÷ 1,08 = Rp2.500.000,00.",
        "Pajak = Rp2.700.000,00 − Rp2.500.000,00.",
        "Jadi, pajak = Rp200.000,00."
      ]
    }
  ],

  8: [
    {
      nomor: 1,
      tingkat: "Sulit",
      soal: "Harga sebuah motor Rp18.000.000,00 mendapat diskon 7,5%. Berapa harga setelah diskon?",
      petunjuk: "Hitung 7,5% dari harga motor.",
      jawaban: "16650000",
      langkah: [
        "Diskon = 7,5% × Rp18.000.000,00 = Rp1.350.000,00.",
        "Harga setelah diskon = Rp18.000.000,00 − Rp1.350.000,00.",
        "Jadi, harga setelah diskon = Rp16.650.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Sulit",
      soal: "Gaji Rp12.500.000,00 dipotong 6,4%. Berapa gaji bersih?",
      petunjuk: "Kurangi gaji dengan 6,4% dari gaji tersebut.",
      jawaban: "11700000",
      langkah: [
        "Potongan = 6,4% × Rp12.500.000,00 = Rp800.000,00.",
        "Gaji bersih = Rp12.500.000,00 − Rp800.000,00 = Rp11.700.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Sulit",
      soal: "Barang Rp6.400.000,00 didiskon 12,5% dan dikenakan pajak 11% setelah diskon. Berapa totalnya?",
      petunjuk: "Hitung diskon, lalu pajak dari harga setelah diskon.",
      jawaban: "6216000",
      langkah: [
        "Diskon = 12,5% × Rp6.400.000,00 = Rp800.000,00.",
        "Harga setelah diskon = Rp5.600.000,00.",
        "Pajak = 11% × Rp5.600.000,00 = Rp616.000,00.",
        "Total = Rp6.216.000,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Sulit",
      soal: "Modal usaha Rp8.000.000,00 memperoleh keuntungan 15%. Berapa harga jual seluruhnya?",
      petunjuk: "Tambahkan keuntungan 15% ke modal.",
      jawaban: "9200000",
      langkah: [
        "Keuntungan = 15% × Rp8.000.000,00 = Rp1.200.000,00.",
        "Harga jual = Rp8.000.000,00 + Rp1.200.000,00 = Rp9.200.000,00."
      ]
    },
    {
      nomor: 5,
      tingkat: "Sulit",
      soal: "Harga barang setelah diskon 30% adalah Rp1.260.000,00. Berapa nilai diskonnya?",
      petunjuk: "Harga setelah diskon adalah 70% dari harga awal.",
      jawaban: "540000",
      langkah: [
        "Harga awal = Rp1.260.000,00 ÷ 0,7 = Rp1.800.000,00.",
        "Diskon = 30% × Rp1.800.000,00 = Rp540.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Sulit",
      soal: "Sebuah toko menjual 8 unit barang Rp375.000,00 per unit. Pajak total 4%. Berapa total pembayaran?",
      petunjuk: "Hitung harga 8 unit, lalu tambahkan pajak 4%.",
      jawaban: "3120000",
      langkah: [
        "Harga seluruh barang = 8 × Rp375.000,00 = Rp3.000.000,00.",
        "Pajak = 4% × Rp3.000.000,00 = Rp120.000,00.",
        "Total pembayaran = Rp3.120.000,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Sulit",
      soal: "Pendapatan Rp7.200.000,00 terdiri dari gaji pokok dan tunjangan. Potongan 5% hanya dari gaji pokok Rp6.000.000,00. Berapa pendapatan bersih?",
      petunjuk: "Hitung potongan dari gaji pokok saja.",
      jawaban: "6900000",
      langkah: [
        "Potongan = 5% × Rp6.000.000,00 = Rp300.000,00.",
        "Pendapatan bersih = Rp7.200.000,00 − Rp300.000,00 = Rp6.900.000,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Sulit",
      soal: "Harga setelah diskon 20% kemudian pajak 5% adalah Rp1.680.000,00. Berapa harga awal?",
      petunjuk: "Harga akhir = 80% × 105% dari harga awal.",
      jawaban: "2000000",
      langkah: [
        "Faktor harga akhir = 0,8 × 1,05 = 0,84.",
        "Harga awal = Rp1.680.000,00 ÷ 0,84.",
        "Jadi, harga awal = Rp2.000.000,00."
      ]
    }
  ],

  9: [
    {
      nomor: 1,
      tingkat: "Sulit",
      soal: "Barang Rp5.600.000,00 didiskon 17,5%. Berapa harga setelah diskon?",
      petunjuk: "Hitung 17,5% dari harga awal.",
      jawaban: "4620000",
      langkah: [
        "Diskon = 17,5% × Rp5.600.000,00 = Rp980.000,00.",
        "Harga setelah diskon = Rp5.600.000,00 − Rp980.000,00 = Rp4.620.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Sulit",
      soal: "Penghasilan Rp14.400.000,00 dipotong 8,25%. Berapa penghasilan bersih?",
      petunjuk: "Hitung 8,25% dari penghasilan, lalu kurangkan.",
      jawaban: "13212000",
      langkah: [
        "Potongan = 8,25% × Rp14.400.000,00 = Rp1.188.000,00.",
        "Penghasilan bersih = Rp14.400.000,00 − Rp1.188.000,00 = Rp13.212.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Sulit",
      soal: "Barang Rp3.750.000,00 mendapat diskon 12% dan pajak 11% setelah diskon. Berapa total pembayaran?",
      petunjuk: "Terapkan diskon dahulu.",
      jawaban: "3663000",
      langkah: [
        "Diskon = 12% × Rp3.750.000,00 = Rp450.000,00.",
        "Harga setelah diskon = Rp3.300.000,00.",
        "Pajak = 11% × Rp3.300.000,00 = Rp363.000,00.",
        "Total = Rp3.663.000,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Sulit",
      soal: "Harga jual Rp6.900.000,00 memberikan keuntungan 15% dari modal. Berapa keuntungan dalam rupiah?",
      petunjuk: "Harga jual = 115% modal. Cari modal, lalu selisihnya.",
      jawaban: "900000",
      langkah: [
        "Modal = Rp6.900.000,00 ÷ 1,15 = Rp6.000.000,00.",
        "Keuntungan = Rp6.900.000,00 − Rp6.000.000,00 = Rp900.000,00."
      ]
    },
    {
      nomor: 5,
      tingkat: "Sulit",
      soal: "Harga awal Rp2.400.000,00 naik 10%, lalu turun 10%. Berapa harga akhirnya?",
      petunjuk: "Kenaikan dan penurunan dihitung berurutan dari nilai terbaru.",
      jawaban: "2376000",
      langkah: [
        "Setelah naik 10% = Rp2.400.000,00 × 1,1 = Rp2.640.000,00.",
        "Setelah turun 10% = Rp2.640.000,00 × 0,9.",
        "Harga akhir = Rp2.376.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Sulit",
      soal: "Toko menjual barang Rp9.500.000,00 dengan diskon 8%, lalu pajak 11%. Berapa pajaknya?",
      petunjuk: "Hitung harga setelah diskon, kemudian 11%.",
      jawaban: "961400",
      langkah: [
        "Diskon = 8% × Rp9.500.000,00 = Rp760.000,00.",
        "Harga setelah diskon = Rp8.740.000,00.",
        "Pajak = 11% × Rp8.740.000,00 = Rp961.400,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Sulit",
      soal: "Komisi 3,75% dari penjualan Rp24.000.000,00 akan dibagi rata kepada 3 pegawai. Berapa bagian setiap pegawai?",
      petunjuk: "Hitung total komisi, lalu bagi 3.",
      jawaban: "300000",
      langkah: [
        "Total komisi = 3,75% × Rp24.000.000,00 = Rp900.000,00.",
        "Bagian setiap pegawai = Rp900.000,00 ÷ 3 = Rp300.000,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Sulit",
      soal: "Setelah dipotong pajak 7%, gaji seseorang menjadi Rp8.370.000,00. Berapa pajak yang dipotong?",
      petunjuk: "Gaji bersih adalah 93% dari gaji awal.",
      jawaban: "630000",
      langkah: [
        "Gaji awal = Rp8.370.000,00 ÷ 0,93 = Rp9.000.000,00.",
        "Pajak = 7% × Rp9.000.000,00 = Rp630.000,00."
      ]
    }
  ],

  10: [
    {
      nomor: 1,
      tingkat: "Sulit",
      soal: "Barang Rp8.400.000,00 mendapat diskon berturut-turut 10% dan 5%. Berapa harga akhirnya?",
      petunjuk: "Diskon kedua dihitung dari harga setelah diskon pertama.",
      jawaban: "7182000",
      langkah: [
        "Setelah diskon 10% = Rp8.400.000,00 × 0,9 = Rp7.560.000,00.",
        "Setelah diskon 5% = Rp7.560.000,00 × 0,95.",
        "Harga akhir = Rp7.182.000,00."
      ]
    },
    {
      nomor: 2,
      tingkat: "Sulit",
      soal: "Penghasilan Rp16.000.000,00 mendapat potongan 5% dan 2,5%, keduanya dari penghasilan awal. Berapa penghasilan bersih?",
      petunjuk: "Jumlahkan persentase potongan karena keduanya dihitung dari dasar yang sama.",
      jawaban: "14800000",
      langkah: [
        "Total potongan = 5% + 2,5% = 7,5%.",
        "Potongan = 7,5% × Rp16.000.000,00 = Rp1.200.000,00.",
        "Penghasilan bersih = Rp16.000.000,00 − Rp1.200.000,00 = Rp14.800.000,00."
      ]
    },
    {
      nomor: 3,
      tingkat: "Sulit",
      soal: "Harga Rp5.000.000,00 didiskon 20%, lalu pajak 11%. Berapa total pembayaran?",
      petunjuk: "Hitung harga setelah diskon sebelum pajak.",
      jawaban: "4440000",
      langkah: [
        "Diskon = 20% × Rp5.000.000,00 = Rp1.000.000,00.",
        "Harga setelah diskon = Rp4.000.000,00.",
        "Pajak = 11% × Rp4.000.000,00 = Rp440.000,00.",
        "Total pembayaran = Rp4.440.000,00."
      ]
    },
    {
      nomor: 4,
      tingkat: "Sulit",
      soal: "Sebuah usaha memiliki modal Rp12.000.000,00. Barang terjual dengan keuntungan 22,5% dari modal. Berapa total hasil penjualan?",
      petunjuk: "Tambahkan keuntungan ke modal.",
      jawaban: "14700000",
      langkah: [
        "Keuntungan = 22,5% × Rp12.000.000,00 = Rp2.700.000,00.",
        "Hasil penjualan = Rp12.000.000,00 + Rp2.700.000,00 = Rp14.700.000,00."
      ]
    },
    {
      nomor: 5,
      tingkat: "Sulit",
      soal: "Harga setelah pajak 12% adalah Rp5.600.000,00. Berapa nilai pajaknya?",
      petunjuk: "Harga akhir merupakan 112% dari harga sebelum pajak.",
      jawaban: "600000",
      langkah: [
        "Harga awal = Rp5.600.000,00 ÷ 1,12 = Rp5.000.000,00.",
        "Pajak = Rp5.600.000,00 − Rp5.000.000,00 = Rp600.000,00."
      ]
    },
    {
      nomor: 6,
      tingkat: "Sulit",
      soal: "Pembelian 12 barang masing-masing Rp425.000,00 mendapat diskon 10% dari total, lalu pajak 5%. Berapa total pembayaran?",
      petunjuk: "Hitung total harga, diskon, kemudian pajak.",
      jawaban: "4819500",
      langkah: [
        "Harga seluruh barang = 12 × Rp425.000,00 = Rp5.100.000,00.",
        "Diskon = 10% × Rp5.100.000,00 = Rp510.000,00.",
        "Harga setelah diskon = Rp4.590.000,00.",
        "Pajak = 5% × Rp4.590.000,00 = Rp229.500,00.",
        "Total = Rp4.819.500,00."
      ]
    },
    {
      nomor: 7,
      tingkat: "Sulit",
      soal: "Harga jual Rp13.800.000,00 sudah termasuk keuntungan 15% dari modal. Berapa modal usaha?",
      petunjuk: "Harga jual merupakan 115% dari modal.",
      jawaban: "12000000",
      langkah: [
        "Harga jual = 115% × modal.",
        "Modal = Rp13.800.000,00 ÷ 1,15.",
        "Jadi, modal = Rp12.000.000,00."
      ]
    },
    {
      nomor: 8,
      tingkat: "Sulit",
      soal: "Seseorang memiliki uang Rp10.000.000,00. Ia membeli barang Rp8.500.000,00 dengan diskon 12%, lalu pajak 11% setelah diskon. Berapa sisa uangnya?",
      petunjuk: "Kerjakan diskon, pajak, lalu kurangi dari uang awal.",
      jawaban: "1697200",
      langkah: [
        "Diskon = 12% × Rp8.500.000,00 = Rp1.020.000,00.",
        "Harga setelah diskon = Rp7.480.000,00.",
        "Pajak = 11% × Rp7.480.000,00 = Rp822.800,00.",
        "Total pembayaran = Rp8.302.800,00.",
        "Sisa uang = Rp10.000.000,00 − Rp8.302.800,00 = Rp1.697.200,00."
      ]
    }
  ]
};
const handleFotoProfil = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Pilih file gambar yang valid.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 480;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setFotoProfil(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => alert("Gambar tidak dapat dibaca.");
    image.src = reader.result;
  };
  reader.onerror = () => alert("Foto gagal dibaca.");
  reader.readAsDataURL(file);
};

return (
    <div className="aplikasi">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">📖</span>
          <div>
            <h2>RuangPajak</h2>
            <p>Belajar Pajak Jadi Lebih Mudah</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="header-label">Media Pembelajaran Matematika SMP</div>
          <button className="audio-toggle" onClick={() => setMusicOn((value) => !value)} aria-pressed={musicOn}>
            {musicOn ? "🔊 Musik aktif" : "🎵 Nyalakan musik"}
          </button>
        </div>
      </header>
            <div className="layout">
        <aside className="sidebar">
          <h3>MENU UTAMA</h3>

          {menu.map((item) => (
            <button
              key={item.nama}
              className={`menu-item ${
                halaman === item.nama ? "aktif" : ""
              }`}
              onClick={() => setHalaman(item.nama)}
            >
              <span>{item.ikon}</span>
              {item.nama}
            </button>
          ))}
        </aside>

        <main className="konten">
          {halaman === "Beranda" && (
            <>
              <section className="sambutan">
                <div>
                  <p className="sapaan">SELAMAT DATANG 👋</p>
                  <h1>Yuk, Belajar Pajak!</h1>
                  <p className="deskripsi">
                    Kenali pajak, pelajari cara menghitungnya,
                    dan temukan penerapannya dalam kehidupan
                    sehari-hari.
                  </p>
                  <button
                    className="tombol-utama"
                    onClick={() => setHalaman("Materi")}
                  >
                    Mulai Belajar →
                  </button>
                </div>
                <div className="ilustrasi">📚</div>
              </section>

              <section className="bagian-menu">
                <h2>Jelajahi Pembelajaran</h2>
                <p className="subjudul">
                  Pilih bagian yang ingin kamu pelajari.
                </p>

                <div className="kartu-container">
                  {menu.filter((item) => item.nama !== "Profil" && item.nama !== "Beranda").map((item) => (
                    <button
                      className="kartu"
                      key={item.nama}
                      onClick={() => setHalaman(item.nama)}
                    >
                      <span className="kartu-ikon">
                        {item.ikon}
                      </span>
                      <h3>{item.nama}</h3>
                      <p>
                        {item.nama === "Materi" &&
                          "Pelajari pengertian dan perhitungan pajak."}
                        {item.nama === "Latihan Soal" &&
                          "Pelajari soal kontekstual dan gunakan tutor RMT untuk memahami langkah berpikir."}
                        {item.nama === "Kuis" &&
                          "Uji pemahamanmu melalui kuis bertingkat."}
                        {item.nama === "Latihan" &&
                          "Asah kemampuan dengan latihan soal."}
                        {item.nama === "Profil" &&
                          "Lengkapi informasi profil belajarmu."}
                      </p>
                      <span className="selengkapnya">
                        Buka bagian →
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {halaman === "Materi" && (
            <section className="materi-halaman">
              <p className="sapaan">MATERI PEMBELAJARAN</p>
              <h1>Pajak</h1>
              <p className="materi-pengantar">
                Pada bagian ini, kita akan mempelajari pengertian
                pajak, jenis pajak yang disebutkan dalam buku,
                serta contoh perhitungan pajak.
              </p>

              <div className="materi-kartu">
                <h2>1. Pengertian Pajak</h2>
                <p>
                  Pajak merupakan suatu kewajiban masyarakat
                  sebagai warga negara untuk menyerahkan sebagian
                  kekayaannya kepada negara menurut peraturan
                  yang telah ditetapkan oleh pemerintah.
                  Hasil dari pajak digunakan untuk kesejahteraan
                  umum.
                </p>
                <div className="catatan-materi">
                  💡 <strong>Ingat:</strong> Pajak digunakan
                  untuk membiayai kebutuhan dan kepentingan umum.
                </div>
              </div>

              <div className="materi-kartu">
                <h2>2. Contoh Pajak dalam Kehidupan Sehari-hari</h2>

                <div className="jenis-pajak">
                  <div className="jenis-ikon">💼</div>
                  <div>
                    <h3>Pajak Penghasilan (PPh)</h3>
                    <p>
                      Dalam buku, pegawai tetap dari perusahaan
                      swasta atau pegawai negeri disebut sebagai
                      contoh orang yang dikenakan pajak penghasilan.
                    </p>
                  </div>
                </div>

                <div className="jenis-pajak">
                  <div className="jenis-ikon">🛒</div>
                  <div>
                    <h3>Pajak Pertambahan Nilai (PPN)</h3>
                    <p>
                      Ketika berbelanja di toko swalayan, grosir,
                      dealer, atau tempat lainnya, harga barang
                      dapat ditambah dengan pajak yang disebut PPN.
                    </p>
                  </div>
                </div>
              </div>

              <div className="materi-kartu">
                <h2>3. Cara Menghitung Pajak</h2>
                <p>
                  Untuk menghitung pajak dari suatu nilai,
                  kita dapat mengalikan nilai tersebut dengan
                  persentase pajak yang diberikan pada soal.
                </p>

                <div className="rumus-box">
                  <span>Besarnya Pajak</span>
                  <strong>
                    = Persentase Pajak × Nilai yang Dikenai Pajak
                  </strong>
                </div>

                <p>
                  Jika yang ditanyakan adalah penghasilan bersih
                  setelah dipotong pajak, maka:
                </p>

                <div className="rumus-box">
                  <span>Penghasilan Bersih</span>
                  <strong>
                    = Penghasilan Awal − Besarnya Pajak
                  </strong>
                </div>

                <div className="catatan-materi">
                  Persentase harus diubah menjadi bentuk desimal
                  sebelum dikalikan. Contoh: 2,5% = 2,5 ÷ 100
                  = 0,025.
                </div>
              </div>

              <div className="materi-kartu contoh-materi">
                <p className="sapaan">CONTOH DARI BUKU</p>
                <h2>4. Menghitung Gaji Bersih Ani</h2>
                <p>
                  Ani menerima gaji setiap bulan sebesar
                  Rp2.500.000,00 dan dikenakan pajak sebesar 2,5%.
                  Berapakah gaji bersih yang diterima Ani?
                </p>

                <h3>Diketahui:</h3>
                <ul>
                  <li>Gaji Ani = Rp2.500.000,00</li>
                  <li>Persentase pajak = 2,5%</li>
                </ul>

                <h3>Ditanyakan:</h3>
                <p>Gaji bersih Ani?</p>

                <h3>Penyelesaian:</h3>
                <p>Langkah 1. Ubah persentase menjadi desimal.</p>
                <div className="langkah-rumus">
                  2,5% = 2,5 ÷ 100 = 0,025
                </div>

                <p>Langkah 2. Hitung besarnya pajak.</p>
                <div className="langkah-rumus">
                  Pajak = 0,025 × Rp2.500.000,00
                  <br />
                  Pajak = Rp62.500,00
                </div>

                <p>Langkah 3. Hitung gaji bersih Ani.</p>
                <div className="langkah-rumus">
                  Gaji bersih = Gaji awal − Pajak
                  <br />
                  = Rp2.500.000,00 − Rp62.500,00
                  <br />
                  = Rp2.437.500,00
                </div>

                <div className="jawaban-akhir">
                  Jadi, gaji bersih yang diterima Ani adalah
                  <strong> Rp2.437.500,00.</strong>
                </div>
              </div>

              <div className="materi-kartu">
                <h2>5. Ayo Pahami!</h2>
                <p>
                  Setelah suatu barang mendapat potongan harga
                  atau diskon, barang tersebut dapat dikenai pajak
                  sesuai informasi yang diberikan dalam soal.
                  Karena itu, perhatikan urutan perhitungannya.
                </p>
                <ol>
                  <li>Hitung harga setelah diskon.</li>
                  <li>Gunakan harga tersebut sebagai dasar perhitungan pajak sesuai soal.</li>
                  <li>Tambahkan pajak untuk memperoleh harga akhir.</li>
                </ol>
                <div className="catatan-materi">
                  Catatan: Besarnya diskon dan pajak harus mengikuti
                  angka yang diberikan dalam setiap soal.
                </div>
              </div>

              <button
                className="tombol-utama"
                onClick={() => setHalaman("Beranda")}
              >
                ← Kembali ke Beranda
              </button>
            </section>
          )}

          {halaman === "Latihan Soal" && (
            <section className="contoh-halaman">
              <p className="sapaan">CONTOH DAN PEMBAHASAN 📝</p>
              <h1>Latihan Soal Pajak</h1>
              <p>
                Pelajari soal, informasi yang diketahui, dan langkah penyelesaiannya.
              </p>

              {contohSoal.map((item) => (
                <article className="kartu-soal" key={item.nomor}>
                  <h3>Soal {item.nomor} — {item.kategori}</h3>
                  <p><strong>Tingkat:</strong> {item.tingkat}</p>
                  <p>{item.soal}</p>
                  <h4>Diketahui:</h4>
                  <ul>
                    {item.diketahui.map((data, i) => (
                      <li key={i}>{data}</li>
                    ))}
                  </ul>
                  <h4>Ditanya:</h4>
                  <p>{item.ditanya}</p>
                  <h4>Penyelesaian:</h4>
                  {item.langkah.map((langkah, i) => (
                    <p key={i}>{i + 1}. {langkah}</p>
                  ))}
                  <p className="jawaban-akhir">
                    <strong>{item.jawaban}</strong>
                  </p>
                </article>
              ))}
              <TutorRMT />
            </section>
          )}
                    {halaman === "Latihan" && (
            <section className="contoh-halaman">
              <p className="sapaan">ASAH KEMAMPUANMU ✏️</p>
              <h1>Latihan Pajak</h1>
              <p>Pilih level dan kerjakan soal secara bertahap.</p>

              <div className="daftar-level">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
                  <button
                    key={level}
                    onClick={() => setLevelLatihan(level)}
                    className={levelLatihan === level ? "level-aktif" : ""}
                  >
                    Level {level}
                  </button>
                ))}
              </div>

              <h2>Level {levelLatihan}</h2>

              {bankLatihan[levelLatihan] ? (
                bankLatihan[levelLatihan].map((soal) => (
                  <div className="kartu-soal" key={soal.nomor}>
                    <h3>Soal {soal.nomor}</h3>
                    <p>{soal.soal}</p>

                    <p><strong>Petunjuk:</strong> {soal.petunjuk}</p>

                    <input
                      type="text"
                      placeholder="Masukkan jawaban angka saja"
                      value={jawabanLatihan[levelLatihan]?.[soal.nomor] || ""}
                      onChange={(e) =>
                        setJawabanLatihan((lama) => ({
                          ...lama,
                          [levelLatihan]: {
                            ...lama[levelLatihan],
                            [soal.nomor]: e.target.value
                          }
                        }))
                      }
                    />

                    <button
                      onClick={() => {
                        const jawaban = jawabanLatihan[levelLatihan]?.[soal.nomor] || "";
                        const benar = jawaban.replace(/\D/g, "") === soal.jawaban;

                        setHasilLatihan((lama) => {
  const hasilBaru = {
    ...lama,
    [levelLatihan]: {
      ...lama[levelLatihan],
      [soal.nomor]: benar
    }
  };

  const semuaHasil = Object.values(hasilBaru).flatMap(
    (level) => Object.values(level)
  );

  const jumlahBenar = semuaHasil.filter(
    (hasil) => hasil === true
  ).length;

  const nilai = Math.round(
    (jumlahBenar / semuaHasil.length) * 100
  );

  localStorage.setItem("nilaiLatihan", String(nilai));

  return hasilBaru;
});
                      }}
                    >
                      Periksa Jawaban
                    </button>

                    {hasilLatihan[levelLatihan]?.[soal.nomor] !== undefined && (
                      <p>
                        {hasilLatihan[levelLatihan][soal.nomor]
                          ? "Jawaban benar! Hebat! 🎉"
                          : "Jawaban belum tepat. Coba lagi, ya!"}
                      </p>
                    )}

                    <button
                      className="tombol-sekunder"
                      disabled={hasilLatihan[levelLatihan]?.[soal.nomor] === undefined}
                      onClick={() => {
                        const kunciPembahasan = `${levelLatihan}-${soal.nomor}`;
                        setPembahasanLatihan((lama) =>
                          lama.includes(kunciPembahasan)
                            ? lama.filter((n) => n !== kunciPembahasan)
                            : [...lama, kunciPembahasan]
                        );
                      }}
                    >
                      {hasilLatihan[levelLatihan]?.[soal.nomor] === undefined ? "Periksa jawaban untuk membuka pembahasan" : "Lihat Langkah Penyelesaian"}
                    </button>

                    {hasilLatihan[levelLatihan]?.[soal.nomor] !== undefined && pembahasanLatihan.includes(`${levelLatihan}-${soal.nomor}`) && (
                      <div className="pembahasan">
                        <h4>Pembahasan</h4>
                        {soal.langkah.map((langkah, i) => (
                          <p key={i}>{i + 1}. {langkah}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p>Soal untuk level ini akan segera ditambahkan.</p>
              )}
            </section>
          )}

          {halaman === "Pretest" && <Pretest />}

          {halaman === "Postest" && <Posttest />}

          {halaman === "Evaluasi" && <Evaluasi />}

          
{halaman === "Kuis" && (
  <section className="kuis-halaman">
    <p className="sapaan">UJI PEMAHAMANMU</p>
    <h1>Kuis Pajak 🎯</h1>
    <p className="kuis-pengantar">
      Selesaikan setiap level untuk meningkatkan pemahamanmu
      tentang perhitungan pajak dan persentase.
    </p>

    <div className="daftar-level-kuis">
      {[1, 2, 3, 4, 5].map((level) => {
        const terbuka =
          level === 1 ||
          Number(hasilKuisPerLevel[level - 1] || 0) >= 70;

        const nilai = hasilKuisPerLevel[level];

        return (
          <button
            key={level}
            className={`tombol-level ${
              levelAktifKuis === level ? "level-terpilih" : ""
            }`}
            disabled={!terbuka}
            onClick={() => setLevelAktifKuis(level)}
          >
            <span>
              {terbuka ? `LEVEL ${level}` : `🔒 LEVEL ${level}`}
            </span>
            <strong>
              {[
                "",
                "Dasar Perhitungan Pajak",
                "Pajak dalam Kehidupan Sehari-hari",
                "Diskon dan Pajak",
                "Perbandingan Harga dan Pajak",
                "Tantangan Literasi Pajak",
              ][level]}
            </strong>
            <small>
              {nilai !== undefined
                ? `Nilai terakhir: ${nilai}/100`
                : terbuka
                  ? "10 soal pilihan ganda"
                  : "Selesaikan level sebelumnya dengan nilai minimal 70"}
            </small>
          </button>
        );
      })}
    </div>

    <div className="level-aktif">
      <span>LEVEL {levelAktifKuis}</span>
      <strong>
        {[
          "",
          "Dasar Perhitungan Pajak",
          "Pajak dalam Kehidupan Sehari-hari",
          "Diskon dan Pajak",
          "Perbandingan Harga dan Pajak",
          "Tantangan Literasi Pajak",
        ][levelAktifKuis]}
      </strong>
      <p>10 soal pilihan ganda</p>
    </div>

    <div className="progres-kuis">
      <span>Jumlah soal: 10</span>
      <span>
        Terjawab: {Object.keys(jawabanKuis).length}/10
      </span>
    </div>

    {bankKuis[levelAktifKuis].map((item, index) => (
      <article className="kuis-kartu" key={index}>
        <div className="kuis-nomor">
          SOAL {index + 1} DARI 10
        </div>

        <h3>{item.soal}</h3>

        <div className="pilihan-kuis">
          {item.pilihan.map((pilihan, pilihanIndex) => (
            <button
              key={pilihanIndex}
              disabled={kuisDiperiksa}
              className={`pilihan-jawaban ${
                jawabanKuis[index] === pilihanIndex
                  ? "pilihan-dipilih"
                  : ""
              } ${
                kuisDiperiksa && pilihanIndex === item.benar
                  ? "pilihan-benar"
                  : ""
              } ${
                kuisDiperiksa &&
                jawabanKuis[index] === pilihanIndex &&
                pilihanIndex !== item.benar
                  ? "pilihan-salah"
                  : ""
              }`}
              onClick={() =>
                setJawabanKuis((sebelumnya) => ({
                  ...sebelumnya,
                  [index]: pilihanIndex,
                }))
              }
            >
              <span>{String.fromCharCode(65 + pilihanIndex)}.</span>
              {pilihan}
            </button>
          ))}
        </div>

        {kuisDiperiksa && (
          <div className="pembahasan-kuis">
            <strong>
              {jawabanKuis[index] === item.benar
                ? "✓ Jawaban benar!"
                : "✗ Jawaban belum tepat."}
            </strong>
            <p>{item.bahas}</p>
          </div>
        )}
      </article>
    ))}

    {!kuisDiperiksa ? (
      <button
        className="tombol-utama"
        disabled={Object.keys(jawabanKuis).length !== 10}
        onClick={() => {
          const hasilPerSoal = bankKuis[levelAktifKuis].map(
            (item, index) => jawabanKuis[index] === item.benar
          );

          const nilai = hasilPerSoal.filter(Boolean).length * 10;

          playQuizFeedback(hasilPerSoal);

          setDiperiksaPerLevel((sebelumnya) => ({
            ...sebelumnya,
            [levelAktifKuis]: true,
          }));

          setHasilKuisPerLevel((sebelumnya) => ({
            ...sebelumnya,
            [levelAktifKuis]: nilai,
          }));
        }}
      >
        Periksa Jawaban
      </button>
    ) : (
      <div className="hasil-kuis">
        <h2>Hasil Kuis Level {levelAktifKuis}</h2>

        <strong>
          {hasilKuisPerLevel[levelAktifKuis] || 0}/100
        </strong>

        <p>
          Jawaban benar:{" "}
          {bankKuis[levelAktifKuis].filter(
            (item, index) => jawabanKuis[index] === item.benar
          ).length}{" "}
          dari 10 soal.
        </p>

        {hasilKuisPerLevel[levelAktifKuis] >= 70 ? (
          <p>Hebat! Kamu berhasil menyelesaikan level ini.</p>
        ) : (
          <p>
            Nilaimu belum mencapai 70. Coba pelajari pembahasannya
            dan ulangi kuis ini.
          </p>
        )}

        <button
          className="tombol-utama"
          onClick={() => {
            setJawabanPerLevel((sebelumnya) => ({
              ...sebelumnya,
              [levelAktifKuis]: {},
            }));

            setDiperiksaPerLevel((sebelumnya) => ({
              ...sebelumnya,
              [levelAktifKuis]: false,
            }));
          }}
        >
          Ulangi Kuis
        </button>

        {hasilKuisPerLevel[levelAktifKuis] >= 70 &&
          levelAktifKuis < 5 && (
            <button
              className="tombol-utama"
              onClick={() => {
                setLevelAktifKuis(levelAktifKuis + 1);
              }}
            >
              Lanjut ke Level {levelAktifKuis + 1}
            </button>
          )}
      </div>
    )}
  </section>
)}

                   {halaman === "Profil" && (
  <section className="halaman-kosong">
    <div className="foto-profil">
  {fotoProfil ? (
    <img src={fotoProfil} alt="Foto Profil" />
  ) : (
    <span>👤</span>
  )}
</div>

<label className="tombol-utama pilih-foto">
  Pilih Foto Profil
  <input
    type="file"
    accept="image/*"
    onChange={handleFotoProfil}
    hidden
  />
</label>

    <h1>Profil Pembelajaran</h1>
    <div className="form-profil">
  <h2>Identitas Siswa</h2>

  <label>Nama Lengkap</label>
  <input
    type="text"
    placeholder="Masukkan nama lengkap"
    value={namaSiswa}
    onChange={(e) => setNamaSiswa(e.target.value)}
  />

  <label>Gender</label>
  <select
    value={genderSiswa}
    onChange={(e) => setGenderSiswa(e.target.value)}
  >
    <option value="">Pilih gender</option>
    <option value="Pria">Pria</option>
    <option value="Wanita">Wanita</option>
  </select>

  <label>Asal Sekolah</label>
  <input
    type="text"
    placeholder="Masukkan asal sekolah"
    value={sekolahSiswa}
    onChange={(e) => setSekolahSiswa(e.target.value)}
  />

  <label>Kelas</label>
  <select
    value={kelasSiswa}
    onChange={(e) => setKelasSiswa(e.target.value)}
  >
    <option value="">Pilih kelas</option>
    <option value="VII">VII</option>
    <option value="VIII">VIII</option>
    <option value="IX">IX</option>
  </select>

  <label>Asal Daerah</label>
  <input
    type="text"
    placeholder="Masukkan asal daerah"
    value={daerahSiswa}
    onChange={(e) => setDaerahSiswa(e.target.value)}
  />

  <button
    className="tombol-utama"
    onClick={() => {
      if (!namaSiswa || !genderSiswa || !sekolahSiswa || !kelasSiswa || !daerahSiswa) {
        alert("Lengkapi semua identitas terlebih dahulu!");
        return;
      }

      alert("Profil berhasil disimpan di perangkat ini!");
    }}
  >
    Simpan Profil
  </button>
</div>
    

    <p>
      Selamat datang di RuangPajak. Gunakan media ini untuk
      mempelajari konsep pajak, melihat contoh, mengerjakan kuis,
      dan berlatih dari Level 1 sampai Level 10.
    </p>

    <div className="materi-kartu">
      <h2>Petunjuk Penggunaan</h2>

      <ol>
        <li>
          Buka menu Materi untuk membaca ringkasan konsep pajak.
        </li>
        <li>
          Buka Latihan Soal untuk melihat contoh penyelesaian dan berdiskusi dengan Tutor RMT.
        </li>
        <li>
          Kerjakan Kuis untuk menguji pemahaman.
        </li>
        <li>
          Pilih salah satu dari 10 level Latihan dan masukkan
          jawaban berupa angka saja.
        </li>
      </ol>
    </div>

    <button
      className="tombol-utama"
      onClick={() => setHalaman("Beranda")}
    >
      ← Kembali ke Beranda
    </button>
  </section>
)}

          {halaman !== "Beranda" &&
            halaman !== "Materi" &&
            halaman !== "Latihan Soal" &&
            halaman !== "Kuis" &&
            halaman !== "Latihan" &&
            halaman !== "Pretest" &&
            halaman !== "Postest" &&
            halaman !== "Evaluasi" &&
            halaman !== "Profil" && (
              <section className="halaman-kosong">
                <span className="halaman-ikon">
                  {menu.find((item) => item.nama === halaman)?.ikon}
                </span>
                <h1>{halaman}</h1>
                <p>
                  Bagian ini akan kita bangun pada tahap berikutnya.
                </p>
                <button
                  className="tombol-utama"
                  onClick={() => setHalaman("Beranda")}
                >
                  ← Kembali ke Beranda
                </button>
              </section>
            )}
        </main>
      </div>

      <footer className="footer">
        <p>
          © 2026 RuangPajak | Media Pembelajaran Matematika SMP
        </p>
      </footer>
    </div>
  );
}

export default App;