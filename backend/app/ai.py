import logging
import json
import os
import re
import unicodedata
from collections import Counter
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from .models import CV, JobListing, UserPreference, JobSearchRun
from .services.providers import (
    fetch_adzuna_jobs,
    fetch_francetravail_jobs,
    fetch_linkedin_jobs,
)
from urllib.parse import urlsplit, urlunsplit

log = logging.getLogger("alize.ai")

# Rapid heuristics to extract skills/roles without an external LLM.
STOPWORDS = {
    "le",
    "la",
    "les",
    "de",
    "des",
    "du",
    "un",
    "une",
    "et",
    "ou",
    "en",
    "pour",
    "avec",
    "sur",
    "dans",
    "par",
    "the",
    "a",
    "an",
    "of",
    "for",
    "to",
    "and",
    "or",
    "from",
    "on",
    "at",
    "au",
    "aux",
    "chez",
    "pas",
    "que",
    "qui",
    "est",
    "sont",
    "string",  # ignore placeholder extractions
}

PLACEHOLDER_VALUES = {"string", "-", "--", "n/a", "na"}


def _call_openai(prompt: str) -> Optional[dict]:
    """
    Appel OpenAI facultatif (désactivé si OPENAI_API_KEY absent ou lib non installée).
    Retourne un dict déjà parsé ou None en cas d'erreur.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        log.info("OPENAI_API_KEY manquante, analyse LLM ignorée.")
        return None
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Compatibilité openai v1+ (client) et v0.x (ChatCompletion)
    try:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=api_key)
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "Tu es un assistant recrutement français. Réponds strictement en JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=300,
            )
            content = resp.choices[0].message.content if resp and resp.choices else ""
        except ImportError:
            import openai

            openai.api_key = api_key
            resp = openai.ChatCompletion.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "Tu es un assistant recrutement français. Réponds strictement en JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=300,
            )
            content = resp.choices[0].message.get("content", "") if resp and resp.choices else ""

        if not content:
            return None
        try:
            return json.loads(content)
        except Exception:
            # Essaye d'extraire le JSON brut si entouré de texte
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1:
                return json.loads(content[start : end + 1])
    except Exception as exc:
        log.warning("OpenAI enrichissement ignoré: %s", exc)
    return None


def strip_accents(value: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn"
    )

# Expanded role detection
ROLE_HINTS = [
    # Data & AI
    "data scientist", "data analyst", "data engineer", "machine learning", "ml engineer",
    "ai engineer", "deep learning", "nlp engineer", "computer vision",
    # Development
    "backend", "frontend", "fullstack", "full stack", "full-stack",
    "software engineer", "software developer", "web developer", "mobile developer",
    "ios developer", "android developer", "react developer", "python developer",
    "java developer", "node developer", ".net developer", "php developer",
    # DevOps & Infrastructure
    "devops", "sre", "site reliability", "cloud engineer", "platform engineer",
    "infrastructure", "system administrator", "sysadmin", "network engineer",
    # Management & Product
    "product manager", "project manager", "tech lead", "team lead", "engineering manager",
    "cto", "vp engineering", "scrum master", "agile coach", "product owner",
    # Design & UX
    "ux designer", "ui designer", "product designer", "ux researcher",
    # Security
    "security engineer", "cybersecurity", "pentester", "security analyst",
    # QA
    "qa engineer", "test engineer", "quality assurance", "sdet",
    # Other tech roles
    "consultant", "architect", "solutions architect", "technical writer",
    "support engineer", "customer success",
]

# Technical skills to detect in CV (weighted higher than common words)
TECH_SKILLS = {
    # Programming Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "ruby", "go", "golang",
    "rust", "swift", "kotlin", "scala", "php", "perl", "r", "matlab", "julia",
    "objective-c", "dart", "elixir", "clojure", "haskell", "lua", "shell", "bash",
    # Frontend
    "react", "reactjs", "vue", "vuejs", "angular", "svelte", "nextjs", "next.js",
    "nuxt", "gatsby", "html", "css", "sass", "scss", "less", "tailwind", "bootstrap",
    "webpack", "vite", "redux", "mobx", "graphql", "apollo", "jquery",
    # Backend
    "nodejs", "node.js", "express", "fastapi", "django", "flask", "spring",
    "springboot", "rails", "laravel", "symfony", "asp.net", "nestjs", "koa",
    "fastify", "gin", "echo", "fiber",
    # Databases
    "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch",
    "cassandra", "dynamodb", "sqlite", "oracle", "mariadb", "neo4j", "couchdb",
    "firestore", "supabase", "prisma", "sequelize", "typeorm", "sqlalchemy",
    # Cloud & DevOps
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
    "terraform", "ansible", "jenkins", "gitlab", "github actions", "circleci",
    "travis", "nginx", "apache", "linux", "ubuntu", "debian", "centos",
    "prometheus", "grafana", "datadog", "splunk", "elk", "cloudflare",
    # Data & ML
    "pandas", "numpy", "scipy", "scikit-learn", "sklearn", "tensorflow", "pytorch",
    "keras", "spark", "hadoop", "airflow", "kafka", "rabbitmq", "celery",
    "jupyter", "tableau", "powerbi", "looker", "dbt", "snowflake", "bigquery",
    "databricks", "mlflow", "kubeflow", "sagemaker", "huggingface", "langchain",
    "openai", "gpt", "llm", "nlp", "opencv", "yolo",
    # Mobile
    "react native", "flutter", "ionic", "xamarin", "swiftui", "jetpack compose",
    # Tools & Practices
    "git", "jira", "confluence", "slack", "figma", "sketch", "adobe xd",
    "postman", "swagger", "openapi", "rest", "restful", "api", "microservices",
    "agile", "scrum", "kanban", "ci/cd", "cicd", "tdd", "bdd", "solid",
    # Security
    "oauth", "jwt", "ssl", "tls", "https", "encryption", "penetration testing",
    "owasp", "sso", "ldap", "saml",
}

# Experience level indicators
EXPERIENCE_INDICATORS = {
    "junior": ["junior", "débutant", "entry level", "graduate", "stagiaire", "alternant", "0-2 ans"],
    "mid": ["confirmé", "intermédiaire", "2-5 ans", "3-5 ans", "mid-level"],
    "senior": ["senior", "expérimenté", "5+ ans", "7+ ans", "10+ ans", "lead", "principal", "staff"],
    "management": ["manager", "directeur", "head of", "vp", "cto", "cio", "chief"],
}


def tokenize(text: str) -> List[str]:
    """
    Tokenizer tolérant : reconstruit des mots quand le PDF fournit des lettres espacées (q u a l i t e),
    nettoie la ponctuation et conserve les doublons pour la fréquence.
    """
    text_lower = text.lower()
    tokens: List[str] = []
    buffer: List[str] = []

    for raw in text_lower.replace("\n", " ").split():
        cleaned = re.sub(r"[^a-z0-9à-öø-ÿ']+", "", raw)
        if not cleaned:
            continue
        if len(cleaned) == 1 and cleaned.isalpha():
            buffer.append(cleaned)
            continue
        if buffer:
            joined = "".join(buffer)
            if len(joined) > 2:
                tokens.append(joined)
            buffer = []
        tokens.append(cleaned)

    if buffer:
        joined = "".join(buffer)
        if len(joined) > 2:
            tokens.append(joined)

    # fallback si vraiment rien trouvé
    if not tokens:
        tokens = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ']+", text_lower)

    # Splite les longs blobs en se servant de petits mots fréquents et motifs métier
    connectors = ["de", "en", "et", "du", "des", "la", "le"]
    patterns = [
        "interview",
        "redaction",
        "article",
        "reportage",
        "photo",
        "journal",
        "bachelor",
        "stage",
    ]
    expanded: List[str] = []
    for tok in tokens:
        modified = tok
        for c in connectors:
            modified = modified.replace(c, f" {c} ")
        for p in patterns:
            modified = re.sub(p, f" {p} ", modified)
        # Accent-insensitive split
        modified_no_accents = strip_accents(modified)
        for p in patterns:
            modified_no_accents = re.sub(p, f" {p} ", modified_no_accents)
        expanded.extend(modified_no_accents.split())
        expanded.extend(modified.split())

    email_markers = ("@", "gmail", "hotmail", "yahoo", "outlook", "icloud")
    filtered: List[str] = []
    for t in expanded:
        if len(t) < 3:
            continue
        if len(t) > 30:  # évite les blobs collés (emails concaténés)
            continue
        if any(marker in t for marker in email_markers):
            continue
        if t in STOPWORDS:
            continue
        filtered.append(t)
    return normalize_tokens(filtered)


def normalize_tokens(tokens: List[str]) -> List[str]:
    normalized: List[str] = []
    for t in tokens:
        base = strip_accents(t)
        replaced = False
        if "redaction" in base:
            normalized.append("redaction")
            replaced = True
        if "article" in base or "artic" in base:
            normalized.append("article")
            replaced = True
        if base.startswith("journal"):
            normalized.append("journal")
            replaced = True
        if base in {"jour", "journ"}:
            normalized.append("journal")
            replaced = True
        if base in {"stec", "stg", "stagee", "stge"} or base.startswith("stg"):
            normalized.append("stage")
            replaced = True
        if base in {"sprise", "spris", "prise"}:
            normalized.append("prise")
            replaced = True
        if not replaced:
            normalized.append(base)
    return normalized


def clean_field(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if trimmed.lower() in PLACEHOLDER_VALUES:
        return None
    return trimmed


def latest_cv(db: Session, user_id: int) -> Optional[CV]:
    return (
        db.query(CV)
        .filter(CV.user_id == user_id)
        .order_by(CV.id.desc())
        .first()
    )


def extract_tech_skills(text: str) -> List[str]:
    """
    Extract technical skills from text, prioritizing known tech terms.
    Returns skills sorted by relevance (exact matches first).
    """
    text_lower = text.lower()
    found_skills = []

    # Check for multi-word skills first (e.g., "react native", "machine learning")
    for skill in TECH_SKILLS:
        if " " in skill and skill in text_lower:
            found_skills.append(skill)

    # Then check single-word skills
    # Create word boundaries pattern to avoid partial matches
    words = set(re.findall(r'\b[a-z0-9#+.]+\b', text_lower))
    for skill in TECH_SKILLS:
        if " " not in skill and skill in words:
            if skill not in found_skills:
                found_skills.append(skill)

    return found_skills


def detect_experience_level(text: str) -> Optional[str]:
    """Detect experience level from CV text."""
    text_lower = text.lower()

    # Check from most senior to junior
    for level in ["management", "senior", "mid", "junior"]:
        indicators = EXPERIENCE_INDICATORS.get(level, [])
        if any(ind in text_lower for ind in indicators):
            return level

    # Try to detect from years of experience mentioned
    years_match = re.search(r'(\d+)\s*(?:ans?|years?)\s*(?:d\'?expérience|experience|exp)', text_lower)
    if years_match:
        years = int(years_match.group(1))
        if years >= 8:
            return "senior"
        elif years >= 3:
            return "mid"
        else:
            return "junior"

    return None


def infer_roles(cv_text: str, pref_role: Optional[str]) -> List[str]:
    """Infer potential job roles from CV text and preferences."""
    roles: List[str] = []
    if pref_role:
        roles.append(pref_role.lower())

    text = cv_text.lower()

    # Score each role hint based on how well it matches the CV
    role_scores: Dict[str, int] = {}
    for hint in ROLE_HINTS:
        if hint in text:
            # Count occurrences for ranking
            count = text.count(hint)
            role_scores[hint] = count

    # Sort by score and add to roles
    sorted_roles = sorted(role_scores.items(), key=lambda x: x[1], reverse=True)
    for role, _ in sorted_roles[:5]:  # Top 5 roles
        if role not in roles:
            roles.append(role)

    # Deduplicate while preserving order
    seen = set()
    ordered = []
    for r in roles:
        if r not in seen:
            ordered.append(r)
            seen.add(r)
    return ordered


def categorize_skills(skills: List[str]) -> Dict[str, List[str]]:
    """Categorize detected skills into groups."""
    categories = {
        "languages": [],
        "frontend": [],
        "backend": [],
        "databases": [],
        "cloud_devops": [],
        "data_ml": [],
        "mobile": [],
        "tools": [],
    }

    skill_categories = {
        # Languages
        "python": "languages", "javascript": "languages", "typescript": "languages",
        "java": "languages", "c++": "languages", "c#": "languages", "ruby": "languages",
        "go": "languages", "golang": "languages", "rust": "languages", "swift": "languages",
        "kotlin": "languages", "scala": "languages", "php": "languages", "r": "languages",
        # Frontend
        "react": "frontend", "reactjs": "frontend", "vue": "frontend", "vuejs": "frontend",
        "angular": "frontend", "svelte": "frontend", "nextjs": "frontend", "next.js": "frontend",
        "html": "frontend", "css": "frontend", "tailwind": "frontend", "bootstrap": "frontend",
        "webpack": "frontend", "vite": "frontend", "redux": "frontend",
        # Backend
        "nodejs": "backend", "node.js": "backend", "express": "backend", "fastapi": "backend",
        "django": "backend", "flask": "backend", "spring": "backend", "rails": "backend",
        "laravel": "backend", "nestjs": "backend", "graphql": "backend",
        # Databases
        "sql": "databases", "mysql": "databases", "postgresql": "databases", "postgres": "databases",
        "mongodb": "databases", "redis": "databases", "elasticsearch": "databases",
        "dynamodb": "databases", "sqlite": "databases", "prisma": "databases",
        # Cloud & DevOps
        "aws": "cloud_devops", "azure": "cloud_devops", "gcp": "cloud_devops",
        "docker": "cloud_devops", "kubernetes": "cloud_devops", "k8s": "cloud_devops",
        "terraform": "cloud_devops", "jenkins": "cloud_devops", "gitlab": "cloud_devops",
        "linux": "cloud_devops", "nginx": "cloud_devops", "ci/cd": "cloud_devops",
        # Data & ML
        "pandas": "data_ml", "numpy": "data_ml", "tensorflow": "data_ml", "pytorch": "data_ml",
        "scikit-learn": "data_ml", "sklearn": "data_ml", "spark": "data_ml", "kafka": "data_ml",
        "airflow": "data_ml", "jupyter": "data_ml", "tableau": "data_ml", "powerbi": "data_ml",
        "llm": "data_ml", "nlp": "data_ml", "opencv": "data_ml", "huggingface": "data_ml",
        # Mobile
        "react native": "mobile", "flutter": "mobile", "ionic": "mobile", "swiftui": "mobile",
        # Tools
        "git": "tools", "jira": "tools", "figma": "tools", "postman": "tools",
        "agile": "tools", "scrum": "tools", "api": "tools", "rest": "tools",
    }

    for skill in skills:
        category = skill_categories.get(skill, "tools")
        if skill not in categories[category]:
            categories[category].append(skill)

    # Remove empty categories
    return {k: v for k, v in categories.items() if v}


def build_queries(
    roles: List[str],
    must_keywords: List[str],
    top_keywords: List[str],
    location: Optional[str],
) -> List[str]:
    queries: List[str] = []
    base_role = roles[0] if roles else None
    if base_role:
        queries.append(base_role)
    if must_keywords:
        queries.append(" ".join([base_role or "", *must_keywords[:2]]).strip())
    if not queries and top_keywords:
        queries.append(" ".join(top_keywords[:2]))
    # quelques variations sur les mots clés
    for kw in top_keywords[:3]:
        if base_role:
            queries.append(f"{base_role} {kw}")
        else:
            queries.append(kw)

    if location:
        queries = [f"{q} {location}" for q in queries if q]

    # déduplication + filtre des placeholders
    seen = set()
    unique_queries = []
    for q in queries:
        q = q.strip()
        if not q or q in seen or "string" in q:
            continue
        unique_queries.append(q)
        seen.add(q)
    return unique_queries[:5]


def extract_must_hits(cv_tokens: List[str], must_keywords: List[str]) -> Tuple[List[str], List[str]]:
    tokens_set = set(cv_tokens)

    def keyword_parts(kw: str) -> List[str]:
        base = strip_accents(kw.lower())
        parts = re.split(r"[^a-z0-9]+", base)
        return [p for p in parts if len(p) >= 3]

    hits: List[str] = []
    missing: List[str] = []
    for kw in must_keywords:
        parts = keyword_parts(kw)
        if not parts:
            continue
        if all(part in tokens_set for part in parts):
            hits.append(kw)
        else:
            missing.append(kw)
    return hits, missing


def analyze_profile(db: Session, user_id: int, pref: UserPreference) -> Dict:
    """
    Comprehensive CV and profile analysis.
    Returns detected skills, roles, experience level, and search queries.
    """
    cv = latest_cv(db, user_id)
    cv_text = cv.text or "" if cv else ""

    # Extract technical skills first (more accurate than generic tokenization)
    tech_skills = extract_tech_skills(cv_text) if cv_text else []

    # Also get general tokens for frequency analysis
    tokens = tokenize(cv_text) if cv_text else []

    # Combine tech skills with top frequent tokens (prioritize tech skills)
    top_tokens = [w for w, _ in Counter(tokens).most_common(20)]
    # Tech skills first, then other frequent keywords not already in tech_skills
    top_keywords = tech_skills[:15] + [t for t in top_tokens if t not in tech_skills][:5]
    top_keywords = top_keywords[:15]  # Limit to 15

    # Detect experience level
    experience_level = detect_experience_level(cv_text) if cv_text else None

    # Categorize skills for better display
    skill_categories = categorize_skills(tech_skills) if tech_skills else {}

    cleaned_role = clean_field(pref.role)
    cleaned_location = clean_field(pref.location)
    roles = infer_roles(cv_text, cleaned_role)

    must_keywords_raw = [
        kw for kw in (pref.must_keywords or "").split(",") if kw.strip()
    ]
    must_keywords = [
        kw.strip().lower()
        for kw in must_keywords_raw
        if kw.strip() and kw.strip().lower() not in PLACEHOLDER_VALUES
    ]
    hits, missing = extract_must_hits(tokens, must_keywords)

    queries = build_queries(roles, must_keywords, top_keywords, cleaned_location)
    summary_parts = []
    llm_used = False

    # Optionnel : enrichir avec OpenAI si dispo
    llm_enriched = None
    if cv_text or pref.must_keywords or pref.role or pref.location:
        # Include detected skills in prompt for better context
        skills_context = ", ".join(tech_skills[:20]) if tech_skills else "non détectées"
        prompt = (
            "Analyse ce CV et ces préférences et propose des requêtes d'emploi pour la France.\n"
            f"Rôle souhaité: {cleaned_role or 'non précisé'}\n"
            f"Localisation: {cleaned_location or 'France'}\n"
            f"Niveau détecté: {experience_level or 'non détecté'}\n"
            f"Compétences techniques détectées: {skills_context}\n"
            f"Mots-clés obligatoires: {', '.join(must_keywords) or '—'}\n"
            f"Texte CV (tronqué): {cv_text[:1500]}\n"
            'Réponds en JSON: {"queries": ["..."], "resume": "1-2 phrases", "tags": ["tag1","tag2","tag3"]}'
        )
        llm_enriched = _call_openai(prompt)

    if llm_enriched:
        llm_used = True
        llm_queries = [q for q in llm_enriched.get("queries", []) if isinstance(q, str)]
        if llm_queries:
            queries = llm_queries[:5]
        llm_summary = llm_enriched.get("resume")
        if isinstance(llm_summary, str) and llm_summary.strip():
            summary_parts = [llm_summary.strip()]
        llm_tags = [t for t in llm_enriched.get("tags", []) if isinstance(t, str)]
        if llm_tags:
            # Merge LLM tags with detected tech skills
            merged = tech_skills[:10] + [t for t in llm_tags if t not in tech_skills]
            top_keywords = merged[:15]

    # Build summary
    if experience_level:
        level_labels = {
            "junior": "Junior / Débutant",
            "mid": "Confirmé (3-5 ans)",
            "senior": "Senior / Expert",
            "management": "Manager / Direction"
        }
        summary_parts.append(f"Niveau: {level_labels.get(experience_level, experience_level)}")

    if roles:
        summary_parts.append(f"Rôle cible: {roles[0]}")

    if tech_skills:
        # Show categorized skills in summary
        main_skills = tech_skills[:5]
        summary_parts.append(f"Compétences clés: {', '.join(main_skills)}")

    if hits:
        summary_parts.append(f"Mots-clés trouvés: {', '.join(hits)}")
    if missing:
        summary_parts.append(f"À renforcer: {', '.join(missing)}")

    if not summary_parts:
        summary_parts.append("Ajoute un CV et des préférences pour une analyse plus fine.")

    return {
        "cv_present": bool(cv),
        "top_keywords": top_keywords,
        "inferred_roles": roles,
        "suggested_queries": queries,
        "must_hits": hits,
        "missing_must": missing,
        "summary": " | ".join(summary_parts),
        "llm_used": llm_used,
        # New fields for enhanced analysis
        "experience_level": experience_level,
        "skill_categories": skill_categories,
        "tech_skills_count": len(tech_skills),
    }
def search_jobs_for_user(
    db: Session,
    user_id: int,
    pref: UserPreference,
    max_queries: int = 3,
    force: bool = False,
) -> Dict:
    last_run = (
        db.query(JobSearchRun)
        .filter(JobSearchRun.user_id == user_id)
        .order_by(JobSearchRun.created_at.desc())
        .first()
    )
    latest_cv_obj = latest_cv(db, user_id)
    pref_updated = pref.updated_at or pref.created_at
    if (
        not force
        and last_run
        and pref_updated
        and pref_updated <= last_run.created_at
        and (not latest_cv_obj or latest_cv_obj.created_at <= last_run.created_at)
    ):
        cached = None
        try:
            cached = json.loads(last_run.analysis_json) if last_run.analysis_json else None
        except Exception:
            cached = None
        return {
            "inserted": 0,
            "tried_queries": [],
            "sources": {},
            "analysis": cached or analyze_profile(db, user_id, pref),
        }

    analysis = analyze_profile(db, user_id, pref)
    queries = analysis.get("suggested_queries", []) or []
    tried = []
    sources: Dict[str, int] = {}
    inserted = 0

    def normalize_url(raw: str) -> Optional[str]:
        if not raw:
            return None
        try:
            parts = urlsplit(raw)
            # drop query/fragment to éviter les doublons tracking
            cleaned = urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/"), "", ""))
            return cleaned
        except Exception:
            return raw

    providers = [
        ("FranceTravail", lambda q: fetch_francetravail_jobs(q, location=pref.location or "France")),
        ("Adzuna", lambda q: fetch_adzuna_jobs(q, location=pref.location or "France")),
        ("LinkedIn", lambda q: fetch_linkedin_jobs(q, location=pref.location or "France")),
    ]

    for query in queries[:max_queries]:
        tried.append(query)
        for source_name, fetcher in providers:
            jobs = []
            try:
                log.info("Fetching %s for query '%s'", source_name, query)
                jobs = fetcher(query)
                log.info("%s returned %s jobs for '%s'", source_name, len(jobs) if jobs else 0, query)
            except Exception as exc:
                log.error("%s fetcher failed for '%s': %s", source_name, query, exc)
            for job in jobs:
                if not job.get("url"):
                    continue
                norm_url = normalize_url(job.get("url"))
                if not norm_url:
                    continue
                existing = (
                    db.query(JobListing)
                    .filter(JobListing.url.like(f"{norm_url}%"))
                    .first()
                )
                if existing:
                    continue
                record = JobListing(
                    source=job.get("source") or source_name,
                    title=(job.get("title") or "Sans titre")[:255],
                    company=(job.get("company") or "N/A")[:255],
                    location=job.get("location"),
                    url=job["url"],
                    description=job.get("description"),
                    salary_min=job.get("salary_min"),
                )
                db.add(record)
                inserted += 1
                src_key = job.get("source") or source_name
                sources[src_key] = sources.get(src_key, 0) + 1
    db.commit()

    return {
        "inserted": inserted,
        "tried_queries": tried,
        "sources": sources,
        "analysis": analysis,
    }
