// Workday ATS content script — autofill for complex Workday applications

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
    observePageChanges();
    fillIfApplicationPage();
  }

  function observePageChanges() {
    const observer = new MutationObserver(() => {
      fillIfApplicationPage();
      scrapeJobIfListing();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
  }

  function scrapeJobIfListing() {
    const jobCards = document.querySelectorAll('[data-automation-id="jobItem"], .WGTY, li[class*="job"]');
    if (jobCards.length === 0) return;

    const jobs = [];
    const company = document.title.split('|').pop().trim() || window.location.hostname;

    jobCards.forEach(card => {
      const titleEl = card.querySelector('[data-automation-id="jobTitle"], a[data-automation-id]');
      const locationEl = card.querySelector('[data-automation-id="location"], .WIJK');
      const linkEl = card.querySelector('a[href*="job/"]');

      if (!titleEl) return;

      const url = linkEl?.href || window.location.href;
      const id = url.match(/job\/([A-Z0-9_]+)/)?.[1] || Date.now().toString();

      jobs.push({
        id: `workday-${id}`,
        platform: 'workday',
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
    }
  }

  function scrapeJob() { scrapeJobIfListing(); }

  async function fillIfApplicationPage() {
    const isAppPage = document.querySelector(
      '[data-automation-id="legalNameSection"], ' +
      '[data-automation-id="contactInformationPage"], ' +
      '[data-automation-id="resumeSection"]'
    );
    if (!isAppPage || !profile) return;

    await delay(1000);
    await fillWorkdayForm();
  }

  async function fillWorkdayForm() {
    console.log('[Workday] Filling Workday application...');

    // Workday uses React internally — we need to trigger synthetic events
    const fieldMappings = [
      { selector: '[data-automation-id="legalNameSection"] input[data-automation-id*="firstName"]', value: profile.firstName },
      { selector: '[data-automation-id="legalNameSection"] input[data-automation-id*="lastName"]', value: profile.lastName },
      { selector: 'input[data-automation-id*="email"]', value: profile.email },
      { selector: 'input[data-automation-id*="phone"]', value: profile.phone },
      { selector: 'input[data-automation-id*="address"]', value: profile.address },
      { selector: 'input[data-automation-id*="city"]', value: profile.city },
      { selector: 'input[data-automation-id*="postalCode"], input[data-automation-id*="zipCode"]', value: profile.zipCode },
      { selector: 'input[data-automation-id*="linkedIn"]', value: profile.linkedin },
    ];

    for (const { selector, value } of fieldMappings) {
      if (!value) continue;
      const el = document.querySelector(selector);
      if (el && !el.value) {
        await fillWorkdayInput(el, value);
        await delay(300);
      }
    }

    // Handle "How did you hear about us" dropdown
    const sourceDropdown = document.querySelector('[data-automation-id*="howDidYouHear"] button, [data-automation-id*="source"] button');
    if (sourceDropdown) {
      sourceDropdown.click();
      await delay(500);
      const linkedInOption = document.querySelector('[data-automation-id="promptOption"][data-value*="LinkedIn"], li[data-value*="LinkedIn"]');
      if (linkedInOption) linkedInOption.click();
    }

    // Upload resume
    const resumeBtn = document.querySelector('button[data-automation-id*="resumeUpload"], [data-automation-id="resumeSection"] input[type="file"]');
    if (resumeBtn && profile.resumeDataUrl) {
      if (resumeBtn.tagName === 'INPUT') {
        await uploadFile(resumeBtn, profile.resumeDataUrl, profile.resumeFileName || 'resume.pdf');
      }
    }
  }

  async function fillWorkdayInput(el, value) {
    // Workday uses React synthetic events
    el.focus();
    el.click();
    await delay(100);

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    el.blur();
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
      console.warn('[Workday] File upload error:', e);
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function sendMsg(msg) { return new Promise(r => chrome.runtime.sendMessage(msg, r)); }
})();
