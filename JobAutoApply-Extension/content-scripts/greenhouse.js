// Greenhouse ATS content script — scraper + autofill

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
    window.addEventListener('JAA_SCRAPE', scrapeJob);

    // Job list page
    if (document.querySelector('#content .opening, .job-posts')) {
      scrapeJobList();
    }
    // Application page
    if (document.querySelector('#application-form, #application_form')) {
      fillApplicationForm();
    }
  }

  function scrapeJobList() {
    const items = document.querySelectorAll('.opening, .job-post');
    const jobs = [];
    const company = document.querySelector('.company-name, h1')?.textContent.trim() || '';

    items.forEach(item => {
      const titleEl = item.querySelector('a');
      if (!titleEl) return;
      const url = titleEl.href;
      const id = url.match(/\/jobs\/(\d+)/)?.[1] || url;
      jobs.push({
        id: `greenhouse-${id}`,
        platform: 'greenhouse',
        title: titleEl.textContent.trim(),
        company,
        location: item.querySelector('.location')?.textContent.trim() || '',
        url,
        applyUrl: url,
        easyApply: true, // Greenhouse is always direct
        externalApply: false,
        scrapedAt: new Date().toISOString()
      });
    });

    if (jobs.length > 0) {
      sendMsg({ type: 'JOBS_SCRAPED', jobs });
      console.log(`[Greenhouse] Scraped ${jobs.length} jobs`);
    }
  }

  function scrapeJob() {
    scrapeJobList();
  }

  async function fillApplicationForm() {
    if (!profile) return;
    console.log('[Greenhouse] Filling application form...');

    await delay(500);

    const fieldMap = {
      'first_name': profile.firstName,
      'last_name': profile.lastName,
      'email': profile.email,
      'phone': profile.phone,
      'location': profile.city,
      'job_application_answers_attributes_0_text_value': profile.coverLetterTemplate || '',
    };

    // Fill by ID
    Object.entries(fieldMap).forEach(([id, value]) => {
      const el = document.getElementById(id) || document.querySelector(`[name*="${id}"]`);
      if (el && value) simulateInput(el, value);
    });

    // Fill all inputs by label
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]), textarea, select');
    inputs.forEach(el => {
      const label = getLabel(el).toLowerCase();
      const value = getLabelValue(label, el.tagName === 'TEXTAREA');
      if (value && !el.value) simulateInput(el, String(value));
    });

    // Custom questions
    const questions = document.querySelectorAll('.field, .question');
    for (const q of questions) {
      await handleQuestion(q);
    }

    // Resume upload
    const resumeInput = document.querySelector('input[type="file"][name*="resume"], input[type="file"][id*="resume"]');
    if (resumeInput && profile.resumeDataUrl) {
      await uploadFile(resumeInput, profile.resumeDataUrl, profile.resumeFileName || 'resume.pdf');
    }

    // Cover letter upload
    const coverInput = document.querySelector('input[type="file"][name*="cover"], input[type="file"][id*="cover"]');
    if (coverInput && profile.coverLetterDataUrl) {
      await uploadFile(coverInput, profile.coverLetterDataUrl, 'cover_letter.pdf');
    }
  }

  async function handleQuestion(questionEl) {
    const inputs = questionEl.querySelectorAll('input, textarea, select');
    const labelEl = questionEl.querySelector('label, .label-text, legend');
    const label = labelEl?.textContent.trim().toLowerCase() || '';

    for (const input of inputs) {
      const value = getLabelValue(label, input.tagName === 'TEXTAREA');
      if (value && !input.value) {
        simulateInput(input, String(value));
        await delay(100);
      }
    }
  }

  function getLabelValue(label, isTextarea) {
    if (!profile) return null;
    if (label.includes('first name')) return profile.firstName;
    if (label.includes('last name')) return profile.lastName;
    if (label.includes('email')) return profile.email;
    if (label.includes('phone')) return profile.phone;
    if (label.includes('linkedin')) return profile.linkedin;
    if (label.includes('github') || label.includes('portfolio')) return profile.github || profile.portfolio;
    if (label.includes('website')) return profile.portfolio;
    if (label.includes('city') || label.includes('location')) return profile.city;
    if (label.includes('salary')) return String(profile.expectedSalary || '');
    if (label.includes('years') || label.includes('experience')) return String(profile.yearsExperience || '3');
    if (label.includes('authorized') || label.includes('work authorization')) return 'Yes';
    if (label.includes('sponsorship')) return 'No';
    if (isTextarea && (label.includes('cover') || label.includes('about') || label.includes('why'))) {
      return profile.coverLetterTemplate || '';
    }
    return null;
  }

  async function uploadFile(input, dataUrl, fileName) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      console.warn('[Greenhouse] File upload error:', e);
    }
  }

  function simulateInput(el, value) {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }

  function getLabel(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    return el.placeholder || el.name || '';
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function sendMsg(msg) { return new Promise(r => chrome.runtime.sendMessage(msg, r)); }
})();
