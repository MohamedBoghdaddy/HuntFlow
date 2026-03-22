// Indeed content script — scraper + Easily Apply automation

(function () {
  'use strict';

  let profile = null;
  let settings = null;

  Promise.all([
    sendMessage({ type: 'GET_PROFILE' }),
    sendMessage({ type: 'GET_SETTINGS' })
  ]).then(([p, s]) => {
    profile = p;
    settings = s;
    init();
  });

  function init() {
    window.addEventListener('JAA_SCRAPE', scrapeJobs);
    if (isSearchPage()) scrapeJobs();
    if (isJobPage()) handleJobPage();
  }

  function isSearchPage() {
    return /indeed\.com\/jobs/.test(window.location.href) ||
      document.querySelector('.jobsearch-ResultsList') !== null;
  }

  function isJobPage() {
    return /indeed\.com\/viewjob/.test(window.location.href) ||
      document.querySelector('.jobsearch-ViewJobLayout') !== null;
  }

  async function scrapeJobs() {
    await waitFor('.jobsearch-ResultsList li, .resultContent', 5000);
    const cards = document.querySelectorAll('.resultContent, .jobsearch-ResultsList > li');
    const jobs = [];

    cards.forEach(card => {
      try {
        const titleEl = card.querySelector('[data-testid="jobTitle"], h2 a, .jobTitle a');
        const companyEl = card.querySelector('[data-testid="company-name"], .companyName');
        const locationEl = card.querySelector('[data-testid="text-location"], .companyLocation');
        const linkEl = card.querySelector('a[href*="indeed.com/rc/clk"], a[href*="/viewjob"]');
        const easyApplyEl = card.querySelector('[class*="indeedApplyButton"], [data-tn-element="indeedApplyButton"]');

        if (!titleEl) return;

        const href = linkEl?.href || '';
        const jk = href.match(/jk=([a-f0-9]+)/)?.[1] || Date.now().toString();

        jobs.push({
          id: `indeed-${jk}`,
          platform: 'indeed',
          title: titleEl.textContent.trim(),
          company: companyEl?.textContent.trim() || '',
          location: locationEl?.textContent.trim() || '',
          url: href,
          applyUrl: href,
          easyApply: !!easyApplyEl,
          externalApply: !easyApplyEl,
          scrapedAt: new Date().toISOString()
        });
      } catch (e) {}
    });

    if (jobs.length > 0) {
      sendMessage({ type: 'JOBS_SCRAPED', jobs });
      console.log(`[Indeed] Scraped ${jobs.length} jobs`);
    }
  }

  async function handleJobPage() {
    const pending = await getPendingApply();
    if (!pending) return;

    const easyApplyBtn = document.querySelector('[id*="indeedApplyButton"], .indeed-apply-button, button[data-indeed-apply]');
    const applyBtn = document.querySelector('.jobsearch-IndeedApplyButton-newDesign, a[href*="apply"]');

    if (easyApplyBtn && settings?.applyEasyApply) {
      await delay(1000 + Math.random() * 1500);
      easyApplyBtn.click();
      await delay(2000);
      await fillIndeedApplication();
    } else if (applyBtn && settings?.applyExternal) {
      await delay(1000);
      applyBtn.click();
    }

    chrome.storage.local.remove('pendingApply');
  }

  async function fillIndeedApplication() {
    if (!profile) return;
    const modal = document.querySelector('.ia-BasePage, .ia-container, [class*="indeed-apply"]');
    if (!modal) return;

    let maxSteps = 8;
    while (maxSteps-- > 0) {
      await fillStep(modal);
      await delay(600 + Math.random() * 600);

      const continueBtn = modal.querySelector('button[data-testid="submit-button"], button[type="submit"]');
      if (!continueBtn) break;

      const btnText = continueBtn.textContent.trim().toLowerCase();
      if (btnText.includes('submit') || btnText.includes('apply')) {
        continueBtn.click();
        console.log('[Indeed] Application submitted!');
        sendMessage({
          type: 'JOB_APPLIED',
          job: {
            id: `indeed-${Date.now()}`,
            platform: 'indeed',
            title: document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent.trim(),
            company: document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent.trim(),
            url: window.location.href,
            easyApply: true
          }
        });
        break;
      }
      continueBtn.click();
    }
  }

  async function fillStep(container) {
    const inputs = container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    for (const input of inputs) {
      if (input.value && input.tagName !== 'SELECT') continue;
      const label = getLabel(input).toLowerCase();
      const value = getValueForLabel(label, input.tagName === 'TEXTAREA');
      if (value !== null) {
        simulateInput(input, String(value));
        await delay(100);
      }
    }
  }

  function getValueForLabel(label, isTextarea) {
    if (!profile) return null;
    if (label.includes('first')) return profile.firstName;
    if (label.includes('last')) return profile.lastName;
    if (label.includes('email')) return profile.email;
    if (label.includes('phone')) return profile.phone;
    if (label.includes('city') || label.includes('location')) return profile.city;
    if (label.includes('resume') || label.includes('cv')) return null; // file handled separately
    if (isTextarea && label.includes('cover')) return profile.coverLetterTemplate || '';
    if (label.includes('years') || label.includes('experience')) return String(profile.yearsExperience || '3');
    if (label.includes('salary')) return String(profile.expectedSalary || '');
    return null;
  }

  function simulateInput(el, value) {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getLabel(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    return el.placeholder || el.name || '';
  }

  function getPendingApply() {
    return new Promise(r => chrome.storage.local.get('pendingApply', d => r(d.pendingApply)));
  }

  function waitFor(selector, timeout = 5000) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) return resolve();
      const obs = new MutationObserver(() => {
        if (document.querySelector(selector)) { obs.disconnect(); resolve(); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
    });
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function sendMessage(msg) { return new Promise(r => chrome.runtime.sendMessage(msg, r)); }
})();
