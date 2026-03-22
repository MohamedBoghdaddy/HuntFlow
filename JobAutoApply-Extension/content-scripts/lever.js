// Lever ATS content script — scraper + autofill

(function () {
  'use strict';

  let profile = null;
  let settings = null;

  Promise.all([
    sendMsg({ type: 'GET_PROFILE' }),
    sendMsg({ type: 'GET_SETTINGS' })
  ]).then(([p, s]) => {
    profile = p;
    settings = s;
    init();
  });

  function init() {
    window.addEventListener('JAA_SCRAPE', scrapeJobList);

    if (isJobListPage()) scrapeJobList();
    if (isApplicationPage()) fillApplication();
  }

  function isJobListPage() {
    return document.querySelector('.postings-group, .posting-title') !== null && !isApplicationPage();
  }

  function isApplicationPage() {
    return document.querySelector('#application-form, .application-form, form[action*="/apply"]') !== null;
  }

  function scrapeJobList() {
    const postings = document.querySelectorAll('.posting, li.posting');
    const jobs = [];
    const company = document.querySelector('.main-header-text, h1')?.textContent.trim() || window.location.hostname;

    postings.forEach(p => {
      const titleEl = p.querySelector('.posting-title h5, a.posting-title, .posting-name');
      const locationEl = p.querySelector('.sort-by-location, .posting-category');
      const link = p.querySelector('a[href*="/apply"]') || p.querySelector('a');

      if (!titleEl) return;

      const url = link?.href || window.location.href;
      const id = url.match(/lever\.co\/[^/]+\/([a-z0-9-]+)/)?.[1] || Date.now().toString();

      jobs.push({
        id: `lever-${id}`,
        platform: 'lever',
        title: titleEl.textContent.trim(),
        company,
        location: locationEl?.textContent.trim() || '',
        url,
        applyUrl: url,
        easyApply: true,
        externalApply: false,
        scrapedAt: new Date().toISOString()
      });
    });

    if (jobs.length > 0) {
      sendMsg({ type: 'JOBS_SCRAPED', jobs });
      console.log(`[Lever] Scraped ${jobs.length} jobs`);
    }
  }

  async function fillApplication() {
    if (!profile) return;
    console.log('[Lever] Filling Lever application...');
    await delay(800);

    const form = document.querySelector('#application-form, .application-form');
    if (!form) return;

    // Standard Lever fields
    const fieldIds = {
      'name': `${profile.firstName} ${profile.lastName}`,
      'email': profile.email,
      'phone': profile.phone,
      'org': profile.currentCompany || '',
      'location': profile.city || '',
      'urls[LinkedIn]': profile.linkedin || '',
      'urls[GitHub]': profile.github || '',
      'urls[Portfolio]': profile.portfolio || '',
      'comments': profile.coverLetterTemplate || '',
    };

    Object.entries(fieldIds).forEach(([name, value]) => {
      const el = form.querySelector(`[name="${name}"], [id="${name}"]`);
      if (el && value && !el.value) simulateInput(el, value);
    });

    // Extra questions
    const customQuestions = form.querySelectorAll('.application-question');
    for (const q of customQuestions) {
      await handleCustomQuestion(q);
    }

    // Resume
    const resumeInput = form.querySelector('input[type="file"][name*="resume"], .resume-upload input[type="file"]');
    if (resumeInput && profile.resumeDataUrl) {
      await uploadFile(resumeInput, profile.resumeDataUrl, profile.resumeFileName || 'resume.pdf');
    }

    // EEO fields
    fillEEO(form);
  }

  async function handleCustomQuestion(el) {
    const label = el.querySelector('label')?.textContent.trim().toLowerCase() || '';
    const input = el.querySelector('input, textarea, select');
    if (!input || input.value) return;

    const value = getValueForLabel(label, input.tagName === 'TEXTAREA');
    if (value !== null) {
      simulateInput(input, String(value));
      await delay(100);
    }
  }

  function fillEEO(form) {
    const eeoSelects = form.querySelectorAll('select[name*="eeo"], select[id*="eeo"]');
    eeoSelects.forEach(sel => {
      const declineOption = Array.from(sel.options).find(o =>
        o.text.toLowerCase().includes('decline') || o.text.toLowerCase().includes('prefer not')
      );
      if (declineOption) {
        sel.value = declineOption.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function getValueForLabel(label, isTextarea) {
    if (!profile) return null;
    if (label.includes('name')) return `${profile.firstName} ${profile.lastName}`;
    if (label.includes('email')) return profile.email;
    if (label.includes('phone')) return profile.phone;
    if (label.includes('linkedin')) return profile.linkedin;
    if (label.includes('github')) return profile.github;
    if (label.includes('portfolio') || label.includes('website')) return profile.portfolio;
    if (label.includes('location') || label.includes('city')) return profile.city;
    if (label.includes('salary')) return String(profile.expectedSalary || '');
    if (label.includes('years') || label.includes('experience')) return String(profile.yearsExperience || '');
    if (label.includes('authorized')) return 'Yes';
    if (label.includes('sponsorship')) return 'No';
    if (isTextarea) return profile.coverLetterTemplate || '';
    return null;
  }

  async function uploadFile(input, dataUrl, fileName) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      console.warn('[Lever] File upload error:', e);
    }
  }

  function simulateInput(el, value) {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function sendMsg(msg) { return new Promise(r => chrome.runtime.sendMessage(msg, r)); }
})();
