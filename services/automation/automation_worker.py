"""
automation_worker.py
====================
Production‑ready job application automation with:
- Pluggable CAPTCHA solvers (2captcha / Anti‑Captcha) with fallback.
- Site‑specific scraping rules (customisable selectors).
- Support for Lever, Workday, and Greenhouse ATS APIs (placeholders).
- Headless mode toggle (for debugging).
- Rate limiting and retries between applications.
- Fallback email when automated apply fails.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import random
import time
from dataclasses import dataclass, field
from typing import Iterable, Optional, Dict, Any, Callable, Awaitable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# CAPTCHA solver libraries (install conditionally)
try:
    from twocaptcha import TwoCaptcha
except ImportError:
    TwoCaptcha = None

try:
    import python_anticaptcha as anticaptcha
except ImportError:
    anticaptcha = None

# -------------------- Configuration & Logging --------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# -------------------- Helper: Retry Decorator --------------------
async def with_retries(func: Callable, tries: int = 3, base_delay_s: float = 2,
                       max_delay_s: float = 30, on_retry: Optional[Callable] = None):
    """Retry an async function with exponential backoff."""
    for attempt in range(tries):
        try:
            return await func()
        except Exception as e:
            if attempt == tries - 1:
                raise
            delay = min(base_delay_s * (2 ** attempt) + random.uniform(0, 1), max_delay_s)
            if on_retry:
                on_retry(attempt + 1, e, delay)
            await asyncio.sleep(delay)


# -------------------- Rate Limiter --------------------
@dataclass
class RateLimitPolicy:
    min_delay_s: float
    max_delay_s: float
    jitter_s: float = 0


class RateLimiter:
    """Per‑domain rate limiter with jitter."""
    def __init__(self, default_policy: RateLimitPolicy, policies: Dict[str, RateLimitPolicy]):
        self.default_policy = default_policy
        self.policies = policies
        self.last_request_time: Dict[str, float] = {}

    async def wait(self, url: str):
        """Wait appropriate delay for the domain extracted from url."""
        domain = self._extract_domain(url)
        policy = self.policies.get(domain, self.default_policy)
        now = time.time()
        last = self.last_request_time.get(domain, 0)
        elapsed = now - last
        delay = random.uniform(policy.min_delay_s, policy.max_delay_s) + random.uniform(-policy.jitter_s, policy.jitter_s)
        delay = max(0, delay - elapsed)
        if delay > 0:
            logger.debug(f"Rate limiting {domain}: waiting {delay:.2f}s")
            await asyncio.sleep(delay)
        self.last_request_time[domain] = time.time()

    @staticmethod
    def _extract_domain(url: str) -> str:
        from urllib.parse import urlparse
        return urlparse(url).netloc or "unknown"


# -------------------- CAPTCHA Solver (Multi‑Provider) --------------------
class CaptchaSolver:
    """
    Unified interface for CAPTCHA solving services.
    Supports 2captcha and Anti‑Captcha. Falls back to the next available provider.
    """
    PROVIDERS = {
        "2captcha": {
            "module": TwoCaptcha,
            "env_key": "TWOCAPTCHA_API_KEY",
            "methods": {
                "image": lambda s, img: s.normal(img),
                "recaptcha_v2": lambda s, sitekey, url: s.recaptcha(sitekey=sitekey, url=url),
                "recaptcha_v3": lambda s, sitekey, url, action: s.recaptcha(sitekey=sitekey, url=url, version='v3', action=action),
            }
        },
        "anticaptcha": {
            "module": anticaptcha,
            "env_key": "ANTICAPTCHA_API_KEY",
            "methods": {
                "image": lambda s, img: s.ImageToTextTask(img).solve(),
                "recaptcha_v2": lambda s, sitekey, url: s.NoCaptchaTaskProxylessTask(websiteURL=url, websiteKey=sitekey).solve(),
                "recaptcha_v3": lambda s, sitekey, url, action: s.NoCaptchaTaskProxylessTask(websiteURL=url, websiteKey=sitekey, isEnterprise=False).solve(),
            }
        }
    }

    def __init__(self):
        self.solvers = []
        for name, cfg in self.PROVIDERS.items():
            if cfg["module"] is None:
                continue
            api_key = os.getenv(cfg["env_key"])
            if api_key:
                try:
                    solver = cfg["module"](api_key)
                    self.solvers.append((name, solver, cfg["methods"]))
                    logger.info(f"Initialised {name} CAPTCHA solver.")
                except Exception as e:
                    logger.warning(f"Failed to initialise {name}: {e}")

        if not self.solvers:
            logger.warning("No CAPTCHA solver available – CAPTCHA solving will be disabled.")

    def _try_method(self, method_name: str, *args, **kwargs):
        """Try each solver in order until one succeeds."""
        for name, solver, methods in self.solvers:
            if method_name not in methods:
                continue
            try:
                result = methods[method_name](solver, *args, **kwargs)
                if result:
                    logger.info(f"CAPTCHA solved using {name}.")
                    return result
            except Exception as e:
                logger.debug(f"{name} failed for {method_name}: {e}")
        return None

    def solve_image(self, image_bytes: bytes) -> Optional[str]:
        return self._try_method("image", image_bytes)

    def solve_recaptcha_v2(self, site_key: str, url: str) -> Optional[str]:
        return self._try_method("recaptcha_v2", site_key, url)

    def solve_recaptcha_v3(self, site_key: str, url: str, action: str = "verify") -> Optional[str]:
        return self._try_method("recaptcha_v3", site_key, url, action)


# -------------------- Data Classes --------------------
@dataclass
class Applicant:
    first_name: str
    last_name: str
    email: str
    phone: str
    resume: Optional[str] = None          # path to résumé file
    cover_letter: Optional[str] = None


@dataclass
class JobDetails:
    location: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    hiring_manager_name: Optional[str] = None
    hiring_manager_email: Optional[str] = None


@dataclass
class Job:
    title: str
    company: str
    posting_url: Optional[str] = None
    apply_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    ats: Optional[dict] = None             # e.g., {"type": "Greenhouse", "boardToken": "...", "jobId": "..."}
    details: JobDetails = field(default_factory=JobDetails)
    site: Optional[str] = None              # e.g., "linkedin", "indeed" – used for scraping rules


# -------------------- Site‑Specific Scraping Rules --------------------
SCRAPING_RULES = {
    "linkedin": {
        "location": {"selector": ".job-details-jobs-unified-top-card__job-location", "type": "css"},
        "salary": {"selector": ".job-details-jobs-unified-top-card__job-insight", "type": "css"},
        "description": {"selector": ".description__text", "type": "css"},
        "hiring_manager": {"selector": "a[href*='mailto:']", "type": "css", "attribute": "href"},
    },
    "indeed": {
        "location": {"selector": '[data-testid="job-location"]', "type": "css"},
        "salary": {"selector": '[data-testid="job-salary"]', "type": "css"},
        "description": {"selector": '#jobDescriptionText', "type": "css"},
        "hiring_manager": {"selector": 'a[href^="mailto:"]', "type": "css", "attribute": "href"},
    },
    "greenhouse": {
        "location": {"selector": ".location", "type": "css"},
        "salary": {"selector": ".salary", "type": "css"},
        "description": {"selector": ".description", "type": "css"},
        "hiring_manager": {"selector": 'a[href^="mailto:"]', "type": "css", "attribute": "href"},
    },
    None: {
        "location": {"selector": re.compile(r"Location[:\s]+([^\n,.]+)", re.I), "type": "regex"},
        "salary": {"selector": re.compile(r"\$[0-9,]+(?:\s*-\s*\$[0-9,]+)?"), "type": "regex"},
        "description": {"selector": "div.description, div.job-detail", "type": "css"},
        "hiring_manager": {"selector": 'a[href^="mailto:"]', "type": "css", "attribute": "href"},
    }
}


def extract_by_rule(soup: BeautifulSoup, rule: dict) -> Optional[str]:
    """Extract text using a rule (CSS, regex, etc.)."""
    selector = rule["selector"]
    rule_type = rule.get("type", "css")
    attr = rule.get("attribute")

    if rule_type == "css":
        elem = soup.select_one(selector)
        if elem:
            return elem.get_text(strip=True) if not attr else elem.get(attr)
    elif rule_type == "regex":
        match = selector.search(soup.get_text())
        if match:
            return match.group(1) if match.groups() else match.group()
    return None


# -------------------- Automation Worker Class --------------------
class AutomationWorker:
    def __init__(self, limiter: Optional[RateLimiter] = None, captcha_solver: Optional[CaptchaSolver] = None):
        self.limiter = limiter or RateLimiter(
            default_policy=RateLimitPolicy(min_delay_s=8, max_delay_s=18, jitter_s=3),
            policies={
                "boards.greenhouse.io": RateLimitPolicy(min_delay_s=10, max_delay_s=25, jitter_s=4),
                "remoteok.com": RateLimitPolicy(min_delay_s=6, max_delay_s=14, jitter_s=2),
                "remotive.io": RateLimitPolicy(min_delay_s=4, max_delay_s=10, jitter_s=1),
                "smtp": RateLimitPolicy(min_delay_s=5, max_delay_s=12, jitter_s=2),
            }
        )
        self.captcha_solver = captcha_solver or CaptchaSolver()
        self.headless = os.getenv("HEADLESS", "true").lower() != "false"

    # ---------- Job Detail Scraping ----------
    async def scrape_job_details(self, job: Job) -> JobDetails:
        """Use Selenium + BeautifulSoup to extract details based on job.site."""
        if not job.posting_url:
            return JobDetails()

        await self.limiter.wait(job.posting_url)

        options = webdriver.ChromeOptions()
        if self.headless:
            options.add_argument("--headless")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        details = JobDetails()

        try:
            logger.info(f"Scraping job details from {job.posting_url}")
            driver.get(job.posting_url)
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            soup = BeautifulSoup(driver.page_source, "html.parser")

            rules = SCRAPING_RULES.get(job.site, SCRAPING_RULES[None])

            details.location = extract_by_rule(soup, rules["location"])
            details.salary = extract_by_rule(soup, rules["salary"])
            details.description = extract_by_rule(soup, rules["description"])

            hr_email = extract_by_rule(soup, rules["hiring_manager"])
            if hr_email and hr_email.startswith("mailto:"):
                hr_email = hr_email[7:]
            details.hiring_manager_email = hr_email

            if rules["hiring_manager"]["type"] == "css":
                elem = soup.select_one(rules["hiring_manager"]["selector"])
                if elem:
                    details.hiring_manager_name = elem.get_text(strip=True)

            logger.info(f"Extracted details: {details}")
        except Exception as e:
            logger.error(f"Error scraping job details: {e}")
        finally:
            driver.quit()

        return details

    # ---------- CAPTCHA Handling ----------
    def handle_captcha(self, driver: webdriver.Chrome, url: str) -> bool:
        """Detect and attempt to solve CAPTCHA on the current page."""
        # 1. reCAPTCHA v2
        try:
            recaptcha_iframe = driver.find_element(By.CSS_SELECTOR, "iframe[src*='recaptcha']")
            src = recaptcha_iframe.get_attribute("src")
            site_key_match = re.search(r"k=([^&]+)", src)
            if site_key_match:
                site_key = site_key_match.group(1)
                logger.info("reCAPTCHA v2 detected. Solving...")
                captcha_code = self.captcha_solver.solve_recaptcha_v2(site_key, url)
                if captcha_code:
                    driver.execute_script("""
                        document.getElementById('g-recaptcha-response').innerHTML = arguments[0];
                        document.getElementById('g-recaptcha-response').style.display = 'block';
                    """, captcha_code)
                    driver.execute_script("""
                        if (typeof ___grecaptcha_cfg !== 'undefined') {
                            for (let i in ___grecaptcha_cfg.clients) {
                                ___grecaptcha_cfg.clients[i].callback(arguments[0]);
                            }
                        }
                    """, captcha_code)
                    logger.info("reCAPTCHA solved.")
                    return True
        except Exception:
            pass

        # 2. Image CAPTCHA
        try:
            captcha_img = driver.find_element(By.XPATH, "//img[contains(@src, 'captcha')]")
            img_bytes = captcha_img.screenshot_as_png
            logger.info("Image CAPTCHA detected. Solving...")
            code = self.captcha_solver.solve_image(img_bytes)
            if code:
                input_field = driver.find_element(By.XPATH, "//input[@type='text' and contains(@name, 'captcha')]")
                input_field.clear()
                input_field.send_keys(code)
                submit_btn = driver.find_element(By.XPATH, "//button[@type='submit' or contains(text(), 'Verify')]")
                submit_btn.click()
                logger.info("Image CAPTCHA solved.")
                return True
        except Exception:
            pass

        return False

    # ---------- Form Filling ----------
    async def fill_form_with_selenium(self, job: Job, applicant: Applicant) -> bool:
        """Submit application using Selenium. Handles CAPTCHA if present."""
        if not job.apply_url:
            return False

        await self.limiter.wait(job.apply_url)

        options = webdriver.ChromeOptions()
        if self.headless:
            options.add_argument("--headless")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

        try:
            logger.info(f"Navigating to application URL: {job.apply_url}")
            driver.get(job.apply_url)
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))

            # CAPTCHA check
            page_text = driver.page_source.lower()
            captcha_keywords = ["captcha", "recaptcha", "i am not a robot"]
            if any(k in page_text for k in captcha_keywords):
                logger.warning("CAPTCHA detected. Attempting to solve...")
                solved = self.handle_captcha(driver, job.apply_url)
                if not solved:
                    logger.error("CAPTCHA could not be solved automatically.")
                    return False
                logger.info("CAPTCHA solved, continuing.")

            # Wait for form
            try:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "form")))
            except Exception:
                logger.error("No form found on page.")
                return False

            # Fill fields
            self._fill_field(driver, ["firstName", "first_name", "fname", "first"], applicant.first_name)
            self._fill_field(driver, ["lastName", "last_name", "lname", "last"], applicant.last_name)
            self._fill_field(driver, ["email", "e-mail", "userEmail"], applicant.email)
            self._fill_field(driver, ["phone", "telephone", "mobile", "phoneNumber"], applicant.phone)

            if applicant.resume:
                try:
                    file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
                    file_input.send_keys(applicant.resume)
                    logger.info("Resume uploaded.")
                except Exception:
                    logger.warning("Could not find file input for resume.")

            if applicant.cover_letter:
                self._fill_field(driver, ["coverLetter", "cover_letter", "cover"], applicant.cover_letter, tag="textarea")

            # Submit
            submit_button = self._find_submit_button(driver)
            if submit_button:
                submit_button.click()
                try:
                    WebDriverWait(driver, 10).until(EC.staleness_of(submit_button))
                except Exception:
                    pass
                logger.info(f"Application submitted for {job.title} at {job.company}")
                return True
            else:
                logger.error("No submit button found.")
                return False

        except Exception as e:
            logger.error(f"Error during Selenium automation: {e}")
            return False
        finally:
            driver.quit()

    @staticmethod
    def _fill_field(driver: webdriver.Chrome, possible_names: list, value: str, tag: str = "input"):
        for name in possible_names:
            try:
                elem = driver.find_element(By.NAME, name)
                elem.clear()
                elem.send_keys(value)
                return
            except Exception:
                pass
            try:
                elem = driver.find_element(By.ID, name)
                elem.clear()
                elem.send_keys(value)
                return
            except Exception:
                pass
            try:
                elem = driver.find_element(By.XPATH, f"//{tag}[@placeholder='{name}' or contains(@placeholder, '{name}')]")
                elem.clear()
                elem.send_keys(value)
                return
            except Exception:
                pass
        logger.warning(f"Could not fill field for any of {possible_names}")

    @staticmethod
    def _find_submit_button(driver: webdriver.Chrome):
        xpath_options = [
            "//button[@type='submit']",
            "//input[@type='submit']",
            "//button[contains(text(), 'Submit')]",
            "//button[contains(text(), 'Apply')]",
            "//button[contains(text(), 'Send')]",
            "//button[contains(@class, 'submit')]",
            "//input[contains(@class, 'submit')]",
        ]
        for xpath in xpath_options:
            try:
                return driver.find_element(By.XPATH, xpath)
            except Exception:
                pass
        return None

    # ---------- Fallback Email ----------
    async def send_fallback_email(self, job: Job, applicant: Applicant) -> None:
        recipient = job.recruiter_email or (job.details.hiring_manager_email if job.details else None)
        if not recipient:
            raise ValueError("No recruiter or hiring manager email available.")

        subject = f"Application for {job.title} at {job.company}"
        body = f"""Hello,

I am writing to express my interest in the {job.title} position at {job.company}. 
Please find my résumé attached.

Sincerely,
{applicant.first_name} {applicant.last_name}
Email: {applicant.email}
Phone: {applicant.phone}
"""
        # Note: send_email must be defined elsewhere or replaced with actual implementation.
        # For now we assume it exists. If not, we could implement a placeholder.
        from services.services.email_service import send_email  # adjust import as needed
        await with_retries(
            lambda: send_email(recipient, subject, body, applicant.resume),
            tries=3,
            base_delay_s=4,
            max_delay_s=30,
            on_retry=lambda i, e, s: logger.warning(f"Email retry {i}: {e}, sleeping {s:.1f}s"),
        )
        logger.info(f"Fallback email sent to {recipient}")

    # ---------- ATS Integration (Placeholders) ----------
    # These would normally be imported from a real integration module.
    async def _apply_workday(self, job: Job, applicant: Applicant) -> None:
        logger.info(f"Applying via Workday for {job.title} at {job.company}")
        raise NotImplementedError("Workday integration not implemented.")

    async def _apply_lever(self, job: Job, applicant: Applicant) -> None:
        logger.info(f"Applying via Lever for {job.title} at {job.company}")
        raise NotImplementedError("Lever integration not implemented.")

    async def _apply_greenhouse(self, job: Job, applicant: Applicant) -> None:
        logger.info(f"Applying via Greenhouse for {job.title} at {job.company}")
        raise NotImplementedError("Greenhouse integration not implemented.")

    async def apply_to_job(self, job: Job, applicant: Applicant) -> None:
        """Generic ATS apply function using dispatch."""
        if not job.ats or not job.ats.get("type"):
            raise ValueError("No ATS type specified.")
        ats_type = job.ats["type"]
        if ats_type == "Greenhouse":
            await self._apply_greenhouse(job, applicant)
        elif ats_type == "Lever":
            await self._apply_lever(job, applicant)
        elif ats_type == "Workday":
            await self._apply_workday(job, applicant)
        else:
            raise ValueError(f"Unsupported ATS type: {ats_type}")

    # ---------- Main Processing ----------
    async def process_job(self, job: Job, applicant: Applicant) -> None:
        """Try ATS API, then Selenium, then email fallback."""
        # 1. Scrape details if needed
        if job.posting_url and not any([job.details.location, job.details.salary, job.details.description]):
            job.details = await self.scrape_job_details(job)
            # If recruiter_email not set, try hiring manager
            if not job.recruiter_email and job.details.hiring_manager_email:
                job.recruiter_email = job.details.hiring_manager_email

        # 2. ATS API apply
        if job.ats and job.ats.get("type"):
            try:
                await with_retries(
                    lambda: self.apply_to_job(job, applicant),
                    tries=3,
                    base_delay_s=3,
                    max_delay_s=25,
                    on_retry=lambda i, e, s: logger.warning(f"ATS retry {i}: {e}, sleeping {s:.1f}s"),
                )
                logger.info(f"Applied via ATS for {job.title}")
                return
            except Exception as e:
                logger.warning(f"ATS API failed: {e}")

        # 3. Selenium form
        if job.apply_url:
            try:
                success = await with_retries(
                    lambda: self.fill_form_with_selenium(job, applicant),
                    tries=2,
                    base_delay_s=5,
                    max_delay_s=30,
                    on_retry=lambda i, e, s: logger.warning(f"Form retry {i}: {e}, sleeping {s:.1f}s"),
                )
                if success:
                    return
            except Exception as e:
                logger.warning(f"Form apply failed: {e}")

        # 4. Email fallback
        try:
            await self.send_fallback_email(job, applicant)
        except Exception as e:
            logger.error(f"Could not apply or send email for {job.title}: {e}")


# -------------------- Main Orchestration --------------------
async def main(jobs: Iterable[Job], applicant: Applicant) -> None:
    """Process each job with rate limiting."""
    worker = AutomationWorker()
    for i, job in enumerate(jobs):
        logger.info(f"Processing job {i+1}/{len(list(jobs))}: {job.title} at {job.company}")
        await worker.process_job(job, applicant)

        # Extra delay between jobs (already covered by rate limiter, but add a random extra pause)
        if i < len(list(jobs)) - 1:
            delay = random.randint(30, 120)
            logger.info(f"Waiting {delay} seconds before next job...")
            await asyncio.sleep(delay)


# -------------------- Example Entry Point --------------------
if __name__ == "__main__":
    # Read applicant from environment
    applicant = Applicant(
        first_name=os.getenv("APPLICANT_FIRST_NAME", "John"),
        last_name=os.getenv("APPLICANT_LAST_NAME", "Doe"),
        email=os.getenv("APPLICANT_EMAIL", "john.doe@example.com"),
        phone=os.getenv("APPLICANT_PHONE", "+1234567890"),
        resume=os.getenv("APPLICANT_RESUME_PATH"),
        cover_letter=os.getenv("APPLICANT_COVER_LETTER"),
    )

    # Example jobs – include site hints for scraping
    example_jobs = [
        Job(
            title="Software Engineer",
            company="Acme Corp",
            posting_url="https://acme.careers/software-engineer",
            apply_url="https://acme.careers/apply/123",
            recruiter_email="recruiter@acme.com",
            ats={"type": "Greenhouse", "boardToken": "acme", "jobId": "123"},
            site="greenhouse",
        ),
        Job(
            title="Data Analyst",
            company="DataCo",
            posting_url="https://dataco.jobs/data-analyst",
            apply_url=None,
            recruiter_email=None,
            ats=None,
            site="indeed",
        ),
    ]

    asyncio.run(main(example_jobs, applicant))