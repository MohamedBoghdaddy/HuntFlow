// iCIMS ATS content script

(function () {
  'use strict';

  let profile = null;

  sendMsg({ type: 'GET_PROFILE' }).then(p => {
    profile = p;
    init();
  });

  function init() {
    window.addEventListener('JAA_SCRAPE', scrapeJob);
    if (isJobPage()) scrapeJob();
    if (isApplicationPage()) fillApplication();
  }

  function isJobPage() {
    return document.querySelector('.iCIMS_JobsTable, .iCIMS_Header') !== null;
  }

  function isApplicationPage() {
    return document.querySelector('#iCIMS_Content, .iCIMS_ApplicationForm') !== null &&
      document.querySelector('input[id*="icims"]') !== null;
  }

  function scrapeJob() {
    const rows = document.querySelectorAll('.iCIMS_JobsTable tr, .iCIMS_Expandable_Job');
    const jobs = [];
    const company = document.querySelector('.iCIMS_CompanyHeader')?.textContent.trim() || window.location.hostname;

    rows.forEach(row => {
      const titleEl = row.querySelector('a[href*="iCIMS"]') || row.querySelector('td a');
      if (!titleEl) return;
      const url = titleEl.href;
      const id = url.match(/[?&]jobID=(\d+)/)?.[1] || url;

      jobs.push({
        id: `icims-${id}`,
        platform: 'icims',
        title: titleEl.textContent.trim(),
        company,
        location: row.querySelector('td:nth-child(2)')?.textContent.trim() || '',
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
    await delay(800);

    const fieldMap = {
      'firstName': profile.firstName,
      'lastName': profile.lastName,
      'email1': profile.email,
      'email2': profile.email,
      'phone1': profile.phone,
      'address1': profile.address,
      'city1': profile.city,
      'postalCode1': profile.zipCode,
    };

    Object.entries(fieldMap).forEach(([key, val]) => {
      if (!val) return;
      const el = document.querySelector(`input[id*="${key}"], input[name*="${key}"]`);
      if (el && !el.value) simulateInput(el, val);
    });

    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(ta => {
      if (!ta.value && profile.coverLetterTemplate) {
        simulateInput(ta, profile.coverLetterTemplate);
      }
    });
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
