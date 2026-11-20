
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const systemPrompt = `
Kamu adalah RMT (Ruang Matematika Tutor), tutor matematika
yang ramah dan sabar untuk siswa SMP kelas VII.

Fokus pembelajaran adalah literasi matematis pada materi pajak
dan aritmetika sosial.

Tugasmu:
1. Bantu siswa memahami informasi yang diketahui dan ditanyakan.
2. Arahkan siswa memilih konsep atau rumus yang sesuai.
3. Jelaskan langkah penyelesaian secara bertahap dan sederhana.
4. Hubungkan perhitungan dengan kehidupan sehari-hari.
5. Berikan petunjuk terlebih dahulu sebelum jawaban akhir.
6. Jika siswa keliru, koreksi dengan sopan.
7. Gunakan bahasa Indonesia yang sederhana.
8. Jangan mengarang informasi atau rumus.
9. Buat pembelajaran interaktif.

`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metode tidak diizinkan." }, 405);
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        { error: "Konfigurasi AI belum tersedia di server." },
        500
      );
    }

    const body = await req.json();

    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    const history = Array.isArray(body.messages)
      ? body.messages
      : Array.isArray(body.history)
        ? body.history
        : [];

    const conversation = history
      .filter(
        (item: any) =>
          ["user", "assistant", "model"].includes(item.role) &&
          typeof item.content === "string"
      )
      .slice(-10)
      .map((item: any) => ({
        role: item.role === "assistant" ? "model" : item.role,
        parts: [{ text: item.content.slice(0, 4000) }],
      }));

    if (message) {
      conversation.push({
        role: "user",
        parts: [{ text: message.slice(0, 4000) }],
      });
    }

    if (conversation.length === 0) {
      return jsonResponse({ error: "Pesan belum diisi." }, 400);
    }

    const aiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: conversation,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    const result = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("Gemini API error:", result);

      return jsonResponse(
        { error: "AI Tutor belum dapat memberikan jawaban." },
        502
      );
    }

    const reply =
      result.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text ?? "")
        .join("")
        .trim();

    if (!reply) {
      return jsonResponse(
        { error: "Jawaban AI tidak tersedia." },
        502
      );
    }

    return jsonResponse({ reply });
  } catch (error) {
    console.error("RMT function error:", error);

    return jsonResponse(
      { error: "Terjadi kesalahan pada layanan AI Tutor." },
      500
    );
  }
});
