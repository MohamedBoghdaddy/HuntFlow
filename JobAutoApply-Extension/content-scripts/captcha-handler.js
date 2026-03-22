// Universal CAPTCHA bypass handler
// Supports: reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, image puzzles, text captchas

(function () {
  'use strict';

  let settings = null;
  let aiHelper = null;

  // Initialize
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, async (s) => {
    settings = s;
    if (settings?.captchaService === 'ai') {
      await loadAIHelper();
    }
    startObserver();
  });

  async function loadAIHelper() {
    // Dynamic load in content script context
    aiHelper = {
      solveCaptchaImage: async (base64, instructions) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'AI_SOLVE_CAPTCHA',
            base64,
            instructions
          }, resolve);
        });
      }
    };
  }

  function startObserver() {
    const observer = new MutationObserver(() => {
      detectAndHandleCaptchas();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    detectAndHandleCaptchas();
  }

  function detectAndHandleCaptchas() {
    handleReCaptchaV2();
    handleHCaptcha();
    handleTurnstile();
    handleImageCaptcha();
    handleTextCaptcha();
  }

  // ─── reCAPTCHA v2 ──────────────────────────────────────────────────────────

  function handleReCaptchaV2() {
    const frames = document.querySelectorAll('iframe[src*="recaptcha/api2/anchor"], iframe[src*="recaptcha/api2/bframe"]');
    if (frames.length === 0) return;

    // Check if already solved
    const response = document.querySelector('[name="g-recaptcha-response"]');
    if (response && response.value) return;

    if (settings?.captchaService === 'anticaptcha') {
      solveWithAntiCaptchaService('recaptchav2');
    } else if (settings?.captchaService === 'ai') {
      solveReCaptchaV2WithAudio();
    } else {
      notifyManualCaptcha('reCAPTCHA v2 detected — please solve it');
    }
  }

  async function solveReCaptchaV2WithAudio() {
    try {
      // Click the checkbox
      const checkboxFrame = document.querySelector('iframe[src*="recaptcha/api2/anchor"]');
      if (!checkboxFrame) return;

      await randomDelay(800, 1500);

      // Try audio challenge
      const bframe = document.querySelector('iframe[src*="recaptcha/api2/bframe"]');
      if (!bframe) return;

      // Message into the recaptcha iframe to click audio button
      // This uses the Buster extension approach
      console.log('[Captcha] Attempting audio reCAPTCHA bypass...');

      // Notify popup to handle
      chrome.runtime.sendMessage({ type: 'CAPTCHA_NEEDED', captchaType: 'recaptchav2' });
    } catch (e) {
      console.error('[Captcha] reCAPTCHA solve error:', e);
    }
  }

  // ─── hCaptcha ──────────────────────────────────────────────────────────────

  function handleHCaptcha() {
    const hcaptcha = document.querySelector('iframe[src*="hcaptcha.com"]');
    if (!hcaptcha) return;

    const response = document.querySelector('[name="h-captcha-response"]');
    if (response && response.value) return;

    if (settings?.captchaService === 'anticaptcha') {
      solveWithAntiCaptchaService('hcaptcha');
    } else {
      notifyManualCaptcha('hCaptcha detected — please solve it');
    }
  }

  // ─── Cloudflare Turnstile ──────────────────────────────────────────────────

  function handleTurnstile() {
    const turnstile = document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
      document.querySelector('[data-sitekey][class*="cf-turnstile"]');
    if (!turnstile) return;

    console.log('[Captcha] Cloudflare Turnstile detected — waiting for auto-solve...');
    // Turnstile often auto-solves; wait and check
    setTimeout(() => {
      const token = document.querySelector('[name="cf-turnstile-response"]');
      if (!token?.value) {
        notifyManualCaptcha('Cloudflare Turnstile detected');
      }
    }, 5000);
  }

  // ─── Image puzzle CAPTCHA ──────────────────────────────────────────────────

  async function handleImageCaptcha() {
    // Common image selection captchas (e.g., "select all traffic lights")
    const captchaImages = document.querySelectorAll('.rc-image-tile-wrapper img, .captcha-image img');
    if (captchaImages.length === 0) return;
    if (!aiHelper) return;

    const instruction = document.querySelector('.rc-imageselect-desc-no-canonical, .captcha-instructions')?.textContent;
    if (!instruction) return;

    console.log('[Captcha] Image selection CAPTCHA detected:', instruction);

    const base64Images = await Promise.all(
      Array.from(captchaImages).map(img => imageToBase64(img))
    );

    chrome.runtime.sendMessage({
      type: 'AI_SOLVE_IMAGE_CAPTCHA',
      images: base64Images,
      instruction
    }, (indices) => {
      if (!indices || !Array.isArray(indices)) return;
      indices.forEach(i => {
        const tile = captchaImages[i]?.closest('.rc-image-tile-wrapper, .captcha-tile');
        if (tile) {
          tile.click();
          console.log('[Captcha] Clicked tile', i);
        }
      });

      // Submit after selection
      setTimeout(() => {
        const verifyBtn = document.querySelector('#recaptcha-verify-button, .captcha-verify');
        if (verifyBtn) verifyBtn.click();
      }, 1000);
    });
  }

  // ─── Text CAPTCHA ──────────────────────────────────────────────────────────

  async function handleTextCaptcha() {
    const captchaImg = document.querySelector('img[src*="captcha"], img[alt*="captcha"], .captcha-image img');
    if (!captchaImg) return;

    const captchaInput = document.querySelector('input[name*="captcha"], input[placeholder*="captcha"], input[id*="captcha"]');
    if (!captchaInput || captchaInput.value) return;

    console.log('[Captcha] Text CAPTCHA image found, solving with AI...');

    const base64 = await imageToBase64(captchaImg);
    chrome.runtime.sendMessage({
      type: 'AI_SOLVE_CAPTCHA',
      base64,
      instructions: 'Read this CAPTCHA text. Return ONLY the characters shown, no explanation.'
    }, (solution) => {
      if (solution) {
        captchaInput.focus();
        captchaInput.value = solution;
        captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
        captchaInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[Captcha] Text CAPTCHA solved:', solution);
      }
    });
  }

  // ─── AntiCaptcha service ────────────────────────────────────────────────────

  async function solveWithAntiCaptchaService(type) {
    if (!settings?.antiCaptchaKey) {
      notifyManualCaptcha(`${type} CAPTCHA detected — no AntiCaptcha key configured`);
      return;
    }

    const siteKey = extractSiteKey(type);
    if (!siteKey) return;

    const taskTypes = {
      recaptchav2: 'NoCaptchaTaskProxyless',
      hcaptcha: 'HCaptchaTaskProxyless',
    };

    try {
      // Create task
      const createRes = await fetch('https://api.anti-captcha.com/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: settings.antiCaptchaKey,
          task: {
            type: taskTypes[type] || 'NoCaptchaTaskProxyless',
            websiteURL: window.location.href,
            websiteKey: siteKey
          }
        })
      });
      const createData = await createRes.json();
      if (createData.errorId > 0) {
        console.error('[Captcha] AntiCaptcha error:', createData.errorDescription);
        return;
      }

      const taskId = createData.taskId;

      // Poll for result
      let solution = null;
      for (let i = 0; i < 60; i++) {
        await randomDelay(2000, 3000);
        const resultRes = await fetch('https://api.anti-captcha.com/getTaskResult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientKey: settings.antiCaptchaKey, taskId })
        });
        const resultData = await resultRes.json();
        if (resultData.status === 'ready') {
          solution = resultData.solution?.gRecaptchaResponse || resultData.solution?.token;
          break;
        }
      }

      if (solution) {
        injectCaptchaSolution(type, solution);
      }
    } catch (e) {
      console.error('[Captcha] AntiCaptcha service error:', e);
    }
  }

  function injectCaptchaSolution(type, token) {
    const selectors = {
      recaptchav2: '[name="g-recaptcha-response"]',
      hcaptcha: '[name="h-captcha-response"]'
    };

    const el = document.querySelector(selectors[type]);
    if (el) {
      el.value = token;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[Captcha] Injected', type, 'solution');

      // Trigger callback if available
      if (type === 'recaptchav2' && window.grecaptcha) {
        // Find and trigger the callback
        const widgets = document.querySelectorAll('.g-recaptcha');
        widgets.forEach(w => {
          const callbackName = w.getAttribute('data-callback');
          if (callbackName && window[callbackName]) {
            window[callbackName](token);
          }
        });
      }
    }
  }

  function extractSiteKey(type) {
    if (type === 'recaptchav2') {
      const el = document.querySelector('.g-recaptcha[data-sitekey], [data-sitekey]');
      if (el) return el.getAttribute('data-sitekey');
      const frame = document.querySelector('iframe[src*="recaptcha"]');
      if (frame) {
        const url = new URL(frame.src);
        return url.searchParams.get('k');
      }
    }
    if (type === 'hcaptcha') {
      const el = document.querySelector('.h-captcha[data-sitekey], [data-sitekey]');
      return el?.getAttribute('data-sitekey');
    }
    return null;
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  async function imageToBase64(imgEl) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth || imgEl.width;
      canvas.height = imgEl.naturalHeight || imgEl.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    });
  }

  function notifyManualCaptcha(message) {
    chrome.runtime.sendMessage({ type: 'CAPTCHA_NEEDED', message });
    console.warn('[Captcha]', message);
  }

  function randomDelay(min, max) {
    return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min)) + min));
  }
})();
