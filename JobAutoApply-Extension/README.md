# JobAutoApply Chrome Extension

AI-powered job application automation for 15+ job boards.

## Features

- **Job Scraping**: LinkedIn, Indeed, Greenhouse, Lever, Workday, iCIMS, Workable, JobRight, WTTJ, Ashby, Recruitee, Glassdoor, WeWorkRemotely, RemoteOK, Wellfound
- **Easy Apply Automation**: Full LinkedIn Easy Apply flow, Indeed Easy Apply
- **External Apply Autofill**: Auto-fills forms on Greenhouse, Lever, Workday, iCIMS, Workable, Ashby, Recruitee, WTTJ
- **AI CAPTCHA Bypass**: GPT-4o vision, Google Gemini, AntiCaptcha service support
- **Smart Form Filling**: AI-powered question answering, cover letter generation
- **Daily Limits**: Configurable max applications per day
- **Resume Upload**: Auto-uploads PDF resume to application forms

## Installation

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `JobAutoApply-Extension`

### Generate Icons (one-time)
Open `lib/icon-generator.html` in Chrome, download the 4 icon files, place them in `icons/`

## Setup

1. Click the extension icon → Settings (⚙️)
2. Fill in **Profile** tab — your name, email, phone, etc.
3. Upload your **Resume** in the Resume tab
4. Add your **OpenAI API key** in AI & Captcha tab
5. Configure **Automation** preferences

## Usage

### Scrape Jobs
- Browse to LinkedIn Jobs, Indeed, or any supported board
- Click **Scrape This Page** in the popup
- Jobs appear in the popup list

### Auto Apply
1. Enable **Auto Apply** toggle in popup
2. Extension will automatically:
   - Queue scraped jobs
   - Open Easy Apply jobs and complete the flow
   - Open External apply pages and autofill them
3. Monitor progress in the popup stats

### Manual Fill
- Navigate to any supported application form
- Click **Fill Form** in the popup
- Extension fills all detected fields

## Supported Platforms

| Platform | Scrape | Easy Apply | External Autofill |
|----------|--------|-----------|-------------------|
| LinkedIn | ✅ | ✅ | - |
| Indeed | ✅ | ✅ | - |
| Greenhouse | ✅ | - | ✅ |
| Lever | ✅ | - | ✅ |
| Workday | ✅ | - | ✅ |
| iCIMS | ✅ | - | ✅ |
| Workable | ✅ | - | ✅ |
| JobRight | ✅ | - | ✅ |
| WTTJ | ✅ | - | ✅ |
| Ashby | ✅ | - | ✅ |
| Recruitee | ✅ | - | ✅ |

## CAPTCHA Bypass

| Type | Method |
|------|--------|
| Text CAPTCHA | GPT-4o Vision / Gemini |
| reCAPTCHA v2 | AntiCaptcha Service / Audio bypass |
| hCaptcha | AntiCaptcha Service |
| Cloudflare Turnstile | Auto-wait (usually auto-solves) |
| Image Selection | GPT-4o multi-image analysis |

## Privacy

- All data stored locally in Chrome storage
- Resume and profile never leave your device (except when uploading to apply)
- API keys stored locally, only used for AI calls

## Tech Stack

- Manifest V3 Chrome Extension
- Vanilla JavaScript (no build step required)
- OpenAI GPT-4o API
- Google Gemini API
- AntiCaptcha API
