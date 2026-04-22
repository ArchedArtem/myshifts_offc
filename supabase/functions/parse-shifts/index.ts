import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageBase64 } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    // МЕНЯЕМ НА МОДЕЛЬ ИЗ ТВОЕГО СПИСКА
    const modelName = "gemini-2.5-flash";
    const baseUrl = "https://generativelanguage.googleapis.com/v1beta";

    const contents = [{
      parts: [
        { text: "Ты — эксперт по графикам. Извлеки смены и верни СТРОГО JSON массив объектов {date, startTime, endTime, title}. Используй текущий год. По умолчанию 2026 год" },
        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
      ]
    }];

    const response = await fetch(`${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Google API Error: ${data.error.message}`);
    }

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('ИИ не нашел данных на изображении');
    }

    let text = data.candidates[0].content.parts[0].text;

    // Очистка от markdown оберток
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(text, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Ошибка:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})