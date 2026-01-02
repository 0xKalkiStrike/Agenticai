import os
import requests
from typing import Optional

# -------------------------------------------------
# Environment Variables
# -------------------------------------------------

BOT_TOKEN: Optional[str] = os.getenv("TG_BOT_TOKEN")
CHAT_ID: Optional[str] = os.getenv("TG_CHAT_ID")

TELEGRAM_API_URL = "https://api.telegram.org"


# -------------------------------------------------
# Notify Admin / PM via Telegram
# -------------------------------------------------

def notify_admin(message: str) -> None:
    """
    Send a notification message to Admin/PM via Telegram.
    Fails silently if configuration is missing.
    """
    if not BOT_TOKEN or not CHAT_ID:
        # Telegram not configured; skip notification
        return

    url = f"{TELEGRAM_API_URL}/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": message
    }

    try:
        requests.post(url, json=payload, timeout=5)
    except requests.RequestException:
        # Fail silently to avoid breaking core app flow
        pass


# -------------------------------------------------
# Local Test
# -------------------------------------------------

if __name__ == "__main__":
    notify_admin("🚀 Test notification from Agentic AI system")
