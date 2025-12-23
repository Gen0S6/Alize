import json
import logging
import os
import re
import urllib.parse
import urllib.request
import base64
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional

log = logging.getLogger("alize.providers")
log.setLevel(logging.INFO)
if not log.handlers:
    log.addHandler(logging.StreamHandler())

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


def _http_get(url: str, timeout: float = 8.0, headers: Optional[Dict[str, str]] = None) -> str:
    merged_headers = DEFAULT_HEADERS.copy()
    if headers:
        merged_headers.update(headers)
    req = urllib.request.Request(url, headers=merged_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec
        return resp.read().decode("utf-8", errors="ignore")


def fetch_remotive_jobs(query: str, limit: int = 25) -> List[Dict]:
    params = urllib.parse.urlencode({"search": query, "limit": limit})
    url = f"https://remotive.com/api/remote-jobs?{params}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:  # type: ignore[attr-defined]  # nosec
            payload = resp.read().decode("utf-8")
            data = json.loads(payload)
            jobs = data.get("jobs", [])
            return [
                {
                    "title": job.get("title") or "Sans titre",
                    "company": job.get("company_name") or "N/A",
                    "location": job.get("candidate_required_location") or "Remote",
                    "url": job.get("url"),
                    "description": job.get("description"),
                    "salary_min": None,
                    "source": "Remotive",
                }
                for job in jobs
                if job.get("url")
            ]
    except Exception as exc:
        log.error("Remotive fetch failed for '%s': %s", query, exc)
        return []


def fetch_adzuna_jobs(query: str, location: str = "France", limit: int = 15) -> List[Dict]:
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")
    country = os.getenv("ADZUNA_COUNTRY", "fr")
    if not (app_id and app_key):
        log.info("Adzuna: missing credentials, skipping fetch for '%s'", query)
        return []
    page = 1
    params = {
        "app_id": app_id,
        "app_key": app_key,
        "what": query,
        "where": location or "",
        "results_per_page": limit,
        "sort_by": "date",
        "content-type": "application/json",
    }
    url = f"https://api.adzuna.com/v1/api/jobs/{country}/search/{page}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:  # nosec
            data = json.loads(resp.read().decode("utf-8"))
            results = []
            for item in data.get("results", [])[:limit]:
                results.append(
                    {
                        "title": item.get("title") or "Sans titre",
                        "company": (item.get("company") or {}).get("display_name") or "N/A",
                        "location": (item.get("location") or {}).get("display_name") or location or "N/A",
                        "url": item.get("redirect_url"),
                        "description": item.get("description"),
                        "source": "Adzuna",
                        "salary_min": item.get("salary_min"),
                    }
                )
            return results
    except Exception as exc:
        log.error("Adzuna fetch failed for '%s': %s", query, exc)
        return []


def _parse_indeed_cards(html: str, max_items: int = 15) -> List[Dict]:
    results: List[Dict] = []
    # Extract JSON embedded in mosaic provider data when present
    m = re.search(r'window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*({.*?});', html, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1))
            jobs = data.get("metaData", {}).get("mosaicProviderJobCardsModel", {}).get("results", [])
            for job in jobs:
                url = job.get("shareUrl") or job.get("viewJobLink")
                if not url:
                    continue
                results.append(
                    {
                        "title": job.get("title") or "Sans titre",
                        "company": job.get("company") or "N/A",
                        "location": job.get("formattedLocation") or job.get("jobLocationCity") or "N/A",
                        "url": url,
                        "description": None,
                        "source": "Indeed",
                    }
                )
                if len(results) >= max_items:
                    return results
        except Exception:
            pass

    # Fallback regex on card blocks
    for card in re.findall(r'(<a[^>]+data-jk="[^"]+".*?</a>)', html, re.DOTALL)[:max_items]:
        url_match = re.search(r'href="([^"]+)"', card)
        title_match = re.search(r'title="([^"]+)"', card)
        company_match = re.search(r'"companyName">([^<]+)<', card)
        loc_match = re.search(r'"companyLocation">([^<]+)<', card)
        url = url_match.group(1) if url_match else None
        if not url:
            continue
        if url.startswith("/"):
            url = "https://fr.indeed.com" + url
        results.append(
            {
                "title": (title_match.group(1).strip() if title_match else "Sans titre"),
                "company": (company_match.group(1).strip() if company_match else "N/A"),
                "location": (loc_match.group(1).strip() if loc_match else "N/A"),
                "url": url,
                "description": None,
                "source": "Indeed",
            }
        )
    return results[:max_items]


def fetch_indeed_jobs(query: str, location: str = "France", limit: int = 15) -> List[Dict]:
    rss_params = urllib.parse.urlencode(
        {
            "q": query,
            "l": location,
            "sort": "date",
            "fromage": "7",
        }
    )
    rss_url = f"https://fr.indeed.com/rss?{rss_params}"
    try:
        feed = _http_get(rss_url, timeout=8.0)
        root = ET.fromstring(feed)
        items = root.findall(".//item")
        jobs: List[Dict] = []
        for item in items[:limit]:
            title_raw = item.findtext("title") or "Sans titre"
            link = item.findtext("link") or ""
            # Essaye d'extraire la localisation en séparant sur ' - ' (format Indeed RSS)
            parts = title_raw.split(" - ")
            if len(parts) >= 2:
                title = " - ".join(parts[:-1])
                loc = parts[-1]
            else:
                title = title_raw
                loc = "N/A"
            jobs.append(
                {
                    "title": title.strip() or "Sans titre",
                    "company": "Indeed",  # RSS ne fournit pas la société; placeholder
                    "location": loc.strip(),
                    "url": link,
                    "description": None,
                    "source": "Indeed",
                    "salary_min": None,
                }
            )
        if jobs:
            return jobs
    except Exception as exc:
        log.error("Indeed RSS fetch failed for '%s': %s", query, exc)

    # Fallback HTML direct puis proxy
    params = urllib.parse.urlencode(
        {
            "q": query,
            "l": location,
            "sort": "date",
            "fromage": "7",  # last 7 days
        }
    )
    url = f"https://fr.indeed.com/jobs?{params}"
    for candidate_url, label in [(url, "direct"), (f"https://r.jina.ai/https://fr.indeed.com/jobs?{params}", "proxy")]:
        try:
            html_content = _http_get(candidate_url, timeout=8.0)
            jobs = _parse_indeed_cards(html_content, max_items=limit)
            if jobs:
                return jobs
        except Exception as exc:
            log.error("Indeed fetch failed (%s) for '%s': %s", label, query, exc)

    return []


def fetch_francetravail_token() -> Optional[str]:
    manual = os.getenv("FRANCETRAVAIL_TOKEN")
    if manual:
        log.info("France Travail token provided via env override.")
        return manual
    client_id = os.getenv("FRANCETRAVAIL_CLIENT_ID")
    client_secret = os.getenv("FRANCETRAVAIL_CLIENT_SECRET")
    if not (client_id and client_secret):
        log.warning("France Travail credentials missing in env")
        return None
    token_url = "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire"

    def attempt(scope: str, include_client: bool, use_basic: bool) -> Optional[str]:
        payload = {"grant_type": "client_credentials", "scope": scope}
        if include_client:
            payload["client_id"] = client_id
            payload["client_secret"] = client_secret
        data = urllib.parse.urlencode(payload).encode("utf-8")
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if use_basic:
            basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
            headers["Authorization"] = f"Basic {basic}"
        req = urllib.request.Request(token_url, data=data, method="POST", headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:  # nosec
                parsed = json.loads(resp.read().decode("utf-8"))
                if parsed.get("access_token"):
                    log.info("France Travail token retrieved via scope=%s (basic=%s include_client=%s)", scope, use_basic, include_client)
                    return parsed["access_token"]
        except Exception as exc:
            log.error("France Travail token attempt failed (scope=%s, basic=%s, include_client=%s): %s", scope, use_basic, include_client, exc)
        return None

    scopes = [
        "api_offresdemploiv2 o2dsoffre",  # scope officiel France Travail pour offres v2
        "api_offresdemploi o2dsoffre",    # fallback v1
        f"application_{client_id} api_offresdemploiv2",  # anciens formats essayés en dernier recours
        f"application_{client_id} api_offresdemploi",
    ]
    for scope in scopes:
        for include_client, use_basic in [(False, True), (True, False), (True, True)]:
            token = attempt(scope, include_client, use_basic)
            if token:
                return token
    return None


def fetch_francetravail_jobs(query: str, location: str = "France", limit: int = 15) -> List[Dict]:
    token = fetch_francetravail_token()
    if not token:
        log.warning("France Travail: no token, skipping fetch for '%s'", query)
        return []
    params = {
        "motsCles": query,
        "range": f"0-{max(0, limit-1)}",
        "sort": 1,  # date desc
    }
    # localisation simple : si location n'est pas "France", on tente en motsCles
    if location and location.lower() != "france":
        params["motsCles"] = f"{query} {location}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "X-API-KEY": os.getenv("FRANCETRAVAIL_CLIENT_ID", ""),
        "User-Agent": "alize-app",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }

    def run(url: str) -> Optional[Dict]:
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:  # nosec
                if getattr(resp, "status", None) == 204:
                    log.info("France Travail returned 204 No Content for %s", url)
                    return {}
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            log.warning("France Travail fetch failed for '%s' on %s: %s", query, url, exc)
            return None

    url_v2 = f"https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?{urllib.parse.urlencode(params)}"
    data = run(url_v2)
    if data is None:
        url_v1 = f"https://api.francetravail.io/partenaire/offresdemploi/search?{urllib.parse.urlencode(params)}"
        data = run(url_v1)
        if data is None:
            return []

    results = []
    for item in data.get("resultats", [])[:limit]:
        url_offre = (
            item.get("origineOffre", {}).get("urlOrigine")
            or item.get("origineOffre", {}).get("urlAnnonce")
            or ""
        )
        salaire_info = item.get("salaire") or {}
        salaire_min = salaire_info.get("basSalaire") or salaire_info.get("salaireBrut")
        results.append(
            {
                "title": item.get("intitule") or "Sans titre",
                "company": (item.get("entreprise") or {}).get("nom") or "N/A",
                "location": (item.get("lieuTravail") or {}).get("libelle") or "France",
                "url": url_offre,
                "description": item.get("description"),
                "source": "FranceTravail",
                "salary_min": salaire_min,
            }
        )
    log.info("France Travail: fetched %s offers for '%s'", len(results), query)
    return results


def _parse_linkedin_cards(html: str, max_items: int = 15) -> List[Dict]:
    cards = re.findall(r'(<li[^>]*>.*?base-card__full-link[^>]*href="[^"]+".*?</li>)', html, re.DOTALL)
    results: List[Dict] = []
    for card in cards:
        url_match = re.search(r'class="base-card__full-link[^"]*"[^>]*href="([^"]+)"', card)
        title_match = re.search(r'base-search-card__title[^>]*>\s*([^<]+)<', card)
        company_match = re.search(r'base-search-card__subtitle[^>]*>\s*<a[^>]*>\s*([^<]+)<', card)
        loc_match = re.search(r'job-search-card__location[^>]*>\s*([^<]+)<', card)
        url = url_match.group(1) if url_match else None
        if not url:
            continue
        results.append(
            {
                "title": title_match.group(1).strip() if title_match else "Sans titre",
                "company": company_match.group(1).strip() if company_match else "N/A",
                "location": loc_match.group(1).strip() if loc_match else "N/A",
                "url": url,
                "description": None,
                "source": "LinkedIn",
            }
        )
        if len(results) >= max_items:
            break
    return results


def fetch_linkedin_jobs(query: str, location: str = "France", limit: int = 15) -> List[Dict]:
    params = urllib.parse.urlencode(
        {
            "keywords": query,
            "location": location,
            "f_TPR": "r604800",  # last 7 days
            "position": 1,
            "pageNum": 0,
        }
    )
    url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?{params}"
    try:
        html = _http_get(url, timeout=8.0)
        jobs = _parse_linkedin_cards(html, max_items=limit)
        return jobs
    except Exception as exc:
        log.error("LinkedIn fetch failed for '%s': %s", query, exc)
        return []
