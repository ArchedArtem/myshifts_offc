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

    const modelName = "gemini-2.5-flash-lite";
    const baseUrl = "https://generativelanguage.googleapis.com/v1beta";

    const systemInstruction = `
      Ты — эксперт по чтению рабочих графиков (в том числе формата "Вкусно — и точка"). 
      Извлеки смены и верни СТРОГО JSON массив объектов:
      {
        "date": "YYYY-MM-DD",
        "startTime": "HH:mm",
        "endTime": "HH:mm",
        "title": "Название смены",
        "break": number
      }
      
      ВАЖНЫЕ ПРАВИЛА:
      1. Год по умолчанию: 2026.
      2. Для поля "title": Не пиши туда сырой нечитаемый текст или случайные символы! Если есть роль (например: "Официант", "В ночь", "Зал", "Админ") — напиши её. Если ничего понятного нет, напиши "Рабочая смена".
      3. ПЕРЕРЫВЫ (break): Справа от времени смены могут быть колонки с цифрами перерывов в минутах (например, "15" и "30", или "15", "15", "30", или просто "30"). Тебе нужно найти эти цифры, относящиеся к конкретному дню, математически сложить их (например, 15 + 30 = 45) и записать итоговое число в поле break. Если цифр перерыва нет, верни 0.
    `;

    const contents = [{
      parts: [
        { text: systemInstruction },
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