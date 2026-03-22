// Welcome to the Jungle (WTTJ) content script — scraper + autofill

(function () {
  'use strict';

  let profile = null;
  sendMsg({ type: 'GET_PROFILE' }).then(p => { profile = p; init(); });

  function init() {
    window.addEventListener('JAA_SCRAPE', scrapeJobs);
    if (document.querySelector('[data-testid="job-search-results"], .ais-InfiniteHits')) scrapeJobs();
    if (document.querySelector('form[action*="/apply"], .application-form')) fillApplication();
  }

  function scrapeJobs() {
    const cards = document.querySelectorAll('[data-testid="job-card"], .ais-InfiniteHits-item, article[class*="job"]');
    const jobs = [];

    cards.forEach(card => {
      const titleEl = card.querySelector('h3, h2, [data-testid="job-title"]');
      const companyEl = card.querySelector('[data-testid="company-name"], [class*="company"]');
      const locationEl = card.querySelector('[data-testid="job-location"], [class*="location"]');
      const linkEl = card.querySelector('a[href*="/jobs/"]') || card.querySelector('a');

      if (!titleEl) return;
      const url = linkEl?.href || '';
      const id = url.match(/\/jobs\/([a-z0-9-]+)/i)?.[1] || Date.now().toString();

      jobs.push({
        id: `wttj-${id}`,
        platform: 'wttj',
        title: titleEl.textContent.trim(),
        company: companyEl?.textContent.trim() || '',
        location: locationEl?.textContent.trim() || '',
        url,
        applyUrl: url,
        easyApply: false,
        externalApply: true,
        scrapedAt: new Date().toISOString()
      });
    });

    if (jobs.length) sendMsg({ type: 'JOBS_SCRAPED', jobs });
    console.log(`[WTTJ] Scraped ${jobs.length} jobs`);
  }

  async function fillApplication() {
    if (!profile) return;
    await delay(600);

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    inputs.forEach(el => {
      const label = getLabel(el).toLowerCase();
      const value = getLabelValue(label, el.tagName === 'TEXTAREA');
      if (value && !el.value) simulateInput(el, String(value));
    });
  }

  function getLabelValue(label, isTextarea) {
    if (!profile) return null;
    if (label.includes('first') || label.includes('prenom')) return profile.firstName;
    if (label.includes('last') || label.includes('nom')) return profile.lastName;
    if (label.includes('email')) return profile.email;
    if (label.includes('phone') || label.includes('telephone')) return profile.phone;
    if (label.includes('linkedin')) return profile.linkedin;
    if (isTextarea) return profile.coverLetterTemplate || '';
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
