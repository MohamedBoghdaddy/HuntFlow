// LinkedIn content script — scraper + Easy Apply automation

(function () {
  'use strict';

  let profile = null;
  let settings = null;
  let isApplying = false;

  // Initialize
  Promise.all([
    sendMessage({ type: 'GET_PROFILE' }),
    sendMessage({ type: 'GET_SETTINGS' })
  ]).then(([p, s]) => {
    profile = p;
    settings = s;
    init();
  });

  function init() {
    if (isJobSearchPage()) {
      scrapeJobListings();
      if (settings?.autoApply) {
        startAutoApply();
      }
    }
    if (isJobDetailPage()) {
      handleJobDetailPage();
    }
    // Listen for manual scrape trigger
    window.addEventListener('JAA_SCRAPE', () => scrapeJobListings());
  }

  // ─── Scraper ────────────────────────────────────────────────────────────────

  function isJobSearchPage() {
    return window.location.href.includes('/jobs/search') ||
      window.location.href.includes('/jobs/collections') ||
      document.querySelector('.jobs-search-results-list') !== null;
  }

  function isJobDetailPage() {
    return window.location.href.includes('/jobs/view/') ||
      document.querySelector('.jobs-unified-top-card') !== null;
  }

  async function scrapeJobListings() {
    console.log('[LinkedIn] Scraping job listings...');
    await waitFor('.jobs-search-results__list-item, .job-card-container', 5000);

    const cards = document.querySelectorAll('.jobs-search-results__list-item, .job-card-container');
    const jobs = [];

    cards.forEach(card => {
      try {
        const job = extractJobFromCard(card);
        if (job) jobs.push(job);
      } catch (e) {
        console.warn('[LinkedIn] Error extracting job card:', e);
      }
    });

    if (jobs.length > 0) {
      sendMessage({ type: 'JOBS_SCRAPED', jobs });
      console.log(`[LinkedIn] Scraped ${jobs.length} jobs`);
    }

    // Auto-scroll and load more
    if (settings?.autoApply) {
      await loadMoreJobs();
    }
  }

  function extractJobFromCard(card) {
    const titleEl = card.querySelector('.job-card-list__title, .jobs-unified-top-card__job-title a, a[data-tracking-control-name*="job_card"]');
    const companyEl = card.querySelector('.job-card-container__company-name, .artdeco-entity-lockup__subtitle');
    const locationEl = card.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption');
    const linkEl = card.querySelector('a[href*="/jobs/view/"]');
    const easyApplyBadge = card.querySelector('.job-card-container__apply-method');

    if (!titleEl || !linkEl) return null;

    const url = linkEl.href.split('?')[0];
    const jobId = url.match(/\/jobs\/view\/(\d+)/)?.[1];
    if (!jobId) return null;

    return {
      id: `linkedin-${jobId}`,
      platform: 'linkedin',
      title: titleEl.textContent.trim(),
      company: companyEl?.textContent.trim() || '',
      location: locationEl?.textContent.trim() || '',
      url,
      applyUrl: url,
      easyApply: easyApplyBadge?.textContent.toLowerCase().includes('easy apply') ?? false,
      externalApply: !easyApplyBadge?.textContent.toLowerCase().includes('easy apply'),
      scrapedAt: new Date().toISOString()
    };
  }

  async function loadMoreJobs() {
    const maxScrolls = 5;
    for (let i = 0; i < maxScrolls; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await delay(2000);
      const cards = document.querySelectorAll('.jobs-search-results__list-item');
      console.log(`[LinkedIn] After scroll ${i + 1}: ${cards.length} cards`);
    }
    await scrapeJobListings();
  }

  // ─── Auto Apply ─────────────────────────────────────────────────────────────

  async function startAutoApply() {
    const cards = document.querySelectorAll('.jobs-search-results__list-item');
    for (const card of cards) {
      if (isApplying) break;
      const easyApplyBtn = card.querySelector('[aria-label*="Easy Apply"]');
      if (easyApplyBtn) {
        await clickCard(card);
        await delay(1500);
        await applyEasyApply();
      }
    }
  }

  async function handleJobDetailPage() {
    const pendingApply = await new Promise(r =>
      chrome.storage.local.get('pendingApply', d => r(d.pendingApply))
    );

    if (!pendingApply) return;

    const easyApplyBtn = document.querySelector('.jobs-apply-button[aria-label*="Easy Apply"]');
    const applyBtn = document.querySelector('.jobs-apply-button:not([aria-label*="Easy Apply"])');

    if (easyApplyBtn && settings?.applyEasyApply) {
      await delay(1000 + Math.random() * 2000);
      easyApplyBtn.click();
      await delay(1500);
      await applyEasyApply();
    } else if (applyBtn && settings?.applyExternal) {
      await delay(1000 + Math.random() * 2000);
      applyBtn.click();
      // External application opens in new tab — handled by target platform script
    }

    chrome.storage.local.remove('pendingApply');
  }

  async function applyEasyApply() {
    if (isApplying) return;
    isApplying = true;

    try {
      console.log('[LinkedIn] Starting Easy Apply flow...');

      // Wait for modal
      await waitFor('.jobs-easy-apply-modal, .jobs-easy-apply-content', 5000);

      let maxSteps = 10;
      while (maxSteps-- > 0) {
        await fillCurrentStep();
        await delay(800 + Math.random() * 800);

        const nextBtn = getNextButton();
        const submitBtn = getSubmitButton();
        const reviewBtn = document.querySelector('[aria-label*="Review"], button[aria-label*="Review"]');

        if (submitBtn) {
          await delay(500);
          submitBtn.click();
          console.log('[LinkedIn] Submitted application!');
          await delay(2000);

          const jobTitle = document.querySelector('.jobs-unified-top-card__job-title')?.textContent.trim();
          const company = document.querySelector('.jobs-unified-top-card__company-name')?.textContent.trim();

          sendMessage({
            type: 'JOB_APPLIED',
            job: {
              id: `linkedin-${Date.now()}`,
              platform: 'linkedin',
              title: jobTitle,
              company,
              url: window.location.href,
              easyApply: true
            }
          });

          // Close modal
          const closeBtn = document.querySelector('[data-test-modal-close-btn], button[aria-label="Dismiss"]');
          if (closeBtn) closeBtn.click();

          break;
        } else if (reviewBtn) {
          reviewBtn.click();
        } else if (nextBtn) {
          nextBtn.click();
        } else {
          console.log('[LinkedIn] No navigation button found');
          break;
        }
      }
    } catch (e) {
      console.error('[LinkedIn] Easy Apply error:', e);
    } finally {
      isApplying = false;
    }
  }

  async function fillCurrentStep() {
    const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content');
    if (!modal || !profile) return;

    const inputs = modal.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea, select');

    for (const input of inputs) {
      try {
        await fillInput(input);
        await delay(100 + Math.random() * 200);
      } catch (e) {
        console.warn('[LinkedIn] Error filling input:', e);
      }
    }

    // Upload resume if file input present
    const fileInput = modal.querySelector('input[type="file"][accept*="pdf"], input[type="file"][accept*=".doc"]');
    if (fileInput && profile.resumeDataUrl) {
      await uploadResume(fileInput, profile.resumeDataUrl, profile.resumeFileName);
    }
  }

  async function fillInput(el) {
    const label = getLabel(el).toLowerCase();
    const tag = el.tagName.toLowerCase();
    const type = el.type?.toLowerCase() || '';

    if (el.value && el.value.trim() && tag !== 'select') return;

    let value = null;

    if (label.includes('phone') || label.includes('mobile')) value = profile.phone;
    else if (label.includes('first name')) value = profile.firstName;
    else if (label.includes('last name')) value = profile.lastName;
    else if (label.includes('email')) value = profile.email;
    else if (label.includes('city') || label.includes('location')) value = profile.city;
    else if (label.includes('linkedin')) value = profile.linkedin;
    else if (label.includes('website') || label.includes('portfolio')) value = profile.portfolio;
    else if (label.includes('github')) value = profile.github;
    else if (label.includes('salary') || label.includes('compensation')) value = String(profile.expectedSalary || '');
    else if (label.includes('years') && label.includes('experience')) value = String(profile.yearsExperience || '3');
    else if (label.includes('hear about') || label.includes('how did you')) value = 'LinkedIn';

    if (tag === 'select' && value) {
      setSelectValue(el, value);
    } else if (type === 'radio') {
      handleRadioGroup(el, label);
    } else if (value !== null && value !== undefined) {
      simulateInput(el, String(value));
    }
  }

  function getNextButton() {
    return document.querySelector(
      'button[aria-label="Continue to next step"], ' +
      'button[aria-label*="Next"], ' +
      '.artdeco-button--primary[aria-label*="next" i]'
    );
  }

  function getSubmitButton() {
    return document.querySelector(
      'button[aria-label="Submit application"], ' +
      'button[aria-label*="Submit"] '
    );
  }

  async function clickCard(card) {
    const link = card.querySelector('a[href*="/jobs/view/"]');
    if (link) link.click();
    await delay(1500);
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  function simulateInput(el, value) {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setSelectValue(el, value) {
    const option = Array.from(el.options).find(o =>
      o.text.toLowerCase().includes(value.toLowerCase())
    );
    if (option) {
      el.value = option.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function handleRadioGroup(el, label) {
    // Yes/No questions — default to Yes unless it's about needing sponsorship
    if (label.includes('sponsorship') || label.includes('require visa')) {
      if (el.value === 'No') {
        el.click();
      }
    } else if (el.value === 'Yes' || el.value === 'yes') {
      el.click();
    }
  }

  async function uploadResume(input, dataUrl, fileName) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName || 'resume.pdf', { type: 'application/pdf' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[LinkedIn] Resume uploaded');
    } catch (e) {
      console.warn('[LinkedIn] Resume upload failed:', e);
    }
  }

  function getLabel(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent.trim();
    }
    const parent = el.closest('[class*="form-field"], [class*="fb-form"]');
    if (parent) {
      const labelEl = parent.querySelector('label, legend');
      if (labelEl) return labelEl.textContent.trim();
    }
    return el.placeholder || el.name || '';
  }

  function waitFor(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(selector)) return resolve();
      const obs = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          obs.disconnect();
          resolve();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
    });
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function sendMessage(msg) {
    return new Promise(r => chrome.runtime.sendMessage(msg, r));
  }
})();
