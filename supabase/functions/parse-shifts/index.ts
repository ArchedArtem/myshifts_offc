import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageBase64 } = await req.json()
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')

    const modelName = "google/gemma-4-31b-it:free";
    const baseUrl = "https://openrouter.ai/api/v1";

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

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemInstruction },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`OpenRouter API Error: ${data.error.message}`);
    }

    let text = data.choices[0].message.content;
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