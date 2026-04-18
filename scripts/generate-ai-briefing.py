#!/usr/bin/env python3
"""
Daily AI Adoption Briefing Generator

Uses OpenAI's Responses API with the hosted `web_search` tool to find fresh
Canadian AI developments across 5 domains, then drafts a formatted Gmail
draft for review.

Required env vars:
    OPENAI_API_KEY      — OpenAI key with access to Responses + web_search
    GMAIL_CREDENTIALS   — (optional) service-account JSON string with
                          gmail.compose + gmail.readonly scopes. If unset,
                          the script writes briefing-output.html and skips
                          the Gmail draft.

Local test:
    export OPENAI_API_KEY=sk-...
    python scripts/generate-ai-briefing.py
"""

import os
import json
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def _load_dotenv_local() -> None:
    """Minimal .env.local loader so local runs don't need `export`.

    Matches Next.js convention: keys already in the real environment win,
    so CI (which sets env via `env:` block) is never overridden.
    """
    path = Path(__file__).resolve().parent.parent / '.env.local'
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv_local()


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('briefing-debug.log'),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# Model choice. gpt-5 is the current tier; gpt-4o is a drop-in fallback.
MODEL = os.environ.get('OPENAI_MODEL', 'gpt-5')


def get_openai_client():
    """Initialize OpenAI client. Raises if OPENAI_API_KEY is missing."""
    try:
        from openai import OpenAI
    except ImportError:
        logger.error("openai package not installed. Run: pip install openai")
        raise

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)


def get_gmail_service():
    """Initialize Gmail API service using service-account credentials.

    Returns None if credentials aren't set — the caller should handle that
    gracefully and just skip draft creation.
    """
    creds_json = os.environ.get('GMAIL_CREDENTIALS')
    if not creds_json:
        logger.warning("GMAIL_CREDENTIALS not set — will skip Gmail draft creation")
        return None

    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
    except ImportError:
        logger.warning("google-auth/google-api-client not installed — skipping Gmail")
        return None

    try:
        creds_dict = json.loads(creds_json)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid GMAIL_CREDENTIALS JSON: {e}")
        return None

    credentials = Credentials.from_service_account_info(
        creds_dict,
        scopes=[
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/gmail.readonly',
        ],
    )
    return build('gmail', 'v1', credentials=credentials)


def search_and_extract_findings(client, domain: str, finding_count: int) -> list:
    """Use OpenAI Responses API with web_search to find fresh findings.

    Returns a list of dicts, each with keys: title, body, source, source_label.
    Returns empty list on any parsing or API failure (logged).
    """
    today = datetime.now().strftime('%B %d, %Y')
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%B %d, %Y')

    prompt = (
        f"Find the {finding_count} most significant Canadian AI developments from "
        f"{yesterday} and {today} related to: {domain}.\n\n"
        f"Use web search to find genuinely recent news — not older coverage.\n\n"
        f"Return ONLY a valid JSON array. Each element must have these keys:\n"
        f'  - "title": one specific sentence\n'
        f'  - "body": 2-3 sentences explaining significance\n'
        f'  - "source": the article URL\n'
        f'  - "source_label": publication/website name\n\n'
        f"No markdown, no code fences, no prose before or after. Just the JSON array."
    )

    try:
        response = client.responses.create(
            model=MODEL,
            input=prompt,
            tools=[{"type": "web_search"}],
        )
    except Exception as e:
        logger.error(f"Responses API error for {domain}: {e}")
        return []

    text = (response.output_text or '').strip()
    logger.info(f"Got {len(text)} chars for {domain}")

    findings = _parse_json_array(text)
    if findings is None:
        logger.warning(f"Could not parse JSON for {domain}. Raw (first 200): {text[:200]}")
        return []
    return findings[:finding_count]


def _parse_json_array(text: str) -> Optional[list]:
    """Extract a JSON array from model output, tolerating code fences or prose."""
    # Strip common code fences
    fenced = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text

    try:
        parsed = json.loads(candidate)
        return parsed if isinstance(parsed, list) else None
    except json.JSONDecodeError:
        pass

    # Last resort: greedy match of first [ ... ] span
    bracket = re.search(r'\[.*\]', text, re.DOTALL)
    if bracket:
        try:
            parsed = json.loads(bracket.group())
            return parsed if isinstance(parsed, list) else None
        except json.JSONDecodeError:
            return None
    return None


def generate_briefing_html(findings_by_domain: dict) -> str:
    """Generate HTML briefing from findings keyed by domain label."""
    today = datetime.now().strftime('%B %d, %Y')
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%B %d')

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Adoption Briefing</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            line-height: 1.5;
            color: #222;
            margin: 0;
            padding: 16px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 24px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        h1 {{
            font-size: 24px;
            margin: 0 0 8px 0;
            padding-bottom: 12px;
            border-bottom: 3px solid #c00;
            color: #222;
        }}
        .subtitle {{
            font-size: 13px;
            color: #666;
            margin-bottom: 24px;
        }}
        h2 {{
            font-size: 16px;
            margin: 20px 0 12px 0;
            color: #222;
        }}
        h2.flagged {{
            background-color: #fef0f0;
            padding: 8px 12px;
            border-left: 3px solid #c00;
            margin-left: -12px;
            margin-right: -12px;
            padding-left: 12px;
            color: #c00;
            font-weight: 600;
        }}
        .finding {{
            margin-bottom: 16px;
            font-size: 14px;
        }}
        .finding-title {{
            font-weight: 600;
            margin-bottom: 4px;
            color: #222;
        }}
        .finding-body {{
            margin-bottom: 6px;
            color: #444;
        }}
        .finding-source {{
            font-size: 12px;
            color: #0066cc;
        }}
        .finding-source a {{
            color: #0066cc;
            text-decoration: none;
        }}
        .finding-source a:hover {{
            text-decoration: underline;
        }}
        .footer {{
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #999;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>AI Adoption Briefing</h1>
        <div class="subtitle">Canadian AI developments, {yesterday} – {today}</div>
"""

    domain_configs = [
        ("Government & Policy", "Government & Policy AI"),
        ("Industry & Enterprise", "Industry & Enterprise AI"),
        ("Research & Academic", "Research & Academic AI"),
        ("Regulation & Ethics", "Regulation & Ethics AI"),
        ("Technology & Infrastructure", "Technology & Infrastructure AI"),
    ]

    for domain_label, domain_key in domain_configs:
        findings = findings_by_domain.get(domain_key, [])
        if not findings:
            continue
        html += f'        <h2 class="flagged">{domain_label}</h2>\n'
        for finding in findings:
            html += f"""        <div class="finding">
            <div class="finding-title">{finding.get('title', 'Untitled')}</div>
            <div class="finding-body">{finding.get('body', '')}</div>
            <div class="finding-source"><a href="{finding.get('source', '#')}">{finding.get('source_label', 'Source')}</a></div>
        </div>
"""

    html += f"""        <div class="footer">
            <p>Compiled {today} • Covers 24-hour window</p>
            <p>This briefing synthesizes publicly available Canadian AI developments. All sources are linked.</p>
        </div>
    </div>
</body>
</html>
"""
    return html


def create_gmail_draft(service, subject: str, html_content: str) -> Optional[str]:
    """Create a Gmail draft with the briefing. Returns draft ID or None."""
    if not service:
        logger.info("Gmail service not available — skipping draft creation")
        return None

    try:
        message = MIMEMultipart('alternative')
        message['subject'] = subject
        message.attach(MIMEText(html_content, 'html'))

        body = {
            'message': {
                'raw': base64.urlsafe_b64encode(message.as_bytes()).decode(),
            },
        }
        draft = service.users().drafts().create(userId='me', body=body).execute()
        draft_id = draft['id']
        logger.info(f"Created Gmail draft: {draft_id}")
        return draft_id
    except Exception as e:
        logger.error(f"Error creating Gmail draft: {e}")
        return None


def main():
    logger.info("=== Starting daily briefing generation ===")
    logger.info(f"Using model: {MODEL}")

    try:
        client = get_openai_client()
        gmail_service = get_gmail_service()

        domains = {
            "Government & Policy AI": 3,
            "Industry & Enterprise AI": 2,
            "Research & Academic AI": 3,
            "Regulation & Ethics AI": 2,
            "Technology & Infrastructure AI": 2,
        }

        findings_by_domain: dict = {}
        for domain, count in domains.items():
            logger.info(f"Searching for {count} findings in {domain}...")
            findings = search_and_extract_findings(client, domain, count)
            findings_by_domain[domain] = findings
            logger.info(f"Found {len(findings)} findings for {domain}")

        logger.info("Generating HTML briefing...")
        html_content = generate_briefing_html(findings_by_domain)

        with open('briefing-output.html', 'w') as f:
            f.write(html_content)
        logger.info("Saved HTML to briefing-output.html")

        today = datetime.now().strftime('%B %d, %Y')
        subject = f"AI Adoption Briefing – {today}"
        draft_id = create_gmail_draft(gmail_service, subject, html_content)

        if draft_id:
            logger.info(f"✓ Briefing draft created: {draft_id}")
        else:
            logger.warning("Gmail draft not created (credentials may not be configured)")

        logger.info("=== Briefing generation complete ===")
        return 0

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit(main())
