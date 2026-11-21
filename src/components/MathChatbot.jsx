import React, { useState, useRef, useEffect } from "react";

// Ganti dengan API Key valid dari Google AI Studio (umumnya diawali "AIzaSy...")
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = "gemini-1.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `
Kamu adalah pembimbing belajar literasi matematis pada aplikasi RuangPajak yang interaktif, sabar, ramah, dan menggunakan pendekatan Realistic Mathematics Education (RMT).

ATURAN UTAMA (WAJIB DIPATUHI):
1. DILARANG KERAS langsung memberikan jawaban akhir atau hasil perhitungan jadi dari soal yang ditanyakan siswa.
2. Gunakan metode SCAFFOLDING (bimbingan bertahap):
   - Tahap 1: Ajak siswa mengamati apa saja yang diketahui (misalnya harga barang, persentase PPN/PPh, diskon, netto/bruto) dan apa yang ditanyakan dalam konteks kehidupan sehari-hari.
   - Tahap 2: Bantu siswa menganalisis pola, hubungan persentase/pecahan/desimal, atau rumus yang relevan lewat pertanyaan pancingan ringan.
   - Tahap 3: Minta siswa mencoba menghitung langkah demi langkah, beri apresiasi, dan tuntun hingga siswa menyimpulkan jawaban akhirnya sendiri.
3. Gunakan bahasa Indonesia yang ramah, memotivasi, dan mudah dipahami.
4. Jika siswa hanya menyapa (seperti "halo"), balas dengan ramah dan tanyakan soal atau materi literasi matematis/pajak apa yang sedang dipelajari.
5. Berikan satu langkah atau satu pertanyaan pancingan saja per respons agar siswa tidak kewalahan.
`;

export default function MathChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Halo! Selamat datang di RuangPajak. Ada soal literasi matematis atau perhitungan pajak yang sedang kamu kerjakan? Yuk, kita bahas pelan-pelan bersama!",
    },
  ]);

  const historyRef = useRef([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    const userText = input.trim();
    if (!userText || isLoading) return;

    setInput("");
    setIsLoading(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", text: userText },
      { role: "bot", text: "Sedang berpikir..." },
    ]);

    historyRef.current.push({
      role: "user",
      parts: [{ text: userText }],
    });

    let fullBotResponse = "";
    let isFirstChunk = true;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: historyRef.current,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const parsedData = JSON.parse(jsonStr);
              const chunkText =
                parsedData.candidates?.[0]?.content?.parts?.[0]?.text || "";

              if (chunkText) {
                if (isFirstChunk) {
                  fullBotResponse = chunkText;
                  isFirstChunk = false;
                } else {
                  fullBotResponse += chunkText;
                }

                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "bot",
                    text: fullBotResponse,
                  };
                  return updated;
                });
              }
            } catch {
              // Abaikan potongan JSON yang belum lengkap
            }
          }
        }
      }

      if (fullBotResponse) {
        historyRef.current.push({
          role: "model",
          parts: [{ text: fullBotResponse }],
        });
      } else {
        throw new Error("Respons kosong dari server.");
      }
    } catch (err) {
      console.error("Error Gemini API:", err);
      historyRef.current.pop();
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "error",
          text: "Asisten sedang bermasalah. Silakan cek koneksi atau API Key Anda.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .rp-chat-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 58px;
          height: 58px;
          border-radius: 9999px;
          background-color: #2563eb;
          color: #ffffff;
          border: none;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          transition: transform 0.2s ease, background-color 0.2s ease;
        }
        .rp-chat-btn:hover {
          background-color: #1d4ed8;
          transform: scale(1.05);
        }
        .rp-chat-window {
          position: fixed;
          bottom: 94px;
          right: 24px;
          width: 380px;
          max-width: calc(100vw - 32px);
          height: 520px;
          max-height: calc(100vh - 120px);
          background-color: #ffffff;
          border-radius: 16px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 9998;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .rp-chat-header {
          background-color: #2563eb;
          color: #ffffff;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .rp-chat-header h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
        }
        .rp-chat-header span {
          font-size: 12px;
          opacity: 0.9;
        }
        .rp-chat-close {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 0 4px;
        }
        .rp-chat-body {
          flex: 1;
          padding: 14px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background-color: #ffffff;
        }
        .rp-msg {
          max-width: 82%;
          padding: 10px 13px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .rp-msg.bot {
          align-self: flex-start;
          background-color: #f1f5f9;
          color: #0f172a;
          border-bottom-left-radius: 4px;
        }
        .rp-msg.user {
          align-self: flex-end;
          background-color: #2563eb;
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }
        .rp-msg.error {
          align-self: center;
          background-color: #fee2e2;
          color: #991b1b;
          font-size: 12.5px;
          text-align: center;
        }
        .rp-chat-form {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid #e2e8f0;
          background-color: #f8fafc;
        }
        .rp-chat-input {
          flex: 1;
          padding: 9px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 9999px;
          font-size: 14px;
          outline: none;
          color: #0f172a;
          background-color: #ffffff;
        }
        .rp-chat-input:focus {
          border-color: #2563eb;
        }
        .rp-chat-send {
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          border: none;
          background-color: #2563eb;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rp-chat-send:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
        }
        @media (max-width: 480px) {
          .rp-chat-window {
            bottom: 0;
            right: 0;
            width: 100vw;
            max-width: 100vw;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
          }
          .rp-chat-btn {
            bottom: 16px;
            right: 16px;
          }
        }
      `}</style>

      {isOpen && (
        <div className="rp-chat-window">
          <div className="rp-chat-header">
            <div>
              <h4>Tutor RuangPajak (RMT)</h4>
              <span>Bimbingan langkah demi langkah</span>
            </div>
            <button
              type="button"
              className="rp-chat-close"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup chat"
            >
              &times;
            </button>
          </div>

          <div className="rp-chat-body">
            {messages.map((m, idx) => (
              <div key={idx} className={`rp-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="rp-chat-form" onSubmit={handleSend}>
            <input
              type="text"
              className="rp-chat-input"
              placeholder="Ketik pertanyaan atau soalmu..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="rp-chat-send"
              disabled={isLoading || !input.trim()}
              aria-label="Kirim pesan"
            >
              &#10148;
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="rp-chat-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Buka Tutor Matematika"
        aria-label="Buka Tutor Matematika"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
        </svg>
      </button>
    </>
  );
}