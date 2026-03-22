// backend/src/services/pythonAiService.js
import axios from "axios";

const PY_BASE =
  process.env.PY_API_URL ||
  process.env.PYTHON_AI_URL ||
  process.env.VITE_PY_API_URL ||
  "http://127.0.0.1:8000";

const py = axios.create({
  baseURL: PY_BASE,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

// ---------- helpers ----------
function prettyFastApiError(err) {
  const status = err?.response?.status || 500;
  const data = err?.response?.data;

  let msg = err?.message || "Python AI request failed";

  if (typeof data?.detail === "string") {
    msg = data.detail;
  } else if (Array.isArray(data?.detail)) {
    msg = data.detail
      .map((e) => `${(e.loc || []).join(".")}: ${e.msg || e.type || "invalid"}`)
      .join(" | ");
  } else if (data?.detail && typeof data.detail === "object") {
    msg = JSON.stringify(data.detail);
  } else if (data?.error) {
    msg = String(data.error);
  }

  const e = new Error(msg);
  e.status = status;
  e.meta = data;
  return e;
}

// ---------- CV endpoints (match FastAPI routes) ----------

export async function cvAtsScore({ cv_text, job_description }) {
  try {
    const res = await py.post("/cv/ats-score", {
      cv_text: String(cv_text || ""),
      job_description: String(job_description || ""),
    });
    return res.data;
  } catch (err) {
    throw prettyFastApiError(err);
  }
}

export async function cvEnhance({ cv_text, job_description }) {
  try {
    const res = await py.post("/cv/enhance", {
      cv_text: String(cv_text || ""),
      job_description: String(job_description || ""),
    });
    return res.data;
  } catch (err) {
    throw prettyFastApiError(err);
  }
}

export async function cvBuildResume({
  user_profile,
  target_role,
  target_market,
}) {
  try {
    const res = await py.post("/cv/resume", {
      user_profile:
        user_profile && typeof user_profile === "object" ? user_profile : {},
      target_role: String(target_role || ""),
      target_market: String(target_market || ""),
    });
    return res.data;
  } catch (err) {
    throw prettyFastApiError(err);
  }
}

/**
 * /cv/coach expects: { messages: [...] }
 * We'll accept either:
 * - messages (already formatted)
 * - or { profile, cv_text } and we convert them into a message list
 */
export async function cvCoach({ messages, profile, cv_text, prompt }) {
  try {
    const finalMessages =
      Array.isArray(messages) && messages.length
        ? messages
        : [
            {
              role: "system",
              content:
                "You are a career coach. Provide practical, specific advice based on the user's CV and profile.",
            },
            {
              role: "user",
              content: `Profile:\n${JSON.stringify(profile || {}, null, 2)}\n\nCV:\n${String(
                cv_text || "",
              ).slice(
                0,
                12000,
              )}\n\nRequest:\n${String(prompt || "Give me feedback and next steps.")}`,
            },
          ];

    const res = await py.post("/cv/coach", { messages: finalMessages });
    return res.data; // TextResponse -> { text: "..." } typically
  } catch (err) {
    throw prettyFastApiError(err);
  }
}

// ---------- Apply endpoint (match /apply routes) ----------
export async function applyToJobs({ jobs, applicant }) {
  try {
    const res = await py.post("/apply/", { jobs, applicant });
    return res.data; // { message, task_id }
  } catch (err) {
    throw prettyFastApiError(err);
  }
}

// ---------- CV match-jobs endpoint ----------
export async function cvMatchJobs({ cv_text, jobs }) {
  try {
    const res = await py.post("/cv/match-jobs", {
      cv_text: String(cv_text || ""),
      jobs: Array.isArray(jobs) ? jobs : [],
    });
    return res.data; // { jobs: [..., match_score, match_percent] }
  } catch (err) {
    throw prettyFastApiError(err);
  }
}

// ---------- CV cover-letter endpoint ----------
export async function cvCoverLetter({ cv_text, job_title, company, job_description }) {
  try {
    const res = await py.post("/cv/cover-letter", {
      cv_text: String(cv_text || ""),
      job_title: String(job_title || ""),
      company: String(company || ""),
      job_description: String(job_description || ""),
    });
    return res.data; // { cover_letter: "..." }
  } catch (err) {
    throw prettyFastApiError(err);
  }
}

// ---------- Multi-search endpoint ----------
export async function jobsMultiSearch({ query, where, limit, min_results, providers } = {}) {
  try {
    const res = await py.post("/jobs/multi-search", {
      query: String(query || ""),
      where: where || null,
      limit: limit || 20,
      min_results: min_results || null,
      providers: providers || null,
    });
    return res.data; // { jobs: [...], total: N }
  } catch (err) {
    throw prettyFastApiError(err);
  }
}

// Default export if you still import the client elsewhere
export default py;
