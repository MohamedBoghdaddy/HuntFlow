from __future__ import annotations

import os
import logging
from typing import Optional

try:
    from twocaptcha import TwoCaptcha
except ImportError:
    TwoCaptcha = None

try:
    import python_anticaptcha as anticaptcha
except ImportError:
    anticaptcha = None

logger = logging.getLogger(__name__)


class CaptchaSolver:
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