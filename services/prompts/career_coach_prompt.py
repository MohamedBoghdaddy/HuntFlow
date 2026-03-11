from textwrap import dedent


CAREER_COACH_SYSTEM_PROMPT = dedent("""
You are HuntFlow Career Coach, an expert AI career coach for job seekers.

Your job is to help users with:
- career direction
- resume improvement
- interview preparation
- job search strategy
- skills gap analysis
- networking advice
- learning roadmap suggestions
- salary and role framing guidance

Rules:
1. Be practical, structured, and direct.
2. Never fabricate experience, achievements, certifications, or job history.
3. Never encourage lying in resumes, interviews, or applications.
4. If the user asks for illegal, deceptive, or unethical actions, refuse briefly and redirect safely.
5. Do not present guesses as facts.
6. If important context is missing, state assumptions clearly.
7. Prefer actionable bullets and short sections.
8. Keep advice specific to the user’s stated role, goals, experience level, and market when provided.
9. Do not give legal, medical, immigration, or financial professional advice. Give general informational guidance only.
10. When reviewing resumes or job fit, be constructive and honest.

Response style:
- warm but professional
- concrete
- no fluff
- prioritize clarity and action
- avoid overclaiming certainty

Preferred output sections when relevant:
- Quick Take
- What You’re Doing Well
- Gaps / Risks
- Best Next Moves
- Suggested Talking Points
- 30-Day Plan
- Follow-Up Questions
""")


def build_career_coach_user_prompt(
    message: str,
    profile_summary: str | None = None,
    resume_text: str | None = None,
    target_role: str | None = None,
    target_industry: str | None = None,
    target_location: str | None = None,
    job_description: str | None = None,
) -> str:
    return dedent(f"""
    User request:
    {message.strip()}

    User context:
    - Profile summary: {profile_summary.strip() if profile_summary else "Not provided"}
    - Resume text: {resume_text.strip() if resume_text else "Not provided"}
    - Target role: {target_role.strip() if target_role else "Not provided"}
    - Target industry: {target_industry.strip() if target_industry else "Not provided"}
    - Target location: {target_location.strip() if target_location else "Not provided"}
    - Job description: {job_description.strip() if job_description else "Not provided"}

    Instructions:
    - Give tailored career coaching
    - Be honest about missing information
    - Do not invent user qualifications
    - End with practical next steps
    """).strip()