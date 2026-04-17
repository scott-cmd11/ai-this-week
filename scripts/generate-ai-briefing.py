#!/usr/bin/env python3
"""
Daily AI Adoption Briefing Generator

Generates a fresh briefing of Canadian AI developments across 5 domains
and creates a Gmail draft for immediate review.

Requires:
- ANTHROPIC_API_KEY environment variable
- GMAIL_CREDENTIALS environment variable (JSON string with type, project_id, private_key_id, private_key, client_email, client_id, auth_uri, token_uri, auth_provider_x509_cert_url, client_x509_cert_url)
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('briefing-debug.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def get_anthropic_client():
    """Initialize Anthropic client."""
    try:
        from anthropic import Anthropic
        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        return Anthropic(api_key=api_key)
    except ImportError:
        logger.error("anthropic package not installed. Run: pip install anthropic")
        raise

def get_gmail_service():
    """Initialize Gmail API service using stored credentials."""
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
        
        creds_json = os.environ.get('GMAIL_CREDENTIALS')
        if not creds_json:
            logger.warning("GMAIL_CREDENTIALS not set - will skip Gmail draft creation")
            return None
        
        creds_dict = json.loads(creds_json)
        credentials = Credentials.from_service_account_info(creds_dict, scopes=[
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/gmail.readonly'
        ])
        
        return build('gmail', 'v1', credentials=credentials)
    except ImportError:
        logger.warning("google-auth and google-api-client packages not installed")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Invalid GMAIL_CREDENTIALS JSON: {e}")
        return None

def generate_briefing_html(findings_by_domain: dict) -> str:
    """Generate HTML briefing from findings."""
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
    
    # Add findings by domain
    domain_configs = [
        ("Government & Policy", "Government & Policy AI"),
        ("Industry & Enterprise", "Industry & Enterprise AI"),
        ("Research & Academic", "Research & Academic AI"),
        ("Regulation & Ethics", "Regulation & Ethics AI"),
        ("Technology & Infrastructure", "Technology & Infrastructure AI"),
    ]
    
    for domain_label, domain_key in domain_configs:
        findings = findings_by_domain.get(domain_key, [])
        if findings:
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

def search_and_extract_findings(client, domain: str, finding_count: int) -> list:
    """Use Claude to search web and extract findings for a domain."""
    prompt = f"""Search for the {finding_count} most significant Canadian AI developments in the last 24 hours related to: {domain}

Use current knowledge (April 2026) and web search to find genuinely fresh findings from April 14-15, 2026 (yesterday and today).

For each finding, provide:
1. Title (one sentence, specific)
2. Body (2-3 sentences explaining significance)
3. Source URL (actual link if available)
4. Source label (publication/website name)

Format as JSON array with objects containing: title, body, source, source_label

Return ONLY valid JSON, no other text."""

    try:
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        response_text = message.content[0].text
        logger.info(f"Got response for {domain}: {len(response_text)} chars")
        
        # Extract JSON from response
        try:
            # Try parsing the entire response as JSON
            findings = json.loads(response_text)
            if isinstance(findings, list):
                return findings[:finding_count]  # Limit to requested count
        except json.JSONDecodeError:
            # Try to extract JSON from response text
            import re
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                try:
                    findings = json.loads(json_match.group())
                    if isinstance(findings, list):
                        return findings[:finding_count]
                except json.JSONDecodeError:
                    pass
        
        logger.warning(f"Could not parse JSON for {domain}. Raw response: {response_text[:200]}")
        return []
        
    except Exception as e:
        logger.error(f"Error searching for {domain}: {e}")
        return []

def create_gmail_draft(service, subject: str, html_content: str) -> Optional[str]:
    """Create a Gmail draft with the briefing."""
    if not service:
        logger.info("Gmail service not available - skipping draft creation")
        return None
    
    try:
        # Create email message
        message = MIMEMultipart('alternative')
        message['subject'] = subject
        
        # Attach HTML part
        html_part = MIMEText(html_content, 'html')
        message.attach(html_part)
        
        # Create draft
        body = {
            'message': {
                'raw': base64.urlsafe_b64encode(message.as_bytes()).decode()
            }
        }
        
        draft = service.users().drafts().create(userId='me', body=body).execute()
        draft_id = draft['id']
        logger.info(f"Created Gmail draft: {draft_id}")
        return draft_id
        
    except Exception as e:
        logger.error(f"Error creating Gmail draft: {e}")
        return None

def main():
    """Main function."""
    logger.info("=== Starting daily briefing generation ===")
    
    try:
        # Initialize clients
        client = get_anthropic_client()
        gmail_service = get_gmail_service()
        
        # Define domains and finding counts
        domains = {
            "Government & Policy AI": 3,
            "Industry & Enterprise AI": 2,
            "Research & Academic AI": 3,
            "Regulation & Ethics AI": 2,
            "Technology & Infrastructure AI": 2,
        }
        
        # Generate findings for each domain
        logger.info("Generating findings for each domain...")
        findings_by_domain = {}
        
        for domain, count in domains.items():
            logger.info(f"Searching for {count} findings in {domain}...")
            findings = search_and_extract_findings(client, domain, count)
            findings_by_domain[domain] = findings
            logger.info(f"Found {len(findings)} findings for {domain}")
        
        # Generate HTML
        logger.info("Generating HTML briefing...")
        html_content = generate_briefing_html(findings_by_domain)
        
        # Save HTML locally for reference
        with open('briefing-output.html', 'w') as f:
            f.write(html_content)
        logger.info("Saved HTML to briefing-output.html")
        
        # Create Gmail draft
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
