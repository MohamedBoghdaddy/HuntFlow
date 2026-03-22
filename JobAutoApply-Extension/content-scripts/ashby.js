// Ashby HQ content script — scraper + autofill

(function () {
  'use strict';

  let profile = null;
  sendMsg({ type: 'GET_PROFILE' }).then(p => { profile = p; init(); });

  function init() {
    window.addEventListener('JAA_SCRAPE', scrapeJobs);
    if (document.querySelector('[class*="JobList"], [data-testid*="job"]')) scrapeJobs();
    if (document.querySelector('form[action*="apply"], [class*="ApplicationForm"]')) fillApplication();
  }

  function scrapeJobs() {
    const items = document.querySelectorAll('[class*="JobListItem"], [data-testid*="job-item"], ul[class*="job"] li');
    const jobs = [];
    const company = document.querySelector('h1, [class*="CompanyName"]')?.textContent.trim() || '';

    items.forEach(item => {
      const titleEl = item.querySelector('a, h3, h2');
      if (!titleEl) return;
      const url = titleEl.href || window.location.href;
      const id = url.split('/').pop() || Date.now().toString();

      jobs.push({
        id: `ashby-${id}`,
        platform: 'ashby',
        title: titleEl.textContent.trim(),
        company,
        location: item.querySelector('[class*="location"], [class*="Location"]')?.textContent.trim() || '',
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
    await delay(700);

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]), textarea');
    inputs.forEach(el => {
      const label = getLabel(el).toLowerCase();
      const val = getVal(label, el.tagName === 'TEXTAREA');
      if (val && !el.value) simulateInput(el, val);
    });

    const resume = document.querySelector('input[type="file"][accept*="pdf"]');
    if (resume && profile.resumeDataUrl) uploadFile(resume, profile.resumeDataUrl, profile.resumeFileName || 'resume.pdf');
  }

  function getVal(label, isTA) {
    if (!profile) return null;
    if (label.includes('first')) return profile.firstName;
    if (label.includes('last')) return profile.lastName;
    if (label.includes('email')) return profile.email;
    if (label.includes('phone')) return profile.phone;
    if (label.includes('linkedin')) return profile.linkedin;
    if (label.includes('github')) return profile.github;
    if (label.includes('website') || label.includes('portfolio')) return profile.portfolio;
    if (isTA) return profile.coverLetterTemplate || '';
    return null;
  }

  async function uploadFile(input, dataUrl, fileName) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
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
