// Options page controller

async function init() {
  const profile = (await getStorage('userProfile')) || {};
  const settings = (await getStorage('settings')) || {};

  // Profile fields
  const profileFields = [
    'firstName', 'lastName', 'email', 'phone', 'city', 'state',
    'zipCode', 'country', 'address', 'currentTitle', 'currentCompany',
    'yearsExperience', 'expectedSalary', 'linkedin', 'github', 'portfolio',
    'summary', 'availableDate', 'coverLetterTemplate'
  ];

  profileFields.forEach(id => {
    const el = document.getElementById(id);
    if (el && profile[id] !== undefined) el.value = profile[id];
  });

  if (profile.skills) {
    document.getElementById('skills').value = Array.isArray(profile.skills)
      ? profile.skills.join(', ')
      : profile.skills;
  }

  setToggle('workAuthorized', profile.workAuthorized !== false);
  setToggle('openToRemote', profile.openToRemote !== false);

  // Settings fields
  setValue('openaiKey', settings.openaiKey);
  setValue('geminiKey', settings.geminiKey);
  setValue('aiModel', settings.aiModel || 'gpt-4o');
  setValue('antiCaptchaKey', settings.antiCaptchaKey);
  setValue('maxDailyApps', settings.maxDailyApps || 50);
  setValue('delayMin', settings.delayMin || 5);
  setValue('coverLetterTemplate', settings.coverLetterTemplate || profile.coverLetterTemplate || '');

  setToggle('autoApply', settings.autoApply || false);
  setToggle('applyEasyApply', settings.applyEasyApply !== false);
  setToggle('applyExternal', settings.applyExternal !== false);

  // Captcha service
  const captchaService = settings.captchaService || 'ai';
  const radio = document.querySelector(`input[name="captchaService"][value="${captchaService}"]`);
  if (radio) radio.checked = true;

  if (settings.blacklistedCompanies) {
    setValue('blacklistedCompanies', settings.blacklistedCompanies.join(', '));
  }
  if (settings.requiredKeywords) {
    setValue('requiredKeywords', settings.requiredKeywords.join(', '));
  }

  // Resume stored
  if (profile.resumeFileName) {
    document.getElementById('resumeFileName2').value = profile.resumeFileName;
    document.getElementById('resumeFileName').textContent = '✓ ' + profile.resumeFileName;
  }

  bindEvents();
}

function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // Resume upload
  document.getElementById('resumeUploadArea').addEventListener('click', () => {
    document.getElementById('resumeFile').click();
  });
  document.getElementById('resumeFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    await chrome.storage.local.set({
      'userProfile.resumeDataUrl': dataUrl,
      'userProfile.resumeFileName': file.name
    });
    document.getElementById('resumeFileName').textContent = '✓ ' + file.name;
    document.getElementById('resumeFileName2').value = file.name;
    // Store in profile
    const profile = (await getStorage('userProfile')) || {};
    profile.resumeDataUrl = dataUrl;
    profile.resumeFileName = file.name;
    await chrome.storage.local.set({ userProfile: profile });
  });

  // Cover letter upload
  document.getElementById('coverUploadArea').addEventListener('click', () => {
    document.getElementById('coverFile').click();
  });
  document.getElementById('coverFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const profile = (await getStorage('userProfile')) || {};
    profile.coverLetterDataUrl = dataUrl;
    await chrome.storage.local.set({ userProfile: profile });
    document.getElementById('coverFileName').textContent = '✓ ' + file.name;
  });

  // Save
  document.getElementById('saveBtn').addEventListener('click', save);
}

async function save() {
  // Gather profile
  const profile = (await getStorage('userProfile')) || {};

  const textFields = [
    'firstName', 'lastName', 'email', 'phone', 'city', 'state',
    'zipCode', 'country', 'address', 'currentTitle', 'currentCompany',
    'linkedin', 'github', 'portfolio', 'summary', 'availableDate'
  ];
  textFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) profile[id] = el.value.trim();
  });

  profile.yearsExperience = parseInt(getValue('yearsExperience')) || 0;
  profile.expectedSalary = parseInt(getValue('expectedSalary')) || 0;
  profile.skills = getValue('skills').split(',').map(s => s.trim()).filter(Boolean);
  profile.workAuthorized = document.getElementById('workAuthorized').checked;
  profile.openToRemote = document.getElementById('openToRemote').checked;
  profile.coverLetterTemplate = getValue('coverLetterTemplate');
  profile.resumeFileName = getValue('resumeFileName2') || profile.resumeFileName;

  // Gather settings
  const settings = (await getStorage('settings')) || {};
  settings.openaiKey = getValue('openaiKey');
  settings.geminiKey = getValue('geminiKey');
  settings.aiModel = getValue('aiModel');
  settings.antiCaptchaKey = getValue('antiCaptchaKey');
  settings.captchaService = document.querySelector('input[name="captchaService"]:checked')?.value || 'ai';
  settings.maxDailyApps = parseInt(getValue('maxDailyApps')) || 50;
  settings.delayMin = parseInt(getValue('delayMin')) || 5;
  settings.autoApply = document.getElementById('autoApply').checked;
  settings.applyEasyApply = document.getElementById('applyEasyApply').checked;
  settings.applyExternal = document.getElementById('applyExternal').checked;
  settings.coverLetterTemplate = profile.coverLetterTemplate;

  const blCompanies = getValue('blacklistedCompanies');
  settings.blacklistedCompanies = blCompanies ? blCompanies.split(',').map(s => s.trim()).filter(Boolean) : [];
  const keywords = getValue('requiredKeywords');
  settings.requiredKeywords = keywords ? keywords.split(',').map(s => s.trim()).filter(Boolean) : [];

  await chrome.storage.local.set({ userProfile: profile, settings });

  const msg = document.getElementById('saveMsg');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function getValue(id) {
  return document.getElementById(id)?.value || '';
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.value = value;
}

function setToggle(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = value;
}

function getStorage(key) {
  return new Promise(r => chrome.storage.local.get(key, d => r(d[key])));
}

document.addEventListener('DOMContentLoaded', init);
