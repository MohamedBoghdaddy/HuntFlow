// Background service worker — orchestrates scraping, auto-apply, messaging

import { Storage } from '../utils/storage.js';

// Message router
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case 'SCRAPE_JOBS':
          await handleScrapeJobs(msg.board, sender.tab);
          sendResponse({ ok: true });
          break;

        case 'JOBS_SCRAPED':
          await Storage.addScrapedJobs(msg.jobs);
          chrome.runtime.sendMessage({ type: 'JOBS_UPDATED', count: msg.jobs.length }).catch(() => {});
          sendResponse({ ok: true });
          break;

        case 'JOB_APPLIED':
          await Storage.addAppliedJob(msg.job);
          await Storage.incrementDailyCount();
          chrome.runtime.sendMessage({ type: 'APPLIED_UPDATE', job: msg.job }).catch(() => {});
          sendResponse({ ok: true });
          break;

        case 'GET_PROFILE':
          sendResponse(await Storage.getProfile());
          break;

        case 'GET_SETTINGS':
          sendResponse(await Storage.getSettings());
          break;

        case 'GET_STATS':
          sendResponse({
            scraped: (await Storage.getScrapedJobs()).length,
            applied: (await Storage.getAppliedJobs()).length,
            dailyCount: await Storage.getDailyCount()
          });
          break;

        case 'CLEAR_SCRAPED':
          await Storage.setScrapedJobs([]);
          sendResponse({ ok: true });
          break;

        case 'CAPTCHA_NEEDED':
          // Notify popup that captcha needs attention
          chrome.runtime.sendMessage({ type: 'CAPTCHA_ALERT', tabId: sender.tab?.id }).catch(() => {});
          sendResponse({ ok: true });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (e) {
      console.error('[SW] Error handling message:', msg.type, e);
      sendResponse({ error: e.message });
    }
  })();
  return true; // keep channel open for async
});

// Auto-apply alarm: triggers every minute to process job queue
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auto-apply-tick') {
    await processAutoApplyQueue();
  }
});

async function handleScrapeJobs(board, tab) {
  // Inject scraper into current tab
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.dispatchEvent(new CustomEvent('JAA_SCRAPE'));
    }
  });
}

async function processAutoApplyQueue() {
  const settings = await Storage.getSettings();
  if (!settings.autoApply) return;

  const dailyCount = await Storage.getDailyCount();
  if (dailyCount.count >= settings.maxDailyApps) {
    console.log('[SW] Daily limit reached:', dailyCount.count);
    return;
  }

  const jobs = await Storage.getScrapedJobs();
  const applied = await Storage.getAppliedJobs();
  const appliedIds = new Set(applied.map(j => j.id));

  const pending = jobs.filter(j =>
    !appliedIds.has(j.id) &&
    (j.easyApply || j.externalApply) &&
    !isBlacklisted(j, settings)
  );

  if (pending.length === 0) return;

  const next = pending[0];
  console.log('[SW] Auto-applying to:', next.title, 'at', next.company);

  // Open the job in a new tab
  chrome.tabs.create({ url: next.applyUrl || next.url, active: false }, (tab) => {
    // Content script will handle application after page loads
    chrome.storage.local.set({ pendingApply: next });
  });
}

function isBlacklisted(job, settings) {
  const bl = settings.blacklistedCompanies || [];
  return bl.some(c => job.company?.toLowerCase().includes(c.toLowerCase()));
}

// Start alarm when extension loads
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('auto-apply-tick', { periodInMinutes: 1 });
  console.log('[SW] JobAutoApply extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('auto-apply-tick', { periodInMinutes: 1 });
});
