// JobRight.ai content script — scraper

(function () {
  'use strict';

  window.addEventListener('JAA_SCRAPE', scrapeJobs);
  if (document.readyState === 'complete') scrapeJobs();
  else window.addEventListener('load', scrapeJobs);

  async function scrapeJobs() {
    await waitFor('.job-card, [class*="JobCard"], [data-testid="job-card"]', 5000);

    const cards = document.querySelectorAll('.job-card, [class*="JobCard"], [data-testid="job-card"]');
    const jobs = [];

    cards.forEach(card => {
      const titleEl = card.querySelector('h2, h3, [class*="title"]');
      const companyEl = card.querySelector('[class*="company"], [class*="Company"]');
      const locationEl = card.querySelector('[class*="location"], [class*="Location"]');
      const linkEl = card.querySelector('a[href*="/job/"]') || card.querySelector('a');

      if (!titleEl) return;
      const url = linkEl?.href || window.location.href;
      const id = url.match(/\/job\/([a-z0-9-]+)/i)?.[1] || Date.now().toString();

      jobs.push({
        id: `jobright-${id}`,
        platform: 'jobright',
        title: titleEl.textContent.trim(),
        company: companyEl?.textContent.trim() || '',
        location: locationEl?.textContent.trim() || '',
        url,
        applyUrl: url,
        easyApply: !!card.querySelector('[class*="easyApply"], [class*="easy-apply"]'),
        externalApply: true,
        scrapedAt: new Date().toISOString()
      });
    });

    if (jobs.length) {
      chrome.runtime.sendMessage({ type: 'JOBS_SCRAPED', jobs });
      console.log(`[JobRight] Scraped ${jobs.length} jobs`);
    }
  }

  function waitFor(selector, timeout) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) return resolve();
      const obs = new MutationObserver(() => {
        if (document.querySelector(selector)) { obs.disconnect(); resolve(); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
    });
  }
})();
