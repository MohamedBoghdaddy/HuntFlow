// Background captcha solver — handles AI solve requests from content scripts

import { Storage } from '../utils/storage.js';

// Handle captcha solve requests routed through service worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AI_SOLVE_CAPTCHA') {
    (async () => {
      const settings = await Storage.getSettings();
      let solution = null;

      if (settings.openaiKey) {
        solution = await solveWithGPT4o(msg.base64, msg.instructions, settings.openaiKey, settings.aiModel);
      }

      if (!solution && settings.geminiKey) {
        solution = await solveWithGemini(msg.base64, settings.geminiKey);
      }

      sendResponse(solution);
    })();
    return true;
  }

  if (msg.type === 'AI_SOLVE_IMAGE_CAPTCHA') {
    (async () => {
      const settings = await Storage.getSettings();
      if (!settings.openaiKey) { sendResponse(null); return; }

      const indices = await solveImageSelectionCaptcha(
        msg.images, msg.instruction, settings.openaiKey
      );
      sendResponse(indices);
    })();
    return true;
  }
});

async function solveWithGPT4o(base64, instructions, apiKey, model = 'gpt-4o') {
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: instructions || 'Read this CAPTCHA. Return ONLY the characters shown, nothing else.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' } }
          ]
        }],
        max_tokens: 50,
        temperature: 0
      })
    });
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('[CaptchaSolver] GPT-4o error:', e);
    return null;
  }
}

async function solveWithGemini(base64, apiKey) {
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Read this CAPTCHA. Return ONLY the characters shown.' },
              { inline_data: { mime_type: 'image/png', data: base64 } }
            ]
          }],
          generationConfig: { maxOutputTokens: 20, temperature: 0 }
        })
      }
    );
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    console.error('[CaptchaSolver] Gemini error:', e);
    return null;
  }
}

async function solveImageSelectionCaptcha(images, instruction, apiKey) {
  const content = [
    { type: 'text', text: `CAPTCHA: "${instruction}". Reply with comma-separated indices (0-based) of matching images. Only numbers.` }
  ];

  images.forEach((img, i) => {
    content.push({ type: 'text', text: `[${i}]` });
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${img}`, detail: 'low' } });
  });

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content }],
        max_tokens: 20,
        temperature: 0
      })
    });
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return text.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  } catch (e) {
    return null;
  }
}
