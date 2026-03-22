// Recruitee content script — scraper + autofill

(function () {
  'use strict';

  let profile = null;
  sendMsg({ type: 'GET_PROFILE' }).then(p => { profile = p; init(); });

  function init() {
    window.addEventListener('JAA_SCRAPE', scrapeJobs);
    if (document.querySelector('.job-offers, [class*="JobList"]')) scrapeJobs();
    if (document.querySelector('.application-form, [class*="ApplicationForm"]')) fillApplication();
  }

  function scrapeJobs() {
    const items = document.querySelectorAll('.job-offer, li[class*="job"]');
    const jobs = [];
    const company = document.querySelector('h1, .company-name')?.textContent.trim() || '';

    items.forEach(item => {
      const titleEl = item.querySelector('a h2, a h3, .job-title a, a');
      if (!titleEl) return;
      const linkEl = item.querySelector('a');
      const url = linkEl?.href || window.location.href;
      const id = url.split('/').filter(Boolean).pop() || Date.now().toString();

      jobs.push({
        id: `recruitee-${id}`,
        platform: 'recruitee',
        title: titleEl.textContent.trim(),
        company,
        location: item.querySelector('.job-location, [class*="location"]')?.textContent.trim() || '',
        url,
        applyUrl: url,
        easyApply: true,
        externalApply: false,
        scrapedAt: new Date().toISOString()
      });
    });

    if (jobs.length) sendMsg({ type: 'JOBS_SCRAPED', jobs });
  }

  async function fillApplication() {
    if (!profile) return;
    await delay(600);

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    inputs.forEach(el => {
      const label = getLabel(el).toLowerCase();
      const val = getVal(label, el.tagName === 'TEXTAREA');
      if (val && !el.value) simulateInput(el, val);
    });
  }

  function getVal(label, isTA) {
    if (!profile) return null;
    if (label.includes('first') || label.includes('name')) return profile.firstName;
    if (label.includes('last')) return profile.lastName;
    if (label.includes('email')) return profile.email;
    if (label.includes('phone')) return profile.phone;
    if (label.includes('linkedin')) return profile.linkedin;
    if (isTA) return profile.coverLetterTemplate || '';
    return null;
  }

  function simulateInput(el, value) {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getLabel(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.id) { const l = document.querySelector(`label[for="${el.id}"]`); if (l) return l.textContent; }
    return el.placeholder || el.name || '';
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function sendMsg(msg) { return new Promise(r => chrome.runtime.sendMessage(msg, r)); }
})();
