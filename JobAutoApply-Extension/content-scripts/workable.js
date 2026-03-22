// Workable ATS content script

(function () {
  'use strict';

  let profile = null;

  sendMsg({ type: 'GET_PROFILE' }).then(p => {
    profile = p;
    init();
  });

  function init() {
    window.addEventListener('JAA_SCRAPE', scrapeJobs);
    if (document.querySelector('.jobs-list, [data-ui="jobs-list"]')) scrapeJobs();
    if (document.querySelector('[data-ui="application-form"], .application-form')) fillApplication();
  }

  function scrapeJobs() {
    const items = document.querySelectorAll('.jobs-list-item, li[data-ui="job-item"]');
    const jobs = [];
    const company = document.querySelector('h1, .company-title')?.textContent.trim() || '';

    items.forEach(item => {
      const titleEl = item.querySelector('h2 a, [data-ui="job-title"] a, a');
      if (!titleEl) return;
      const url = titleEl.href;
      const id = url.split('/').pop() || Date.now().toString();

      jobs.push({
        id: `workable-${id}`,
        platform: 'workable',
        title: titleEl.textContent.trim(),
        company,
        location: item.querySelector('[data-ui="job-location"], .location')?.textContent.trim() || '',
        url,
        applyUrl: url,
        easyApply: true,
        externalApply: false,
        scrapedAt: new Date().toISOString()
      });
    });

    if (jobs.length) sendMsg({ type: 'JOBS_SCRAPED', jobs });
    console.log(`[Workable] Scraped ${jobs.length} jobs`);
  }

  async function fillApplication() {
    if (!profile) return;
    await delay(600);

    const fieldMappings = [
      { name: 'firstname', value: profile.firstName },
      { name: 'lastname', value: profile.lastName },
      { name: 'email', value: profile.email },
      { name: 'phone', value: profile.phone },
      { name: 'address', value: profile.address },
      { name: 'city', value: profile.city },
    ];

    fieldMappings.forEach(({ name, value }) => {
      if (!value) return;
      const el = document.querySelector(`input[name="${name}"], input[placeholder*="${name}"]`);
      if (el && !el.value) simulateInput(el, value);
    });

    // Profile summary / cover letter
    const coverTextarea = document.querySelector('textarea[name*="cover"], textarea[placeholder*="cover"]');
    if (coverTextarea && profile.coverLetterTemplate) {
      simulateInput(coverTextarea, profile.coverLetterTemplate);
    }

    // LinkedIn / portfolio URLs
    const linkInputs = document.querySelectorAll('input[type="url"], input[name*="linkedin"], input[name*="website"]');
    linkInputs.forEach(input => {
      const name = (input.name || input.placeholder || '').toLowerCase();
      if (name.includes('linkedin') && profile.linkedin) simulateInput(input, profile.linkedin);
      else if ((name.includes('website') || name.includes('portfolio')) && profile.portfolio) simulateInput(input, profile.portfolio);
      else if (name.includes('github') && profile.github) simulateInput(input, profile.github);
    });

    // Resume
    const resumeInput = document.querySelector('input[type="file"][accept*="pdf"]');
    if (resumeInput && profile.resumeDataUrl) {
      await uploadFile(resumeInput, profile.resumeDataUrl, profile.resumeFileName || 'resume.pdf');
    }
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
      console.warn('[Workable] Upload error:', e);
    }
  }

  function simulateInput(el, value) {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function sendMsg(msg) { return new Promise(r => chrome.runtime.sendMessage(msg, r)); }
})();
