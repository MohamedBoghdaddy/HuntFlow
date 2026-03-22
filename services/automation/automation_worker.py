"""
automation_worker.py
====================
Enhanced job application automation with integrated AI agent for:
- Job evaluation (relevance scoring)
- Page analysis and strategy selection
- Dynamic field filling
- Error recovery and unknown situation handling
- Post‑application verification
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import random
import time
import json
from dataclasses import dataclass, field
from typing import Iterable, Optional, Dict, Any, Callable, Awaitable, List, Tuple
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementNotInteractableException
from webdriver_manager.chrome import ChromeDriverManager

# AI Agent
from .ai_agent import AIAgent  # adjust import path as needed

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
    # Additional fields for enhanced forms
    location: Optional[str] = None        # city/region
    availability: Optional[str] = None    # e.g., "Immediately", "2 weeks notice"
    notice_period: Optional[str] = None
    work_authorization: Optional[str] = None  # e.g., "US Citizen", "EU passport"
    linkedin_profile: Optional[str] = None
    portfolio_url: Optional[str] = None
    references: Optional[List[Dict[str, str]]] = None  # list of {name, email, phone, relationship}
    # LinkedIn credentials if needed
    linkedin_username: Optional[str] = None
    linkedin_password: Optional[str] = None


@dataclass
class JobDetails:
    location: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    hiring_manager_name: Optional[str] = None
    hiring_manager_email: Optional[str] = None
    application_deadline: Optional[str] = None
    required_experience: Optional[str] = None
    education_level: Optional[str] = None
    employment_type: Optional[str] = None  # Full-time, Part-time, Contract, etc.
    remote_status: Optional[str] = None    # Remote, Hybrid, On-site


@dataclass
class Job:
    title: str
    company: str
    posting_url: Optional[str] = None
    apply_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    ats: Optional[dict] = None             # e.g., {"type": "Greenhouse", "boardToken": "...", "jobId": "..."}
    details: JobDetails = field(default_factory=JobDetails)
    site: Optional[str] = None              # e.g., "linkedin", "indeed", "greenhouse"
    platform: Optional[str] = None          # more specific: "linkedin_easy_apply", "greenhouse", "workday"
    application_state: Optional[Dict[str, Any]] = None  # known completed steps (if any)


# -------------------- Site‑Specific Scraping Rules --------------------
SCRAPING_RULES = {
    "linkedin": {
        "location": {"selector": ".job-details-jobs-unified-top-card__job-location", "type": "css"},
        "salary": {"selector": ".job-details-jobs-unified-top-card__job-insight", "type": "css"},
        "description": {"selector": ".description__text", "type": "css"},
        "hiring_manager": {"selector": "a[href*='mailto:']", "type": "css", "attribute": "href"},
        "employment_type": {"selector": ".job-details-jobs-unified-top-card__job-insight", "type": "css"},
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
        "employment_type": {"selector": re.compile(r"Employment Type[:\s]+(\w+)", re.I), "type": "regex"},
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
                "linkedin.com": RateLimitPolicy(min_delay_s=12, max_delay_s=30, jitter_s=5),
                "smtp": RateLimitPolicy(min_delay_s=5, max_delay_s=12, jitter_s=2),
            }
        )
        self.captcha_solver = captcha_solver or CaptchaSolver()
        self.headless = os.getenv("HEADLESS", "true").lower() != "false"

        # Initialize AI agent if API key is available
        self.ai_agent = None
        if os.getenv("GEMINI_API_KEY"):
            from .ai_agent import AIAgent  # delayed import to avoid circular
            self.ai_agent = AIAgent  # we'll instantiate per job with driver
            logger.info("AI agent enabled.")
        else:
            logger.info("AI agent disabled (set GEMINI_API_KEY to enable).")

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
            details.employment_type = extract_by_rule(soup, rules.get("employment_type", SCRAPING_RULES[None]["employment_type"]))

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

    # ---------- LinkedIn Specific Handlers ----------
    async def _handle_linkedin_easy_apply(self, driver: webdriver.Chrome, job: Job, applicant: Applicant) -> bool:
        """Handle LinkedIn Easy Apply multi-step modal."""
        try:
            # Wait for the Easy Apply button to appear and click it
            easy_apply_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(@class, 'jobs-apply-button') and contains(., 'Easy Apply')]"))
            )
            easy_apply_btn.click()
            logger.info("Clicked Easy Apply button.")
        except TimeoutException:
            logger.error("Easy Apply button not found.")
            return False

        # Handle multi-step modal
        steps_completed = 0
        max_steps = 10  # safety
        while steps_completed < max_steps:
            time.sleep(2)  # allow modal transitions

            # Check if we are on a review/submit step
            try:
                submit_btn = driver.find_element(By.XPATH, "//button[contains(@class, 'artdeco-button--primary') and contains(., 'Submit application')]")
                submit_btn.click()
                logger.info("Submitted application.")
                return True
            except NoSuchElementException:
                pass

            # Look for "Next" or "Review" button
            next_btn = None
            try:
                next_btn = driver.find_element(By.XPATH, "//button[contains(@class, 'artdeco-button--primary') and contains(., 'Next')]")
            except NoSuchElementException:
                try:
                    next_btn = driver.find_element(By.XPATH, "//button[contains(@class, 'artdeco-button--primary') and contains(., 'Review')]")
                except NoSuchElementException:
                    pass

            if not next_btn:
                # If no next button, ask AI agent what to do
                if self.ai_agent:
                    agent = self.ai_agent(driver, applicant.__dict__, job.__dict__)
                    # Set a specific goal for this step
                    agent.state.goal = "find the next button or determine if application is complete"
                    action_success = await self._ask_agent_for_action(agent, driver, applicant, job)
                    if action_success:
                        continue
                logger.error("No Next/Review button found; maybe application is stuck.")
                break

            # Fill fields on current step
            self._fill_linkedin_modal_fields(driver, applicant)

            # Click Next/Review
            next_btn.click()
            steps_completed += 1
            logger.info(f"Moved to step {steps_completed + 1}")

        logger.error(f"Easy Apply did not complete after {steps_completed} steps.")
        return False

    def _fill_linkedin_modal_fields(self, driver: webdriver.Chrome, applicant: Applicant):
        """Fill common fields in LinkedIn Easy Apply modal."""
        # Text inputs
        text_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='text'], input[type='tel'], input[type='email']")
        for inp in text_inputs:
            # Try to determine field by placeholder, name, id, or nearby label
            placeholder = inp.get_attribute("placeholder") or ""
            name = inp.get_attribute("name") or ""
            aria_label = inp.get_attribute("aria-label") or ""

            if any(key in placeholder.lower() or key in name.lower() or key in aria_label.lower() for key in ["first", "fname"]):
                self._safe_send_keys(inp, applicant.first_name)
            elif any(key in placeholder.lower() or key in name.lower() or key in aria_label.lower() for key in ["last", "lname"]):
                self._safe_send_keys(inp, applicant.last_name)
            elif any(key in placeholder.lower() or key in name.lower() or key in aria_label.lower() for key in ["email"]):
                self._safe_send_keys(inp, applicant.email)
            elif any(key in placeholder.lower() or key in name.lower() or key in aria_label.lower() for key in ["phone"]):
                self._safe_send_keys(inp, applicant.phone)
            elif any(key in placeholder.lower() or key in name.lower() or key in aria_label.lower() for key in ["location", "city"]):
                self._safe_send_keys(inp, applicant.location or "")
            elif any(key in placeholder.lower() or key in name.lower() or key in aria_label.lower() for key in ["notice", "availability"]):
                self._safe_send_keys(inp, applicant.availability or "")

        # Dropdowns (select)
        selects = driver.find_elements(By.TAG_NAME, "select")
        for sel in selects:
            self._handle_dropdown(sel, applicant)

        # File upload for resume
        try:
            file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
            if applicant.resume:
                file_input.send_keys(applicant.resume)
                logger.info("Resume uploaded.")
        except NoSuchElementException:
            pass

        # Textareas (cover letter, additional info)
        textareas = driver.find_elements(By.TAG_NAME, "textarea")
        for ta in textareas:
            placeholder = ta.get_attribute("placeholder") or ""
            if "cover" in placeholder.lower() and applicant.cover_letter:
                self._safe_send_keys(ta, applicant.cover_letter)

    def _safe_send_keys(self, element, value):
        try:
            element.clear()
            element.send_keys(value)
        except ElementNotInteractableException:
            logger.debug(f"Element {element} not interactable.")

    def _handle_dropdown(self, select_element, applicant: Applicant):
        """Select appropriate option in dropdown based on common fields."""
        select = Select(select_element)
        options = [opt.text.strip().lower() for opt in select.options]

        # Try to infer what the dropdown is for
        name = select_element.get_attribute("name") or ""
        aria_label = select_element.get_attribute("aria-label") or ""

        # Map applicant fields to possible dropdown purposes
        if any(key in name.lower() or key in aria_label.lower() for key in ["notice", "availability", "start"]):
            # Look for option matching applicant.availability
            if applicant.availability:
                for idx, opt_text in enumerate(options):
                    if applicant.availability.lower() in opt_text:
                        select.select_by_index(idx)
                        logger.info(f"Selected availability: {opt_text}")
                        return
        elif any(key in name.lower() or key in aria_label.lower() for key in ["authorization", "visa", "work right"]):
            if applicant.work_authorization:
                for idx, opt_text in enumerate(options):
                    if applicant.work_authorization.lower() in opt_text:
                        select.select_by_index(idx)
                        return

        # If no match, select first non-empty option (often default)
        for idx, opt in enumerate(select.options):
            if opt.text.strip() and not opt.get_attribute("selected"):
                select.select_by_index(idx)
                logger.debug(f"Selected default dropdown option: {opt.text}")
                break

    # ---------- External Apply Handler ----------
    async def _handle_external_apply(self, driver: webdriver.Chrome, job: Job, applicant: Applicant) -> bool:
        """
        Handle redirection to external platform.
        After clicking Apply on LinkedIn, we may land on a third-party site.
        This method detects the new platform and delegates to a specific handler or generic form filler.
        """
        # Wait for new window/tab or page load
        time.sleep(3)
        # Check if we are on a new domain
        current_url = driver.current_url
        domain = urlparse(current_url).netloc

        logger.info(f"Redirected to external site: {domain}")

        # Platform-specific handlers
        if "greenhouse" in domain:
            return await self._handle_greenhouse_apply(driver, job, applicant)
        elif "lever" in domain:
            return await self._handle_lever_apply(driver, job, applicant)
        elif "workday" in domain:
            return await self._handle_workday_apply(driver, job, applicant)
        elif "mercor" in domain:
            return await self._handle_mercor_apply(driver, job, applicant)
        else:
            # If no platform handler matches, ask AI agent to analyze the page
            if self.ai_agent:
                agent = self.ai_agent(driver, applicant.__dict__, job.__dict__)
                agent.state.goal = "determine how to apply on this external site"
                action_success = await self._ask_agent_for_action(agent, driver, applicant, job)
                if action_success:
                    return True
            # Fall back to generic multi-step form
            return await self._fill_multi_step_form(driver, applicant)

    async def _handle_greenhouse_apply(self, driver: webdriver.Chrome, job: Job, applicant: Applicant) -> bool:
        """Apply on Greenhouse platform (typical ATS)."""
        # Similar to generic multi-step but with Greenhouse specifics
        return await self._fill_multi_step_form(driver, applicant)

    async def _handle_lever_apply(self, driver: webdriver.Chrome, job: Job, applicant: Applicant) -> bool:
        """Apply on Lever platform."""
        return await self._fill_multi_step_form(driver, applicant)

    async def _handle_workday_apply(self, driver: webdriver.Chrome, job: Job, applicant: Applicant) -> bool:
        """Apply on Workday platform."""
        # Workday often uses iframes and complex JS; this is a placeholder
        logger.warning("Workday automation not fully implemented; falling back to generic form filler.")
        return await self._fill_multi_step_form(driver, applicant)

    async def _handle_mercor_apply(self, driver: webdriver.Chrome, job: Job, applicant: Applicant) -> bool:
        """Apply on Mercor platform (example from description)."""
        # Mercor may show saved state; we can try to continue
        try:
            continue_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Continue Application')]"))
            )
            continue_btn.click()
            logger.info("Clicked Continue Application on Mercor.")
            # Then generic form filler for remaining steps
            return await self._fill_multi_step_form(driver, applicant)
        except TimeoutException:
            logger.error("Mercor continue button not found.")
            return False

    # ---------- Generic Multi-Step Form Filler with AI Assistance ----------
    async def _fill_multi_step_form(self, driver: webdriver.Chrome, applicant: Applicant) -> bool:
        """
        Generic handler for multi-step forms.
        Detects steps by presence of "Next", "Continue", "Review", "Submit" buttons.
        Fills common fields on each step. Uses AI agent when stuck.
        """
        max_steps = 20
        step = 0
        while step < max_steps:
            time.sleep(2)  # allow page transitions

            # Check for submit button first
            submit_btn = self._find_submit_button(driver)
            if submit_btn and submit_btn.is_enabled():
                # Additional check: maybe it's a "Submit application" button
                if "submit" in submit_btn.text.lower():
                    submit_btn.click()
                    logger.info("Form submitted.")
                    # Verify success with AI if possible
                    if self.ai_agent:
                        agent = self.ai_agent(driver, applicant.__dict__, {})
                        agent.state.goal = "verify if application was submitted successfully"
                        if await self._ask_agent_verification(agent, driver):
                            return True
                    return True

            # Look for next/continue button
            next_btn = self._find_next_button(driver)
            if not next_btn:
                # No next button, maybe it's the last step? Try submit again
                submit_btn = self._find_submit_button(driver)
                if submit_btn:
                    submit_btn.click()
                    logger.info("Form submitted (final step).")
                    return True
                else:
                    # Ask AI agent what to do
                    if self.ai_agent:
                        agent = self.ai_agent(driver, applicant.__dict__, {})
                        agent.state.goal = "determine next action on this form page"
                        action_success = await self._ask_agent_for_action(agent, driver, applicant, None)
                        if action_success:
                            step += 1
                            continue
                    logger.error("No next or submit button found.")
                    return False

            # Fill fields on current step (with AI assistance for ambiguous fields)
            await self._fill_form_fields_with_ai(driver, applicant)

            # Click next
            next_btn.click()
            step += 1
            logger.info(f"Moved to step {step + 1}")

        logger.error(f"Form did not complete after {max_steps} steps.")
        return False

    def _find_next_button(self, driver: webdriver.Chrome) -> Optional[webdriver.remote.webelement.WebElement]:
        """Find a "Next", "Continue", or "Review" button."""
        xpath_options = [
            "//button[contains(translate(text(),'NEXT','next'), 'next')]",
            "//button[contains(translate(text(),'CONTINUE','continue'), 'continue')]",
            "//button[contains(translate(text(),'REVIEW','review'), 'review')]",
            "//button[@type='button' and contains(@class, 'next')]",
            "//button[@type='button' and contains(@class, 'continue')]",
        ]
        for xpath in xpath_options:
            try:
                btn = driver.find_element(By.XPATH, xpath)
                if btn.is_enabled():
                    return btn
            except NoSuchElementException:
                pass
        return None

    def _find_submit_button(self, driver: webdriver.Chrome) -> Optional[webdriver.remote.webelement.WebElement]:
        """Find a submit button (type=submit or with submit text)."""
        xpath_options = [
            "//button[@type='submit']",
            "//input[@type='submit']",
            "//button[contains(translate(text(),'SUBMIT','submit'), 'submit')]",
            "//button[contains(translate(text(),'APPLY','apply'), 'apply')]",
            "//button[contains(@class, 'submit')]",
        ]
        for xpath in xpath_options:
            try:
                btn = driver.find_element(By.XPATH, xpath)
                if btn.is_enabled():
                    return btn
            except NoSuchElementException:
                pass
        return None

    async def _fill_form_fields_with_ai(self, driver: webdriver.Chrome, applicant: Applicant):
        """
        Fill form fields, using AI for ambiguous fields.
        """
        # First try rule-based filling
        self._fill_form_fields(driver, applicant)

        # If any field remains empty and seems required, ask AI
        if self.ai_agent:
            # Check for empty required fields (simplified: look for input with aria-required or required attribute)
            required_inputs = driver.find_elements(By.CSS_SELECTOR, "input[required], [aria-required='true']")
            for inp in required_inputs:
                if not inp.get_attribute("value"):
                    # Ask AI what to fill here
                    agent = self.ai_agent(driver, applicant.__dict__, {})
                    agent.state.goal = "determine what value to fill in this field"
                    # We need to pass the element description to the agent
                    # For simplicity, we'll call a method that asks specifically about this field
                    value = await self._ask_agent_for_field_value(agent, inp, applicant)
                    if value:
                        self._safe_send_keys(inp, value)

    def _fill_form_fields(self, driver: webdriver.Chrome, applicant: Applicant):
        """
        Fill all relevant fields on the current page using heuristics.
        """
        # Text inputs
        inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='text'], input[type='tel'], input[type='email'], input[type='number']")
        for inp in inputs:
            self._fill_input_by_heuristic(inp, applicant)

        # Textareas
        textareas = driver.find_elements(By.TAG_NAME, "textarea")
        for ta in textareas:
            self._fill_textarea_by_heuristic(ta, applicant)

        # Selects
        selects = driver.find_elements(By.TAG_NAME, "select")
        for sel in selects:
            self._fill_select_by_heuristic(sel, applicant)

        # File inputs (resume)
        file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
        for fi in file_inputs:
            if applicant.resume:
                try:
                    fi.send_keys(applicant.resume)
                    logger.info("Resume uploaded.")
                except Exception as e:
                    logger.warning(f"Resume upload failed: {e}")

        # Checkboxes (maybe required for terms)
        checkboxes = driver.find_elements(By.CSS_SELECTOR, "input[type='checkbox']")
        for cb in checkboxes:
            # Check if it's a terms checkbox (e.g., "I agree")
            label_text = self._get_label_for_element(driver, cb)
            if label_text and any(key in label_text.lower() for key in ["agree", "terms", "consent"]):
                if not cb.is_selected():
                    cb.click()
                    logger.info("Checked terms checkbox.")

    def _fill_input_by_heuristic(self, element, applicant: Applicant):
        """Fill a text input based on placeholder, name, id, or aria-label."""
        if element.get_attribute("value"):
            return  # already filled

        placeholder = (element.get_attribute("placeholder") or "").lower()
        name = (element.get_attribute("name") or "").lower()
        elem_id = (element.get_attribute("id") or "").lower()
        aria_label = (element.get_attribute("aria-label") or "").lower()

        combined = f"{placeholder} {name} {elem_id} {aria_label}"

        mapping = {
            "first name": applicant.first_name,
            "fname": applicant.first_name,
            "last name": applicant.last_name,
            "lname": applicant.last_name,
            "email": applicant.email,
            "e-mail": applicant.email,
            "phone": applicant.phone,
            "mobile": applicant.phone,
            "location": applicant.location or "",
            "city": applicant.location or "",
            "availability": applicant.availability or "",
            "notice": applicant.notice_period or "",
            "portfolio": applicant.portfolio_url or "",
            "linkedin": applicant.linkedin_profile or "",
        }

        for key, value in mapping.items():
            if key in combined and value:
                self._safe_send_keys(element, value)
                logger.debug(f"Filled input '{key}' with '{value}'")
                return

    def _fill_textarea_by_heuristic(self, element, applicant: Applicant):
        """Fill textarea (usually cover letter or additional info)."""
        if element.get_attribute("value"):
            return
        placeholder = (element.get_attribute("placeholder") or "").lower()
        if "cover" in placeholder and applicant.cover_letter:
            self._safe_send_keys(element, applicant.cover_letter)
            logger.debug("Filled cover letter.")
        elif "additional" in placeholder or "info" in placeholder:
            # Maybe add a generic statement?
            pass

    def _fill_select_by_heuristic(self, element, applicant: Applicant):
        """Select appropriate option in dropdown."""
        select = Select(element)
        if select.first_selected_option.get_attribute("value"):
            return  # already selected

        name = (element.get_attribute("name") or "").lower()
        aria_label = (element.get_attribute("aria-label") or "").lower()
        options = [opt.text.strip().lower() for opt in select.options]

        # Determine dropdown type
        if any(key in name or key in aria_label for key in ["notice", "availability", "start"]):
            target = (applicant.availability or "").lower()
            for idx, opt in enumerate(options):
                if target in opt:
                    select.select_by_index(idx)
                    logger.debug(f"Selected availability: {opt}")
                    return
        elif any(key in name or key in aria_label for key in ["authorization", "visa", "work right"]):
            target = (applicant.work_authorization or "").lower()
            for idx, opt in enumerate(options):
                if target in opt:
                    select.select_by_index(idx)
                    return
        elif any(key in name or key in aria_label for key in ["education", "degree"]):
            # Default or leave as is
            pass

        # Fallback: select first non-empty option that is not "Select" or "Choose"
        for idx, opt in enumerate(select.options):
            opt_text = opt.text.strip().lower()
            if opt_text and opt_text not in ["select", "choose", "--", "none"]:
                select.select_by_index(idx)
                logger.debug(f"Selected default dropdown: {opt_text}")
                break

    def _get_label_for_element(self, driver, element) -> Optional[str]:
        """Get label text associated with an element (for checkboxes)."""
        elem_id = element.get_attribute("id")
        if elem_id:
            try:
                label = driver.find_element(By.CSS_SELECTOR, f"label[for='{elem_id}']")
                return label.text
            except NoSuchElementException:
                pass
        # Check parent label
        parent = element.find_element(By.XPATH, "..")
        if parent.tag_name == "label":
            return parent.text
        return None

    # ---------- AI Agent Integration Methods ----------
    async def _ask_agent_for_action(self, agent: AIAgent, driver: webdriver.Chrome,
                                    applicant: Applicant, job: Optional[Job]) -> bool:
        """Let the agent decide the next action and execute it."""
        # The agent already has driver, applicant, job from its constructor
        # We'll run one step of the agent loop
        page_summary = agent.get_page_summary()
        steps_str = ", ".join(agent.state.steps_taken[-5:])
        prompt = agent.prompt_template.format(
            page_summary=page_summary,
            goal=agent.state.goal,
            steps_taken=steps_str,
            applicant_data=json.dumps(applicant.__dict__),
            job_data=json.dumps(job.__dict__ if job else {}),
        )
        try:
            response = agent.llm(prompt)
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return False

        decision = agent.parse_action(response)
        action = decision.get("action")
        target = decision.get("target", "")
        value = decision.get("value")
        logger.info(f"Agent decision: {action} - {target} - {value}")

        if action == "done":
            return True
        if action == "give_up":
            return False

        success = await agent.execute_action(action, target, value)
        agent.state.steps_taken.append(f"{action}:{target}")
        return success

    async def _ask_agent_for_field_value(self, agent: AIAgent, element: webdriver.remote.webelement.WebElement,
                                         applicant: Applicant) -> Optional[str]:
        """Ask agent what value to fill in a specific field."""
        # Create a specialized prompt for this field
        element_info = {
            "tag": element.tag_name,
            "type": element.get_attribute("type"),
            "name": element.get_attribute("name"),
            "id": element.get_attribute("id"),
            "placeholder": element.get_attribute("placeholder"),
            "aria-label": element.get_attribute("aria-label"),
            "required": element.get_attribute("required") is not None,
        }
        prompt = f"""
You are helping to fill a job application form.
The current field has the following attributes:
{json.dumps(element_info, indent=2)}

The applicant's data: {json.dumps(applicant.__dict__, indent=2)}

Based on the field's purpose (inferred from its attributes), what value should be entered?
Respond in JSON format with a single key "value".
If you cannot determine, respond with {{"value": null}}.
"""
        try:
            response = agent.llm(prompt)
            # Parse JSON
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            else:
                json_str = response.strip()
            data = json.loads(json_str)
            return data.get("value")
        except Exception as e:
            logger.error(f"Failed to get field value from AI: {e}")
            return None

    async def _ask_agent_verification(self, agent: AIAgent, driver: webdriver.Chrome) -> bool:
        """Ask agent to verify if application was submitted successfully."""
        page_summary = agent.get_page_summary()
        prompt = f"""
You are verifying if a job application was submitted successfully.
Page summary: {page_summary}

Based on the page content, has the application been submitted successfully?
Respond with JSON: {{"success": true/false, "reason": "..."}}
"""
        try:
            response = agent.llm(prompt)
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            else:
                json_str = response.strip()
            data = json.loads(json_str)
            return data.get("success", False)
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return False

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

    # ---------- Job Evaluation (AI-assisted) ----------
    async def evaluate_job(self, job: Job, applicant: Applicant) -> float:
        """Use AI to evaluate job relevance (0-1 score)."""
        if not self.ai_agent:
            # Simple heuristic: match keywords from title/description
            score = 0.5  # default
            # could implement basic keyword matching
            return score

        # Create a temporary agent without driver
        # We'll just use the LLM with job and applicant data
        # For simplicity, we'll instantiate an agent with a dummy driver
        from selenium.webdriver.chrome.options import Options
        options = Options()
        options.add_argument("--headless")
        dummy_driver = webdriver.Chrome(options=options)
        agent = self.ai_agent(dummy_driver, applicant.__dict__, job.__dict__)
        dummy_driver.quit()

        prompt = f"""
You are evaluating a job for a candidate.
Job title: {job.title}
Company: {job.company}
Job description: {job.details.description or 'N/A'}
Candidate data: {json.dumps(applicant.__dict__, indent=2)}

Rate the relevance of this job for the candidate on a scale from 0 to 1.
Respond with JSON: {{"score": float, "reason": "..."}}
"""
        try:
            response = agent.llm(prompt)
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            else:
                json_str = response.strip()
            data = json.loads(json_str)
            score = data.get("score", 0.5)
            return max(0.0, min(1.0, score))
        except Exception as e:
            logger.error(f"Job evaluation failed: {e}")
            return 0.5

    # ---------- Main Processing ----------
    async def process_job(self, job: Job, applicant: Applicant) -> None:
        """
        Try ATS API, then platform-specific apply (LinkedIn Easy Apply, external), then Selenium generic,
        then email fallback. Uses AI for evaluation and decision-making.
        """
        # 0. Evaluate job relevance (optional)
        if self.ai_agent:
            score = await self.evaluate_job(job, applicant)
            if score < 0.3:
                logger.info(f"Job {job.title} relevance score {score:.2f} too low, skipping.")
                return
            logger.info(f"Job relevance score: {score:.2f}")

        # 1. Scrape details if needed
        if job.posting_url and not any([job.details.location, job.details.salary, job.details.description]):
            job.details = await self.scrape_job_details(job)
            if not job.recruiter_email and job.details.hiring_manager_email:
                job.recruiter_email = job.details.hiring_manager_email

        # 2. ATS API apply (if ATS info present)
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

        # 3. Platform-specific apply (if apply_url exists)
        if job.apply_url:
            await self.limiter.wait(job.apply_url)
            options = webdriver.ChromeOptions()
            if self.headless:
                options.add_argument("--headless")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)

            driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
            try:
                logger.info(f"Navigating to apply URL: {job.apply_url}")
                driver.get(job.apply_url)
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))

                # Detect platform from URL or page content
                if "linkedin.com" in job.apply_url:
                    success = await self._handle_linkedin_easy_apply(driver, job, applicant)
                else:
                    # Check if we are on LinkedIn but apply_url is external
                    if "linkedin.com" in driver.current_url and "Easy Apply" not in driver.page_source:
                        # Possibly external apply button; click it
                        try:
                            external_btn = driver.find_element(By.XPATH, "//button[contains(., 'Apply') and contains(@class, 'jobs-apply-button')]")
                            external_btn.click()
                            logger.info("Clicked external apply button, handling redirect.")
                            success = await self._handle_external_apply(driver, job, applicant)
                        except NoSuchElementException:
                            # If no button, maybe AI can help
                            if self.ai_agent:
                                agent = self.ai_agent(driver, applicant.__dict__, job.__dict__)
                                agent.state.goal = "determine how to apply on this page"
                                success = await self._ask_agent_for_action(agent, driver, applicant, job)
                            else:
                                success = await self._fill_multi_step_form(driver, applicant)
                    else:
                        # Assume generic external site
                        success = await self._fill_multi_step_form(driver, applicant)

                if success:
                    logger.info(f"Application successful for {job.title}")
                    return
                else:
                    logger.warning(f"Application failed for {job.title}, trying fallback.")
            except Exception as e:
                logger.error(f"Error during apply navigation: {e}")
            finally:
                driver.quit()

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
        location=os.getenv("APPLICANT_LOCATION", "San Francisco"),
        availability=os.getenv("APPLICANT_AVAILABILITY", "Immediately"),
        work_authorization=os.getenv("APPLICANT_WORK_AUTHORIZATION", "US Citizen"),
        linkedin_profile=os.getenv("APPLICANT_LINKEDIN", "https://linkedin.com/in/johndoe"),
        portfolio_url=os.getenv("APPLICANT_PORTFOLIO"),
        linkedin_username=os.getenv("LINKEDIN_USERNAME"),
        linkedin_password=os.getenv("LINKEDIN_PASSWORD"),
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
        Job(
            title="Bilingual LLM Evaluator - Arabic Expert",
            company="Mercor",
            posting_url="https://linkedin.com/jobs/view/123",
            apply_url="https://linkedin.com/jobs/view/123",
            recruiter_email=None,
            ats=None,
            site="linkedin",
            platform="linkedin_easy_apply",
        ),
    ]

    asyncio.run(main(example_jobs, applicant))