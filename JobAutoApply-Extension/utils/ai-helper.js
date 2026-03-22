// AI helper — OpenAI & Gemini integrations for cover letters, answers, captcha solving

export class AIHelper {
  constructor(settings) {
    this.settings = settings;
  }

  // Generate a tailored cover letter for a job
  async generateCoverLetter(jobTitle, company, jobDescription, userProfile) {
    const prompt = `Write a concise, professional cover letter for this job application.

Candidate:
- Name: ${userProfile.firstName} ${userProfile.lastName}
- Current Role: ${userProfile.currentTitle || 'Professional'}
- Skills: ${(userProfile.skills || []).join(', ')}
- Years of Experience: ${userProfile.yearsExperience || ''}
- Summary: ${userProfile.summary || ''}

Job:
- Title: ${jobTitle}
- Company: ${company}
- Description: ${jobDescription.substring(0, 1000)}

Write a 3-paragraph cover letter. Be specific, confident, and concise. No generic phrases.`;

    return this._callOpenAI(prompt, 500);
  }

  // Answer a specific application question using AI
  async answerQuestion(question, jobContext, userProfile) {
    const lowerQ = question.toLowerCase();

    // Try rule-based first (fast, no API cost)
    const ruleAnswer = this._ruleBasedAnswer(lowerQ, userProfile);
    if (ruleAnswer !== null) return ruleAnswer;

    const prompt = `You are filling out a job application for: ${jobContext.title} at ${jobContext.company}.

Candidate profile:
${JSON.stringify(userProfile, null, 2)}

Application question: "${question}"

Provide a concise, honest, professional answer. If it's a yes/no question, answer yes or no only. If numeric, provide only a number.`;

    return this._callOpenAI(prompt, 150);
  }

  // Solve a CAPTCHA image using GPT-4o vision
  async solveCaptchaImage(base64Image, instructions = '') {
    if (!this.settings.openaiKey) return null;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: instructions || 'This is a CAPTCHA image. Please read and return ONLY the text/characters shown. No explanation.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }],
          max_tokens: 50,
          temperature: 0
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      console.error('[AI] captcha vision error:', e);
      return null;
    }
  }

  // Solve image selection CAPTCHA (click on X, select all images with Y)
  async solveImageSelectionCaptcha(base64Images, instruction) {
    if (!this.settings.openaiKey) return null;

    const content = [
      { type: 'text', text: `CAPTCHA task: "${instruction}". For each image below, reply with a comma-separated list of image indices (0-based) that match the instruction. Only indices, no explanation.` }
    ];

    base64Images.forEach((img, i) => {
      content.push({ type: 'text', text: `Image ${i}:` });
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${img}`, detail: 'low' }
      });
    });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content }],
          max_tokens: 30,
          temperature: 0
        })
      });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      return text.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    } catch (e) {
      console.error('[AI] image selection captcha error:', e);
      return null;
    }
  }

  // Gemini fallback for captcha solving
  async solveCaptchaWithGemini(base64Image) {
    if (!this.settings.geminiKey) return null;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.settings.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: 'Read this CAPTCHA image and return ONLY the text/characters shown. No explanation.' },
                { inline_data: { mime_type: 'image/png', data: base64Image } }
              ]
            }],
            generationConfig: { maxOutputTokens: 30, temperature: 0 }
          })
        }
      );
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (e) {
      console.error('[AI] Gemini captcha error:', e);
      return null;
    }
  }

  _ruleBasedAnswer(question, profile) {
    if (question.includes('years of experience') || question.includes('how many years')) {
      return String(profile.yearsExperience || '3');
    }
    if (question.includes('authorized to work') || question.includes('work authorization')) {
      return profile.workAuthorized !== false ? 'Yes' : 'No';
    }
    if (question.includes('require sponsorship') || question.includes('visa sponsorship')) {
      return profile.requiresSponsorship ? 'Yes' : 'No';
    }
    if (question.includes('salary') || question.includes('compensation')) {
      return profile.expectedSalary || '80000';
    }
    if (question.includes('remote') || question.includes('work from home')) {
      return profile.openToRemote !== false ? 'Yes' : 'No';
    }
    if (question.includes('start date') || question.includes('available to start')) {
      return profile.availableDate || '2 weeks';
    }
    if (question.includes('phone') || question.includes('mobile')) {
      return profile.phone || '';
    }
    if (question.includes('linkedin')) {
      return profile.linkedin || '';
    }
    if (question.includes('github') || question.includes('portfolio')) {
      return profile.github || profile.portfolio || '';
    }
    return null;
  }

  async _callOpenAI(prompt, maxTokens = 300) {
    if (!this.settings.openaiKey) {
      console.warn('[AI] No OpenAI key configured');
      return null;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.openaiKey}`
        },
        body: JSON.stringify({
          model: this.settings.aiModel || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.7
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      console.error('[AI] OpenAI call failed:', e);
      return null;
    }
  }
}
