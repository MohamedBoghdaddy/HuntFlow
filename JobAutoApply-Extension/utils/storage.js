// Centralized Chrome storage helper

export const Storage = {
  async get(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  },

  async set(data) {
    return new Promise((resolve) => chrome.storage.local.set(data, resolve));
  },

  async getProfile() {
    const data = await this.get('userProfile');
    return data.userProfile || null;
  },

  async setProfile(profile) {
    return this.set({ userProfile: profile });
  },

  async getSettings() {
    const data = await this.get('settings');
    return data.settings || {
      autoApply: false,
      applyEasyApply: true,
      applyExternal: true,
      delayMin: 3,
      delayMax: 8,
      maxDailyApps: 50,
      aiModel: 'gpt-4o',
      openaiKey: '',
      geminiKey: '',
      captchaService: 'ai', // 'ai' | 'anticaptcha' | 'manual'
      antiCaptchaKey: '',
      blacklistedCompanies: [],
      requiredKeywords: [],
      jobBoards: {
        linkedin: true,
        indeed: true,
        greenhouse: true,
        lever: true,
        workday: true,
        icims: true,
        workable: true,
        jobright: true,
        wttj: true,
        ashby: true,
        recruitee: true,
        glassdoor: true,
        weworkremotely: true,
        remoteok: true,
        wellfound: true,
      }
    };
  },

  async setSettings(settings) {
    return this.set({ settings });
  },

  async getAppliedJobs() {
    const data = await this.get('appliedJobs');
    return data.appliedJobs || [];
  },

  async addAppliedJob(job) {
    const applied = await this.getAppliedJobs();
    applied.push({ ...job, appliedAt: new Date().toISOString() });
    return this.set({ appliedJobs: applied });
  },

  async getScrapedJobs() {
    const data = await this.get('scrapedJobs');
    return data.scrapedJobs || [];
  },

  async setScrapedJobs(jobs) {
    return this.set({ scrapedJobs: jobs });
  },

  async addScrapedJobs(newJobs) {
    const existing = await this.getScrapedJobs();
    const existingIds = new Set(existing.map(j => j.id));
    const unique = newJobs.filter(j => !existingIds.has(j.id));
    return this.set({ scrapedJobs: [...existing, ...unique] });
  },

  async getDailyCount() {
    const data = await this.get('dailyCount');
    const today = new Date().toDateString();
    if (!data.dailyCount || data.dailyCount.date !== today) {
      return { date: today, count: 0 };
    }
    return data.dailyCount;
  },

  async incrementDailyCount() {
    const count = await this.getDailyCount();
    count.count++;
    return this.set({ dailyCount: count });
  }
};
