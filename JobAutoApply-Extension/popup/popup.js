// Popup controller

const BOARDS = [
  'linkedin', 'indeed', 'greenhouse', 'lever', 'workday',
  'icims', 'workable', 'jobright', 'wttj', 'ashby',
  'recruitee', 'glassdoor', 'weworkremotely', 'remoteok', 'wellfound'
];

let settings = null;
let jobs = [];
let appliedIds = new Set();

async function init() {
  settings = await sendMsg({ type: 'GET_SETTINGS' });
  const stats = await sendMsg({ type: 'GET_STATS' });
  const profile = await sendMsg({ type: 'GET_PROFILE' });
  jobs = (await getStorage('scrapedJobs')) || [];
  const applied = (await getStorage('appliedJobs')) || [];
  appliedIds = new Set(applied.map(j => j.id));

  renderStats(stats);
  renderToggles();
  renderBoards();
  renderJobs();
  renderProfile(profile);
  bindEvents();

  // Listen for updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'JOBS_UPDATED' || msg.type === 'APPLIED_UPDATE') {
      refreshData();
    }
    if (msg.type === 'CAPTCHA_ALERT') {
      document.getElementById('captchaAlert').classList.remove('hidden');
    }
  });
}

function renderStats(stats) {
  document.getElementById('scrapedCount').textContent = stats.scraped || 0;
  document.getElementById('appliedCount').textContent = stats.applied || 0;
  document.getElementById('dailyCount').textContent = stats.dailyCount?.count || 0;
}

function renderToggles() {
  document.getElementById('autoApplyToggle').checked = settings?.autoApply || false;
  document.getElementById('easyApplyToggle').checked = settings?.applyEasyApply !== false;
  document.getElementById('externalApplyToggle').checked = settings?.applyExternal !== false;
}

function renderBoards() {
  const grid = document.getElementById('boardsGrid');
  grid.innerHTML = BOARDS.map(board => `
    <span class="board-tag ${settings?.jobBoards?.[board] !== false ? 'active' : ''}" data-board="${board}">
      ${board}
    </span>
  `).join('');
}

function renderJobs() {
  const list = document.getElementById('jobsList');
  if (!jobs.length) {
    list.innerHTML = '<div class="empty-state">No jobs scraped yet. Browse a job board to start.</div>';
    return;
  }

  const recent = jobs.slice(-30).reverse();
  list.innerHTML = recent.map(job => `
    <div class="job-item">
      <div class="job-info">
        <div class="job-title" title="${job.title}">${job.title}</div>
        <div class="job-meta">${job.company} · ${job.platform}</div>
      </div>
      <span class="job-badge ${appliedIds.has(job.id) ? 'badge-applied' : job.easyApply ? 'badge-easy' : 'badge-external'}">
        ${appliedIds.has(job.id) ? 'Applied' : job.easyApply ? 'Easy' : 'External'}
      </span>
    </div>
  `).join('');
}

function renderProfile(profile) {
  const text = document.getElementById('profileText');
  const btn = document.getElementById('editProfileBtn');

  if (profile?.firstName) {
    text.textContent = `${profile.firstName} ${profile.lastName} · ${profile.email}`;
    btn.textContent = 'Edit profile →';
  } else {
    text.textContent = 'No profile configured';
    btn.textContent = 'Set up profile →';
  }
}

function bindEvents() {
  // Toggles
  document.getElementById('autoApplyToggle').addEventListener('change', (e) => {
    settings.autoApply = e.target.checked;
    saveSettings();
  });
  document.getElementById('easyApplyToggle').addEventListener('change', (e) => {
    settings.applyEasyApply = e.target.checked;
    saveSettings();
  });
  document.getElementById('externalApplyToggle').addEventListener('change', (e) => {
    settings.applyExternal = e.target.checked;
    saveSettings();
  });

  // Board toggles
  document.getElementById('boardsGrid').addEventListener('click', (e) => {
    const tag = e.target.closest('.board-tag');
    if (!tag) return;
    const board = tag.dataset.board;
    settings.jobBoards = settings.jobBoards || {};
    settings.jobBoards[board] = !tag.classList.contains('active');
    tag.classList.toggle('active');
    saveSettings();
  });

  // Scrape button
  document.getElementById('scrapeBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE' });
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.dispatchEvent(new CustomEvent('JAA_SCRAPE'))
      });
      document.getElementById('scrapeBtn').textContent = '⏳ Scraping...';
      setTimeout(() => {
        document.getElementById('scrapeBtn').textContent = '🔍 Scrape This Page';
        refreshData();
      }, 3000);
    }
  });

  // Fill button
  document.getElementById('fillBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.dispatchEvent(new CustomEvent('JAA_FILL'))
      });
    }
  });

  // Clear jobs
  document.getElementById('clearJobsBtn').addEventListener('click', async () => {
    await sendMsg({ type: 'CLEAR_SCRAPED' });
    jobs = [];
    renderJobs();
    document.getElementById('scrapedCount').textContent = '0';
  });

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Profile
  document.getElementById('editProfileBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

async function refreshData() {
  const stats = await sendMsg({ type: 'GET_STATS' });
  jobs = (await getStorage('scrapedJobs')) || [];
  const applied = (await getStorage('appliedJobs')) || [];
  appliedIds = new Set(applied.map(j => j.id));
  renderStats(stats);
  renderJobs();
}

async function saveSettings() {
  chrome.storage.local.set({ settings });
}

function sendMsg(msg) {
  return new Promise(r => chrome.runtime.sendMessage(msg, r));
}

function getStorage(key) {
  return new Promise(r => chrome.storage.local.get(key, d => r(d[key])));
}

document.addEventListener('DOMContentLoaded', init);
