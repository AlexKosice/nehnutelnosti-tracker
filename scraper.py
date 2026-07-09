#!/usr/bin/env python3
import urllib.request
import urllib.parse
import json
import re
import time
import os
from datetime import datetime

# Configure URL targets
URLS = {
    "kosicky_kraj_byty": "https://www.nehnutelnosti.sk/vysledky/byty/kosicky-kraj/predaj",
    "kosicky_kraj_domy": "https://www.nehnutelnosti.sk/domy/kosicky-kraj/predaj",
    
    "kosice_byty": "https://www.nehnutelnosti.sk/vysledky/byty/kosice/predaj",
    "kosice_domy": "https://www.nehnutelnosti.sk/vysledky/domy/kosice/predaj",
    
    "presovsky_kraj_byty": "https://www.nehnutelnosti.sk/vysledky/byty/presovsky-kraj/predaj",
    "presovsky_kraj_domy": "https://www.nehnutelnosti.sk/vysledky/domy/presovsky-kraj/predaj",
    
    "bratislava_byty": "https://www.nehnutelnosti.sk/vysledky/byty/bratislava/predaj",
    "bratislava_domy": "https://www.nehnutelnosti.sk/vysledky/domy/bratislava/predaj",
    
    "slovensko_byty": "https://www.nehnutelnosti.sk/vysledky/byty/predaj",
    "slovensko_domy": "https://www.nehnutelnosti.sk/vysledky/domy/predaj",
    
    "kosice_byty_under_215k": "https://www.nehnutelnosti.sk/vysledky/byty/kosice/predaj?priceTo=215000",
    "kosice_byty_over_215k": "https://www.nehnutelnosti.sk/vysledky/byty/kosice/predaj?priceFrom=215001",
    
    "bratislava_byty_under_300k": "https://www.nehnutelnosti.sk/vysledky/byty/bratislava/predaj?priceTo=300000",
    "bratislava_byty_over_300k": "https://www.nehnutelnosti.sk/vysledky/byty/bratislava/predaj?priceFrom=300001",
    
    "slovensko_byty_under_215k": "https://www.nehnutelnosti.sk/vysledky/byty/predaj?priceTo=215000",
    "slovensko_byty_over_215k": "https://www.nehnutelnosti.sk/vysledky/byty/predaj?priceFrom=215001",
    
    "slovensko_domy_under_215k": "https://www.nehnutelnosti.sk/vysledky/domy/predaj?priceTo=215000",
    "slovensko_domy_over_215k": "https://www.nehnutelnosti.sk/vysledky/domy/predaj?priceFrom=215001"
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
}

def fetch_count_with_retry(name, url, max_retries=3, delay=2):
    """Fetches a URL and parses the listing count from its HTML with retry mechanism."""
    for attempt in range(max_retries):
        print(f"[{name}] Fetching URL (Attempt {attempt + 1}/{max_retries})...")
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                html = response.read().decode('utf-8')
                
                # Check for redirect (in case parameters were lost)
                final_url = response.geturl()
                if "vysledky" not in final_url and "vysledky" in url:
                    print(f"  WARNING: Redirected from search endpoint to '{final_url}'. Query params may be lost.")
                
                # Extract title tag content
                title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
                if not title_match:
                    raise ValueError("No <title> tag found in HTML")
                
                title = title_match.group(1)
                
                # Extract count matching Slovak format e.g. "(1234 inzerátov)" or "(123 inzeráty)" etc.
                count_match = re.search(r'\((\d+)\s+inzerá', title)
                if not count_match:
                    raise ValueError(f"Could not parse count from title: '{title}'")
                
                count = int(count_match.group(1))
                print(f"  SUCCESS: Found {count} listings")
                return count
        except Exception as e:
            print(f"  ERROR on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                sleep_time = delay * (2 ** attempt)
                print(f"  Waiting {sleep_time} seconds before retrying...")
                time.sleep(sleep_time)
            else:
                print(f"  FAILED to scrape {name} after {max_retries} attempts.")
                raise e

def main():
    date_str = datetime.now().strftime("%d.%m.%Y")
    print(f"Starting Slovak Real Estate Scrape for Date: {date_str}\n")
    
    results = {}
    
    for name, url in URLS.items():
        try:
            count = fetch_count_with_retry(name, url)
            results[name] = count
            # Be polite to the server
            time.sleep(1.5)
        except Exception as e:
            print(f"CRITICAL: Failed to fetch {name}. Aborting script to prevent partial dataset.")
            exit(1)
            
    payload = {
        "date": date_str,
        "metrics": results
    }
    
    # 1. Save to local data.json
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
    
    data_history = []
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data_history = json.load(f)
                if not isinstance(data_history, list):
                    data_history = []
        except Exception as e:
            print(f"Could not read existing data.json: {e}. Starting fresh.")
            
    # Check if entry for today already exists and overwrite, otherwise append
    exists = False
    for idx, entry in enumerate(data_history):
        if entry.get("date") == date_str:
            data_history[idx] = payload
            exists = True
            print(f"Overwriting existing entry for date {date_str} in data.json")
            break
            
    if not exists:
        data_history.append(payload)
        print(f"Appending new entry for date {date_str} to data.json")
        
    try:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data_history, f, indent=2, ensure_ascii=False)
        print("Successfully updated local data.json")
    except Exception as e:
        print(f"CRITICAL: Failed to write to data.json: {e}")
        
    # 2. Push to Google Sheets if Webhook URL is set
    sheets_webhook = os.environ.get("GOOGLE_SHEETS_WEBHOOK_URL")
    if sheets_webhook:
        print("\nSending data payload to Google Sheets Web App bridge...")
        try:
            data_bytes = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                sheets_webhook,
                data=data_bytes,
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                resp_data = json.loads(response.read().decode('utf-8'))
                if resp_data.get("status") == "success":
                    print(f"Google Sheets response: SUCCESS. {resp_data.get('message')}")
                else:
                    print(f"Google Sheets response: ERROR. {resp_data.get('message')}")
        except Exception as e:
            print(f"Failed to post data to Google Sheets: {e}")
    else:
        print("\nGOOGLE_SHEETS_WEBHOOK_URL is not set. Skipping Google Sheets update.")
        
    print("\nScraping completed successfully!")

if __name__ == "__main__":
    main()
