"""
ai_agent.py
===========
AI agent for job application automation using Gemini.
Supports:
- Job relevance evaluation
- Suggesting values for ambiguous form fields
- Verifying application success
- Deciding next actions when rule‑based heuristics fail
- Full autonomous loop (fallback mode)
"""

import os
import json
import logging
import asyncio
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field

from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from selenium import webdriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException

logger = logging.getLogger(__name__)


@dataclass
class AgentState:
    """Tracks the agent's progress during autonomous runs."""
    steps_taken: List[str] = field(default_factory=list)
    last_action: Optional[str] = None
    goal: str = "submit job application"
    max_steps: int = 20


class AIAgent:
    """
    An AI agent that uses Gemini to assist with job application automation.
    Provides both targeted methods (for specific tasks) and a full autonomous loop.
    """

    def __init__(self, driver: webdriver.Chrome, applicant: Dict[str, Any], job: Dict[str, Any]):
        self.driver = driver
        self.applicant = applicant
        self.job = job
        self.state = AgentState()

        # Initialize Gemini (1.5 Flash – fast and cheap)
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.2,
            convert_system_message_to_human=True,  # for simpler prompting
        )

    # ---------- Core LLM Call ----------
    async def _call_llm(self, prompt: str, max_retries: int = 2) -> Optional[str]:
        """Invoke the LLM with error handling and retries."""
        for attempt in range(max_retries + 1):
            try:
                response = await self.llm.ainvoke(prompt)
                return response.content
            except Exception as e:
                logger.warning(f"LLM call attempt {attempt + 1} failed: {e}")
                if attempt == max_retries:
                    logger.error("All LLM retries failed.")
                    return None
                await asyncio.sleep(1)  # brief pause before retry

    # ---------- JSON Parsing ----------
    def _parse_json_response(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract and parse JSON from LLM output (handles markdown)."""
        if not text:
            return None
        try:
            # Remove markdown code fences if present
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}\nRaw text: {text}")
            return None

    # ---------- Page Summary (reused from original) ----------
    def get_page_summary(self) -> str:
        """Extract a concise summary of the page for the LLM."""
        body_text = self.driver.find_element(By.TAG_NAME, "body").text[:2000]
        elements = []
        for tag in ["button", "input", "select", "textarea", "a"]:
            elems = self.driver.find_elements(By.TAG_NAME, tag)
            for e in elems[:20]:
                if e.is_displayed() and e.is_enabled():
                    info = {
                        "tag": tag,
                        "text": (e.text or e.get_attribute("value") or "")[:50],
                        "type": e.get_attribute("type"),
                        "name": e.get_attribute("name"),
                        "id": e.get_attribute("id"),
                        "placeholder": e.get_attribute("placeholder"),
                    }
                    elements.append(info)
        summary = f"Visible text (first 2000 chars):\n{body_text}\n\nInteractive elements:\n"
        for el in elements[:30]:
            summary += f"- {json.dumps(el)}\n"
        return summary

    # ---------- Specialized Methods ----------

    async def evaluate_job(self) -> float:
        """
        Score job relevance (0.0 to 1.0) based on job description and applicant data.
        """
        prompt = f"""
You are an expert job matcher. Evaluate how well this job fits the candidate.

Job title: {self.job.get('title', 'N/A')}
Company: {self.job.get('company', 'N/A')}
Job description: {self.job.get('details', {}).get('description', 'N/A')}

Candidate data: {json.dumps(self.applicant, indent=2)}

Return a JSON object with:
- "score": float between 0.0 (completely irrelevant) and 1.0 (perfect match)
- "reason": brief explanation

Example: {{"score": 0.85, "reason": "Skills align well, but requires 2 years more experience"}}
"""
        response = await self._call_llm(prompt)
        data = self._parse_json_response(response) if response else None
        if data and "score" in data:
            try:
                score = float(data["score"])
                return max(0.0, min(1.0, score))
            except (ValueError, TypeError):
                pass
        logger.warning("Could not evaluate job, defaulting to 0.5")
        return 0.5

    async def suggest_field_value(self, element_info: Dict[str, Any]) -> Optional[str]:
        """
        Given a description of a form field (tag, type, name, placeholder, etc.),
        suggest an appropriate value from the applicant's data.
        """
        prompt = f"""
You are helping to fill a job application form.
The current field has these attributes:
{json.dumps(element_info, indent=2)}

The applicant's data:
{json.dumps(self.applicant, indent=2)}

Based on the field's purpose (inferred from its attributes), what value should be entered?
Return a JSON object with a single key "value". If you cannot determine, use null.
Example: {{"value": "John"}} or {{"value": null}}
"""
        response = await self._call_llm(prompt)
        data = self._parse_json_response(response) if response else None
        return data.get("value") if data else None

    async def verify_success(self) -> bool:
        """
        After attempting to submit, check if the application was successful.
        Returns True if success is confirmed, False otherwise.
        """
        page_summary = self.get_page_summary()
        prompt = f"""
You are verifying if a job application was submitted successfully.
Page summary: {page_summary}

Based on the page content, has the application been submitted successfully?
Look for confirmation messages like "Thank you for applying", "Application received", etc.
Return a JSON object with:
- "success": true/false
- "reason": short explanation

Example: {{"success": true, "reason": "Thank you page shown"}}
"""
        response = await self._call_llm(prompt)
        data = self._parse_json_response(response) if response else None
        if data and "success" in data:
            return bool(data["success"])
        return False

    async def decide_next_action(self, goal: str) -> Optional[Dict[str, Any]]:
        """
        Decide the next action to take on the current page.
        Returns a dict with keys: action, target, value, reason.
        """
        page_summary = self.get_page_summary()
        steps_str = ", ".join(self.state.steps_taken[-5:])
        prompt = f"""
You are an AI assistant automating a job application process.
Your goal: {goal}

You are currently on a web page. Here is a summary:
{page_summary}

You have already taken these steps: {steps_str}

The applicant's data: {json.dumps(self.applicant, indent=2)}
The job data: {json.dumps(self.job, indent=2)}

Based on the page, decide the next action. Respond in JSON format with the following keys:
- "action": one of ["click", "fill", "select", "wait", "submit", "done", "give_up"]
- "target": description of the element (e.g., "button with text 'Next'", "input field named 'email'")
- "value": if action is "fill" or "select", the value to use (e.g., "john@example.com")
- "reason": brief explanation

If you think the application is submitted successfully, set "action": "done".
If you are stuck or cannot proceed, set "action": "give_up".
"""
        response = await self._call_llm(prompt)
        data = self._parse_json_response(response) if response else None
        if data and "action" in data:
            return data
        return None

    # ---------- Action Execution (similar to original but with async wait) ----------
    async def execute_action(self, action: str, target: str, value: Optional[str] = None) -> bool:
        """Execute a decided action (click, fill, select, wait, submit)."""
        try:
            if action == "click":
                elem = self._find_element(target)
                if elem:
                    elem.click()
                    logger.info(f"Clicked: {target}")
                    return True
            elif action == "fill":
                elem = self._find_element(target)
                if elem and elem.tag_name in ["input", "textarea"]:
                    elem.clear()
                    elem.send_keys(value)
                    logger.info(f"Filled {target} with '{value}'")
                    return True
            elif action == "select":
                elem = self._find_element(target)
                if elem and elem.tag_name == "select":
                    select = Select(elem)
                    if value:
                        select.select_by_visible_text(value)
                    else:
                        select.select_by_index(1)
                    logger.info(f"Selected '{value}' in {target}")
                    return True
            elif action == "wait":
                await asyncio.sleep(3)
                logger.info("Waited 3 seconds")
                return True
            elif action == "submit":
                submit = self._find_submit_button()
                if submit:
                    submit.click()
                    logger.info("Clicked submit button")
                    return True
            elif action in ("done", "give_up"):
                return True  # handled by caller
        except Exception as e:
            logger.error(f"Action execution failed: {e}")
        return False

    def _find_element(self, target: str) -> Optional[WebElement]:
        """Find an element based on description (simple heuristics)."""
        try:
            return self.driver.find_element(By.XPATH, f"//*[contains(text(), '{target}')]")
        except NoSuchElementException:
            pass
        try:
            return self.driver.find_element(By.XPATH, f"//input[@placeholder='{target}']")
        except NoSuchElementException:
            pass
        try:
            return self.driver.find_element(By.NAME, target)
        except NoSuchElementException:
            pass
        try:
            return self.driver.find_element(By.ID, target)
        except NoSuchElementException:
            pass
        return None

    def _find_submit_button(self) -> Optional[WebElement]:
        """Find any likely submit button."""
        xpaths = [
            "//button[@type='submit']",
            "//input[@type='submit']",
            "//button[contains(text(), 'Submit')]",
            "//button[contains(text(), 'Apply')]",
            "//button[contains(text(), 'Continue')]",
        ]
        for xpath in xpaths:
            try:
                return self.driver.find_element(By.XPATH, xpath)
            except NoSuchElementException:
                pass
        return None

    # ---------- Full Autonomous Loop ----------
    async def run(self) -> bool:
        """
        Main agent loop: observe -> decide -> act -> repeat until done or give_up.
        Returns True if application was submitted successfully.
        """
        while len(self.state.steps_taken) < self.state.max_steps:
            decision = await self.decide_next_action(self.state.goal)
            if not decision:
                logger.error("No decision from agent, giving up.")
                return False

            action = decision.get("action")
            target = decision.get("target", "")
            value = decision.get("value")
            reason = decision.get("reason", "")
            logger.info(f"Agent decision: {action} - {target} - {value} (reason: {reason})")

            if action == "done":
                return True
            if action == "give_up":
                return False

            success = await self.execute_action(action, target, value)
            self.state.steps_taken.append(f"{action}:{target}")
            if not success:
                logger.warning("Action failed, giving up.")
                return False

            await asyncio.sleep(1)  # small pause before next iteration

        logger.warning("Agent reached max steps without completing.")
        return False