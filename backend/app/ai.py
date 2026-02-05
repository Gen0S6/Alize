import logging
import json
import os
import re
import unicodedata
from collections import Counter
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any

from sqlalchemy.orm import Session

from .models import CV, JobListing, UserPreference, JobSearchRun
from .services.providers import (
    fetch_adzuna_jobs,
    fetch_francetravail_jobs,
    fetch_linkedin_jobs,
)
from .services.matching import add_jobs_to_user_dashboard, cv_keywords
from urllib.parse import urlsplit, urlunsplit

log = logging.getLogger("alize.ai")


# =============================================================================
# CERTIFICATIONS DATABASE
# =============================================================================
CERTIFICATIONS = {
    # Cloud & DevOps
    "aws": [
        "aws certified", "aws solutions architect", "aws developer", "aws sysops",
        "aws devops", "aws cloud practitioner", "aws security specialty",
        "aws machine learning", "aws data analytics", "aws database specialty",
        "saa-c02", "saa-c03", "dva-c01", "soa-c02", "dop-c01", "clf-c01",
    ],
    "azure": [
        "azure certified", "az-900", "az-104", "az-204", "az-400", "az-305",
        "azure fundamentals", "azure administrator", "azure developer",
        "azure solutions architect", "azure devops engineer",
    ],
    "gcp": [
        "google cloud certified", "gcp certified", "associate cloud engineer",
        "professional cloud architect", "professional data engineer",
        "professional cloud developer", "professional cloud devops",
    ],
    "kubernetes": [
        "cka", "ckad", "cks", "certified kubernetes administrator",
        "certified kubernetes developer", "certified kubernetes security",
    ],
    # Project Management
    "project_management": [
        "pmp", "prince2", "psm", "csm", "pspo", "cspo", "safe",
        "project management professional", "scrum master", "product owner",
        "agile certified", "lean six sigma", "green belt", "black belt",
    ],
    # Data & Analytics
    "data": [
        "databricks certified", "snowflake certified", "tableau certified",
        "power bi certified", "google analytics certified", "ga4 certified",
        "microsoft certified data analyst", "data science certified",
    ],
    # Security
    "security": [
        "cissp", "cism", "ceh", "oscp", "comptia security+", "security+",
        "iso 27001 lead auditor", "iso 27001 lead implementer",
        "certified ethical hacker", "penetration testing",
    ],
    # Programming & Development
    "development": [
        "oracle certified", "java certified", "spring certified",
        "microsoft certified developer", "mcsd", "mcp",
        "salesforce certified", "salesforce administrator", "salesforce developer",
    ],
    # Languages
    "languages": [
        "toeic", "toefl", "ielts", "cambridge", "bulats", "linguaskill",
        "delf", "dalf", "tcf", "tef", "goethe", "dele", "jlpt", "hsk",
    ],
    # Finance & Accounting
    "finance": [
        "cfa", "cpa", "acca", "dscg", "dcg", "dec",
        "chartered financial analyst", "certified public accountant",
    ],
    # HR
    "hr": [
        "shrm", "phr", "sphr", "cipd", "gphr",
    ],
    # IT General
    "it_general": [
        "itil", "cobit", "togaf", "comptia a+", "comptia network+",
        "cisco ccna", "ccnp", "ccie", "ccna", "mcse", "mcsa",
    ],
}

# Flatten certifications for quick lookup
ALL_CERTIFICATIONS = set()
for cert_list in CERTIFICATIONS.values():
    ALL_CERTIFICATIONS.update(cert_list)


# =============================================================================
# ACHIEVEMENT/PROJECT PATTERNS
# =============================================================================
ACHIEVEMENT_PATTERNS = [
    # Quantified achievements
    r"(?:augment|increas|improv|boost|rais|grew|growth|hausse|amélio|optimis)[eéa]?\w*\s+(?:de\s+)?(\d+[\s,.]?\d*\s*%)",
    r"(\d+[\s,.]?\d*\s*%)\s+(?:d'?augmentation|de croissance|d'amélioration|increase|growth|improvement)",
    r"(?:rédui|diminu|décr|reduc|decreas|cut|saved|économi)[teésir]*\w*\s+(?:de\s+)?(\d+[\s,.]?\d*\s*[%€$kK])",
    r"(\d+[\s,.]?\d*\s*[kKmM]?[€$])\s+(?:de chiffre d'affaires|de CA|revenue|savings|budget)",
    # Team/Project scale
    r"(?:équipe|team|managed|géré|dirigé|encadré)\s+(?:de\s+)?(\d+)\s+(?:personnes|collaborateurs|people|developers|membres)",
    r"(\d+)\s+(?:projets?|projects?|clients?|missions?)",
    # Impact statements
    r"(?:lancé|launched|déployé|deployed|livré|delivered|créé|created|développé|developed)\s+(\d+)\s+",
    r"(?:leader|pilote|responsible|responsable)\s+(?:de|du|d'un)?\s*(?:projet|project|initiative)",
]

PROJECT_INDICATORS = [
    "projet", "project", "mission", "réalisation", "achievement",
    "développement de", "création de", "mise en place", "implementation",
    "lancement", "launch", "déploiement", "deployment", "migration",
    "refonte", "redesign", "optimisation", "optimization",
]


# =============================================================================
# WORK EXPERIENCE PATTERNS
# =============================================================================
DATE_PATTERNS = [
    # French formats
    r"(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})",
    r"(jan|fév|fev|mar|avr|mai|juin|juil|jul|août|aout|sep|sept|oct|nov|déc|dec)\.?\s*(\d{4})",
    # English formats
    r"(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})",
    r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s*(\d{4})",
    # Numeric formats
    r"(\d{1,2})[/\-](\d{4})",
    r"(\d{4})\s*[-–—]\s*(\d{4}|présent|present|actuel|aujourd'hui|current|now)",
]

DURATION_INDICATORS = [
    "présent", "present", "actuel", "aujourd'hui", "current", "now", "en cours",
]

JOB_TITLE_PATTERNS = [
    # Common title formats
    r"^([A-ZÀ-Ú][a-zà-ü]+(?:\s+[A-ZÀ-Ú]?[a-zà-ü]+)*)\s*[-–—|:]\s*",
    r"(?:poste|position|titre|title)\s*:\s*(.+?)(?:\n|$)",
]

COMPANY_INDICATORS = [
    "chez", "at", "@", "pour", "for", "entreprise", "company", "société", "group", "groupe",
]

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
    "plus",
    "cette",
    "ces",
    "ses",
    "son",
    "mon",
    "mes",
    "notre",
    "nos",
    "leur",
    "leurs",
    "tout",
    "tous",
    "toute",
    "toutes",
    "aussi",
    "ainsi",
    "comme",
    "mais",
    "donc",
    "car",
    "etc",
    "ans",
    "annee",
    "annees",
    "mois",
    "jour",
    "jours",
}

PLACEHOLDER_VALUES = {"string", "-", "--", "n/a", "na"}

# Comprehensive French job market skills dictionary
SKILL_CATEGORIES = {
    "langages_programmation": {
        "python", "java", "javascript", "typescript", "php", "ruby", "golang", "go",
        "rust", "scala", "kotlin", "swift", "objective-c", "c++", "c#", "csharp",
        "sql", "nosql", "r", "matlab", "perl", "bash", "shell", "powershell",
    },
    "frameworks_web": {
        "react", "reactjs", "angular", "vue", "vuejs", "nextjs", "nuxt", "svelte",
        "django", "flask", "fastapi", "express", "nestjs", "spring", "springboot",
        "laravel", "symfony", "rails", "asp.net", "dotnet", ".net",
    },
    "data_ml": {
        "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn", "pandas",
        "numpy", "spark", "hadoop", "airflow", "kafka", "databricks", "mlflow",
        "jupyter", "tableau", "powerbi", "looker", "metabase",
    },
    "cloud_devops": {
        "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "terraform",
        "ansible", "jenkins", "gitlab", "github", "ci/cd", "cicd", "linux",
        "nginx", "apache", "redis", "elasticsearch", "mongodb", "postgresql",
        "mysql", "oracle", "prometheus", "grafana",
    },
    "outils_design": {
        "figma", "sketch", "adobe", "photoshop", "illustrator", "indesign",
        "premiere", "aftereffects", "canva", "xd", "invision",
    },
    "communication_media": {
        "redaction", "journalisme", "communication", "editorial", "presse",
        "media", "medias", "audiovisuel", "video", "photo", "photographie",
        "reportage", "interview", "podcast", "reseaux sociaux", "community management",
        "seo", "sem", "content", "copywriting", "storytelling",
    },
    "marketing_commerce": {
        "marketing", "digital", "crm", "salesforce", "hubspot", "mailchimp",
        "analytics", "adwords", "facebook ads", "linkedin ads", "e-commerce",
        "b2b", "b2c", "growth", "acquisition", "conversion", "kpi",
    },
    "gestion_projet": {
        "agile", "scrum", "kanban", "jira", "trello", "asana", "notion",
        "confluence", "monday", "ms project", "prince2", "pmp", "lean",
    },
    "soft_skills": {
        "autonomie", "rigueur", "organisation", "communication", "teamwork",
        "leadership", "creativite", "adaptabilite", "proactivite", "curiosite",
        "esprit d'equipe", "gestion du stress", "resolution de problemes",
    },
    "langues": {
        "francais", "anglais", "espagnol", "allemand", "italien", "portugais",
        "chinois", "mandarin", "japonais", "arabe", "russe", "neerlandais",
        "bilingue", "courant", "professionnel", "natif", "toeic", "toefl", "ielts",
    },
}

# Flatten skills for quick lookup
ALL_SKILLS = set()
for category_skills in SKILL_CATEGORIES.values():
    ALL_SKILLS.update(category_skills)

# Extended role hints for French job market
ROLE_HINTS = [
    # Tech
    "data scientist",
    "data analyst",
    "data engineer",
    "machine learning",
    "ml engineer",
    "backend",
    "frontend",
    "fullstack",
    "full stack",
    "devops",
    "software engineer",
    "web developer",
    "mobile developer",
    "developpeur",
    "ingenieur",
    "architecte",
    "tech lead",
    "cto",
    # Product & Project
    "product manager",
    "product owner",
    "project manager",
    "chef de projet",
    "scrum master",
    # Marketing & Communication
    "community manager",
    "social media manager",
    "content manager",
    "seo manager",
    "growth hacker",
    "charge de communication",
    "responsable marketing",
    "directeur marketing",
    # Media & Journalisme
    "journaliste",
    "redacteur",
    "redactrice",
    "reporter",
    "editeur",
    "charge de presse",
    "attache de presse",
    "responsable editorial",
    # Design
    "designer",
    "ux designer",
    "ui designer",
    "graphic designer",
    "directeur artistique",
    # Commerce & Business
    "commercial",
    "business developer",
    "account manager",
    "sales",
    "charge d'affaires",
    "responsable commercial",
    # RH & Admin
    "rh",
    "ressources humaines",
    "recruteur",
    "assistant",
    "assistante",
    "office manager",
    # Finance
    "comptable",
    "controleur de gestion",
    "analyste financier",
    "auditeur",
]

# Experience level indicators
EXPERIENCE_LEVELS = {
    "junior": ["junior", "debutant", "stage", "stagiaire", "alternance", "alternant", "apprenti", "apprentissage", "1ere experience", "premiere experience", "0-2 ans"],
    "confirme": ["confirme", "2-5 ans", "3 ans", "4 ans", "5 ans", "intermediaire"],
    "senior": ["senior", "expert", "lead", "principal", "5+ ans", "10 ans", "15 ans", "manager", "directeur", "responsable", "chef"],
}

# Education keywords
EDUCATION_KEYWORDS = {
    "ecoles": [
        "hec", "essec", "escp", "edhec", "em lyon", "kedge", "skema", "neoma",
        "polytechnique", "centrale", "mines", "ponts", "enpc", "ensae", "ensai",
        "sciences po", "iep", "celsa", "cfj", "esj", "ipj", "ejt", "isj", "isfj",
        "epitech", "42", "epita", "supinfo", "esiea", "efrei",
        "dauphine", "sorbonne", "pantheon", "assas", "nanterre",
        "universite", "faculte", "iut", "bts", "dut",
    ],
    "diplomes": [
        "bac", "baccalaureat", "licence", "bachelor", "master", "mastere",
        "mba", "doctorat", "phd", "ingenieur", "dess", "dea",
        "bts", "dut", "deug", "cap", "bep",
    ],
}


def strip_accents(value: str) -> str:
    """Remove accents from a string for accent-insensitive matching."""
    return "".join(
        c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn"
    )


def _call_openai(prompt: str, max_tokens: int = 600) -> Optional[dict]:
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
                        "content": (
                            "Tu es un expert en recrutement et analyse de CV français. "
                            "Tu analyses les CV pour extraire des informations structurées et pertinentes. "
                            "Réponds UNIQUEMENT en JSON valide, sans texte avant ou après."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=max_tokens,
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
                        "content": (
                            "Tu es un expert en recrutement et analyse de CV français. "
                            "Tu analyses les CV pour extraire des informations structurées et pertinentes. "
                            "Réponds UNIQUEMENT en JSON valide, sans texte avant ou après."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=max_tokens,
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


def extract_skills_from_text(text: str) -> Dict[str, List[str]]:
    """
    Extract skills from CV text and categorize them.
    Returns a dict with skill categories as keys and found skills as values.
    """
    text_lower = strip_accents(text.lower())
    found_skills: Dict[str, List[str]] = {}

    for category, skills in SKILL_CATEGORIES.items():
        category_matches = []
        for skill in skills:
            skill_normalized = strip_accents(skill.lower())
            # Check for word boundaries to avoid false positives
            if re.search(rf'\b{re.escape(skill_normalized)}\b', text_lower):
                category_matches.append(skill)
        if category_matches:
            found_skills[category] = category_matches

    return found_skills


def extract_education(text: str) -> Dict[str, List[str]]:
    """
    Extract education information from CV text.
    Returns dict with 'ecoles' and 'diplomes' keys.
    """
    text_lower = strip_accents(text.lower())
    found_education: Dict[str, List[str]] = {"ecoles": [], "diplomes": []}

    for edu_type, keywords in EDUCATION_KEYWORDS.items():
        for kw in keywords:
            kw_normalized = strip_accents(kw.lower())
            if kw_normalized in text_lower:
                if kw not in found_education[edu_type]:
                    found_education[edu_type].append(kw)

    return found_education


# =============================================================================
# NEW EXTRACTION FUNCTIONS
# =============================================================================

def extract_certifications(text: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Extract professional certifications from CV text.
    Returns dict with certification categories and found certifications.
    """
    text_lower = strip_accents(text.lower())
    found_certs: Dict[str, List[Dict[str, Any]]] = {}

    for category, cert_patterns in CERTIFICATIONS.items():
        category_matches = []
        for cert in cert_patterns:
            cert_normalized = strip_accents(cert.lower())
            if cert_normalized in text_lower:
                # Try to extract score/level for language certs
                score = None
                if category == "languages":
                    # Look for TOEIC/TOEFL scores
                    score_patterns = [
                        rf"{cert_normalized}\s*[:\-]?\s*(\d{{3,4}})",
                        rf"(\d{{3,4}})\s*(?:points?)?\s*(?:au|à|at)?\s*{cert_normalized}",
                    ]
                    for sp in score_patterns:
                        match = re.search(sp, text_lower)
                        if match:
                            score = match.group(1)
                            break

                cert_info = {"name": cert, "score": score}
                if cert_info not in category_matches:
                    category_matches.append(cert_info)

        if category_matches:
            found_certs[category] = category_matches

    return found_certs


def extract_work_experiences(text: str) -> List[Dict[str, Any]]:
    """
    Extract structured work experiences from CV text.
    Returns list of experiences with company, role, dates, and responsibilities.
    """
    experiences: List[Dict[str, Any]] = []
    text_lower = text.lower()

    # Find all date ranges in the text
    date_ranges = []
    year_pattern = r"(\d{4})\s*[-–—]\s*(\d{4}|présent|present|actuel|aujourd'hui|current|now|en cours)"
    for match in re.finditer(year_pattern, text_lower):
        start_year = match.group(1)
        end_year = match.group(2)
        is_current = end_year.lower() in DURATION_INDICATORS or not end_year.isdigit()
        date_ranges.append({
            "start": start_year,
            "end": "present" if is_current else end_year,
            "is_current": is_current,
            "position": match.start(),
        })

    # Extract context around each date range
    for i, date_range in enumerate(date_ranges):
        pos = date_range["position"]

        # Get surrounding text (200 chars before and 500 after)
        start_pos = max(0, pos - 200)
        end_pos = min(len(text), pos + 500)
        context = text[start_pos:end_pos]

        # Try to extract company name
        company = None
        company_patterns = [
            r"(?:chez|at|@)\s+([A-Z][A-Za-zÀ-ÿ\s&\-\.]+?)(?:\s*[-–—|,\n]|\s+(?:en|depuis|from))",
            r"([A-Z][A-Za-z0-9À-ÿ\s&\-\.]{2,30})\s*[-–—|]\s*[A-Z]",
            r"(?:entreprise|company|société)\s*[:\-]?\s*([A-Za-zÀ-ÿ\s&\-\.]+?)(?:\n|,)",
        ]
        for cp in company_patterns:
            match = re.search(cp, context)
            if match:
                company = match.group(1).strip()
                break

        # Try to extract job title
        title = None
        title_patterns = [
            r"([A-ZÀ-Ú][a-zà-ü]+(?:\s+[a-zà-ü]+){0,4})\s*[-–—|]\s*(?:" + (company or "") + ")",
            r"(?:poste|position|titre)\s*[:\-]?\s*([A-Za-zÀ-ÿ\s\-]+?)(?:\n|,)",
            r"^([A-ZÀ-Ú][a-zà-ü\s\-]+?)(?:\n|\s{2,})",
        ]
        for tp in title_patterns:
            match = re.search(tp, context, re.MULTILINE)
            if match:
                title = match.group(1).strip()
                if len(title) > 5 and len(title) < 80:
                    break
                title = None

        # Extract responsibilities (bullet points or key phrases)
        responsibilities = []
        resp_patterns = [
            r"[-•·]\s*([A-Za-zÀ-ÿ].{10,100}?)(?=\n|$)",
            r"(?:^|\n)\s*[→►▪]\s*([A-Za-zÀ-ÿ].{10,100}?)(?=\n|$)",
        ]
        for rp in resp_patterns:
            for match in re.finditer(rp, context):
                resp = match.group(1).strip()
                if len(resp) > 15 and resp not in responsibilities:
                    responsibilities.append(resp)

        experience = {
            "company": company,
            "title": title,
            "start_date": date_range["start"],
            "end_date": date_range["end"],
            "is_current": date_range["is_current"],
            "responsibilities": responsibilities[:5],  # Limit to 5
            "duration_years": _calculate_duration(date_range["start"], date_range["end"]),
        }

        # Only add if we have meaningful data
        if company or title:
            experiences.append(experience)

    # Deduplicate and sort by date
    seen = set()
    unique_experiences = []
    for exp in experiences:
        key = (exp.get("company"), exp.get("title"), exp.get("start_date"))
        if key not in seen:
            seen.add(key)
            unique_experiences.append(exp)

    # Sort by start date (most recent first)
    unique_experiences.sort(key=lambda x: x.get("start_date", "0"), reverse=True)

    return unique_experiences[:10]  # Limit to 10 experiences


def _calculate_duration(start_year: str, end_year: str) -> Optional[float]:
    """Calculate duration in years between two dates."""
    try:
        start = int(start_year)
        if end_year.lower() in DURATION_INDICATORS or not end_year.replace(" ", "").isdigit():
            end = datetime.now().year
        else:
            end = int(end_year)
        return max(0, end - start)
    except (ValueError, TypeError):
        return None


def extract_achievements(text: str) -> List[Dict[str, Any]]:
    """
    Extract quantified achievements and projects from CV text.
    Returns list of achievements with type, value, and context.
    """
    achievements: List[Dict[str, Any]] = []
    text_lower = text.lower()

    # Extract quantified achievements
    for pattern in ACHIEVEMENT_PATTERNS:
        for match in re.finditer(pattern, text_lower, re.IGNORECASE):
            # Get context around the match
            start = max(0, match.start() - 50)
            end = min(len(text), match.end() + 50)
            context = text[start:end].strip()

            achievement = {
                "type": _categorize_achievement(match.group(0)),
                "value": match.group(1) if match.groups() else None,
                "context": context,
                "raw_match": match.group(0),
            }

            # Avoid duplicates
            if not any(a["context"] == context for a in achievements):
                achievements.append(achievement)

    # Extract project mentions
    for indicator in PROJECT_INDICATORS:
        pattern = rf"(?:^|\n|\s)({indicator}\s+[^\.]+\.?)"
        for match in re.finditer(pattern, text_lower, re.IGNORECASE):
            context = match.group(1).strip()
            if len(context) > 20 and len(context) < 200:
                achievement = {
                    "type": "project",
                    "value": None,
                    "context": context,
                    "raw_match": indicator,
                }
                if not any(a["context"] == context for a in achievements):
                    achievements.append(achievement)

    return achievements[:15]  # Limit to 15 achievements


def _categorize_achievement(text: str) -> str:
    """Categorize an achievement based on its content."""
    text_lower = text.lower()

    if any(kw in text_lower for kw in ["augment", "increas", "growth", "hausse", "croissance"]):
        return "growth"
    elif any(kw in text_lower for kw in ["rédui", "diminu", "reduc", "cut", "saved", "économi"]):
        return "cost_saving"
    elif any(kw in text_lower for kw in ["équipe", "team", "managed", "géré", "encadré"]):
        return "team_management"
    elif any(kw in text_lower for kw in ["projet", "project", "lancé", "launched", "déployé"]):
        return "project"
    elif any(kw in text_lower for kw in ["client", "revenue", "chiffre", "vente", "sales"]):
        return "business"
    else:
        return "other"


def calculate_cv_quality_score(
    text: str,
    skills: List[str],
    experiences: List[Dict],
    education: Dict,
    certifications: Dict,
    achievements: List[Dict],
) -> Dict[str, Any]:
    """
    Calculate a CV quality score with detailed breakdown and improvement suggestions.
    Returns score (0-100) with category breakdown and suggestions.
    """
    scores = {
        "content_length": 0,
        "skills_diversity": 0,
        "experience_detail": 0,
        "education": 0,
        "certifications": 0,
        "achievements": 0,
        "formatting": 0,
        "keywords": 0,
    }
    suggestions: List[str] = []
    max_scores = {
        "content_length": 10,
        "skills_diversity": 20,
        "experience_detail": 25,
        "education": 10,
        "certifications": 10,
        "achievements": 15,
        "formatting": 5,
        "keywords": 5,
    }

    # 1. Content Length (10 points)
    word_count = len(text.split())
    if word_count >= 500:
        scores["content_length"] = 10
    elif word_count >= 300:
        scores["content_length"] = 7
    elif word_count >= 150:
        scores["content_length"] = 5
    else:
        scores["content_length"] = 2
        suggestions.append("Ajoute plus de détails à ton CV (minimum 300 mots recommandés)")

    # 2. Skills Diversity (20 points)
    skill_count = len(skills)
    if skill_count >= 15:
        scores["skills_diversity"] = 20
    elif skill_count >= 10:
        scores["skills_diversity"] = 15
    elif skill_count >= 5:
        scores["skills_diversity"] = 10
    elif skill_count >= 2:
        scores["skills_diversity"] = 5
    else:
        scores["skills_diversity"] = 0
        suggestions.append("Ajoute plus de compétences techniques et soft skills")

    # Check for skill categories diversity
    skill_categories_found = set()
    for skill in skills:
        skill_lower = skill.lower()
        if any(s in skill_lower for s in ["python", "java", "javascript", "react", "sql"]):
            skill_categories_found.add("tech")
        elif any(s in skill_lower for s in ["management", "leadership", "communication"]):
            skill_categories_found.add("soft")
        elif any(s in skill_lower for s in ["anglais", "english", "français"]):
            skill_categories_found.add("languages")

    if len(skill_categories_found) < 2:
        suggestions.append("Diversifie tes compétences: techniques, soft skills, et langues")

    # 3. Experience Detail (25 points)
    exp_count = len(experiences)
    exp_with_responsibilities = sum(1 for e in experiences if e.get("responsibilities"))
    exp_with_dates = sum(1 for e in experiences if e.get("start_date") and e.get("end_date"))

    if exp_count >= 3:
        scores["experience_detail"] += 10
    elif exp_count >= 1:
        scores["experience_detail"] += 5
    else:
        suggestions.append("Ajoute tes expériences professionnelles avec dates et détails")

    if exp_with_responsibilities >= 2:
        scores["experience_detail"] += 10
    elif exp_with_responsibilities >= 1:
        scores["experience_detail"] += 5
    else:
        suggestions.append("Détaille tes responsabilités pour chaque poste")

    if exp_with_dates >= exp_count * 0.8:
        scores["experience_detail"] += 5
    else:
        suggestions.append("Assure-toi que chaque expérience a des dates précises")

    # 4. Education (10 points)
    diplomas = education.get("diplomes", [])
    schools = education.get("ecoles", [])

    if diplomas:
        scores["education"] += 5
    else:
        suggestions.append("Mentionne ton niveau de diplôme (Bac, Licence, Master, etc.)")

    if schools:
        scores["education"] += 5
    else:
        suggestions.append("Indique le nom de ton école ou université")

    # 5. Certifications (10 points)
    cert_count = sum(len(certs) for certs in certifications.values())
    if cert_count >= 3:
        scores["certifications"] = 10
    elif cert_count >= 1:
        scores["certifications"] = 5
    else:
        suggestions.append("Ajoute des certifications professionnelles pertinentes (AWS, Scrum, TOEIC, etc.)")

    # 6. Achievements (15 points)
    quantified = sum(1 for a in achievements if a.get("value"))
    if quantified >= 3:
        scores["achievements"] = 15
    elif quantified >= 1:
        scores["achievements"] = 10
    elif achievements:
        scores["achievements"] = 5
    else:
        suggestions.append("Ajoute des réalisations chiffrées (+20% de ventes, équipe de 5 personnes, etc.)")

    # 7. Formatting (5 points)
    # Check for structure indicators
    has_sections = any(kw in text.lower() for kw in [
        "expérience", "experience", "formation", "education", "compétences", "skills",
        "projets", "projects", "langues", "languages"
    ])
    has_bullets = bool(re.search(r"[-•·►▪→]", text))

    if has_sections:
        scores["formatting"] += 3
    else:
        suggestions.append("Structure ton CV avec des sections claires (Expérience, Formation, Compétences)")

    if has_bullets:
        scores["formatting"] += 2
    else:
        suggestions.append("Utilise des bullet points pour les responsabilités et réalisations")

    # 8. Keywords (5 points)
    # Check for action verbs
    action_verbs = [
        "développé", "developed", "géré", "managed", "créé", "created",
        "optimisé", "optimized", "lancé", "launched", "dirigé", "led",
        "amélioré", "improved", "conçu", "designed", "implémenté", "implemented",
    ]
    action_verb_count = sum(1 for verb in action_verbs if verb in text.lower())

    if action_verb_count >= 5:
        scores["keywords"] = 5
    elif action_verb_count >= 2:
        scores["keywords"] = 3
    else:
        suggestions.append("Utilise des verbes d'action (développé, géré, créé, optimisé, lancé)")

    # Calculate total score
    total_score = sum(scores.values())
    max_total = sum(max_scores.values())
    percentage = round((total_score / max_total) * 100)

    # Generate overall assessment
    if percentage >= 80:
        assessment = "Excellent CV, bien structuré et complet"
        grade = "A"
    elif percentage >= 65:
        assessment = "Bon CV avec quelques améliorations possibles"
        grade = "B"
    elif percentage >= 50:
        assessment = "CV correct mais nécessite des améliorations"
        grade = "C"
    elif percentage >= 35:
        assessment = "CV incomplet, plusieurs éléments manquants"
        grade = "D"
    else:
        assessment = "CV à retravailler en profondeur"
        grade = "E"

    return {
        "total_score": percentage,
        "grade": grade,
        "assessment": assessment,
        "breakdown": {
            category: {
                "score": score,
                "max": max_scores[category],
                "percentage": round((score / max_scores[category]) * 100) if max_scores[category] > 0 else 0,
            }
            for category, score in scores.items()
        },
        "suggestions": suggestions[:8],  # Limit to top 8 suggestions
        "strengths": _identify_strengths(scores, max_scores),
    }


def _identify_strengths(scores: Dict[str, int], max_scores: Dict[str, int]) -> List[str]:
    """Identify CV strengths based on high-scoring categories."""
    strengths = []
    strength_labels = {
        "content_length": "Contenu détaillé et complet",
        "skills_diversity": "Large éventail de compétences",
        "experience_detail": "Expériences bien détaillées",
        "education": "Formation bien présentée",
        "certifications": "Certifications valorisantes",
        "achievements": "Réalisations quantifiées impressionnantes",
        "formatting": "Bonne structure et mise en forme",
        "keywords": "Bon usage des mots-clés",
    }

    for category, score in scores.items():
        if max_scores[category] > 0 and (score / max_scores[category]) >= 0.8:
            strengths.append(strength_labels.get(category, category))

    return strengths


def clean_pdf_text(text: str) -> str:
    """
    Clean and normalize PDF extracted text.
    Fixes common PDF extraction issues.
    """
    if not text:
        return ""

    # Multiple passes to catch deeply spaced text
    # Fixes spaced-out letters like "D é v e l o p p e u r" -> "Développeur"
    cleaned = text
    for _ in range(3):
        # Check if text looks spaced (many single letters separated by spaces)
        single_letter_ratio = len(re.findall(r"\b[A-Za-zÀ-ÿ]\b", cleaned)) / max(len(cleaned.split()), 1)
        if single_letter_ratio > 0.3:
            # Reconstruct spaced words
            words = []
            buffer = []
            for char in cleaned:
                if char.isalpha():
                    buffer.append(char)
                elif char == " " and buffer:
                    continue  # Skip spaces between letters
                else:
                    if buffer:
                        words.append("".join(buffer))
                        buffer = []
                    if char != " " or (words and not words[-1].endswith(" ")):
                        words.append(char)
            if buffer:
                words.append("".join(buffer))
            cleaned = "".join(words)
        else:
            break

    # Fix common ligature issues
    ligature_map = {
        "ﬁ": "fi",
        "ﬂ": "fl",
        "ﬀ": "ff",
        "ﬃ": "ffi",
        "ﬄ": "ffl",
        "œ": "oe",
        "æ": "ae",
    }
    for lig, replacement in ligature_map.items():
        cleaned = cleaned.replace(lig, replacement)

    # Normalize whitespace
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    # Fix broken hyphenation (word split across lines)
    cleaned = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", cleaned)

    # Remove header/footer artifacts (page numbers, repeated headers)
    lines = cleaned.split("\n")
    if len(lines) > 10:
        # Remove very short repeated lines (likely headers/footers)
        line_counts = Counter(line.strip() for line in lines if len(line.strip()) < 50)
        repeated_lines = {line for line, count in line_counts.items() if count > 2}
        lines = [line for line in lines if line.strip() not in repeated_lines or len(line.strip()) > 20]
        cleaned = "\n".join(lines)

    return cleaned.strip()


def calculate_total_experience_years(experiences: List[Dict]) -> float:
    """Calculate total years of professional experience."""
    total = 0.0
    for exp in experiences:
        duration = exp.get("duration_years")
        if duration is not None:
            total += duration
    return round(total, 1)


# =============================================================================
# SEMANTIC SKILL MATCHING
# =============================================================================

# Skill synonyms and related terms for semantic matching
SKILL_SYNONYMS = {
    # Programming languages
    "javascript": ["js", "ecmascript", "es6", "es2015"],
    "typescript": ["ts"],
    "python": ["py", "python3", "python2"],
    "golang": ["go"],
    "csharp": ["c#", ".net", "dotnet"],

    # Frontend
    "react": ["reactjs", "react.js", "react native"],
    "vue": ["vuejs", "vue.js", "vue3"],
    "angular": ["angularjs", "angular.js"],

    # Backend
    "nodejs": ["node.js", "node", "express"],
    "django": ["python web", "drf", "django rest"],
    "fastapi": ["fast api", "python api"],
    "spring": ["springboot", "spring boot", "java web"],

    # Databases
    "postgresql": ["postgres", "psql", "pg"],
    "mongodb": ["mongo", "nosql"],
    "mysql": ["mariadb", "sql database"],

    # Cloud
    "aws": ["amazon web services", "amazon cloud", "ec2", "s3", "lambda"],
    "azure": ["microsoft azure", "ms azure", "azure cloud"],
    "gcp": ["google cloud", "google cloud platform"],

    # DevOps
    "kubernetes": ["k8s", "kube"],
    "docker": ["container", "containerization", "dockerfile"],
    "ci/cd": ["cicd", "continuous integration", "continuous deployment", "pipeline"],

    # Data
    "machine learning": ["ml", "deep learning", "dl", "artificial intelligence", "ai"],
    "data science": ["data scientist", "data analysis", "data analytics"],

    # Soft skills
    "leadership": ["lead", "management", "team lead", "chef d'équipe", "encadrement"],
    "communication": ["présentation", "rédaction", "oral", "écrit"],
    "agile": ["scrum", "kanban", "sprint", "product owner", "scrum master"],

    # Business
    "sales": ["vente", "commercial", "business development"],
    "marketing": ["marketing digital", "growth", "acquisition"],
}


def calculate_skill_similarity(skill1: str, skill2: str) -> float:
    """
    Calculate similarity between two skills using synonyms and string matching.
    Returns a score between 0 and 1.
    """
    s1 = strip_accents(skill1.lower().strip())
    s2 = strip_accents(skill2.lower().strip())

    # Exact match
    if s1 == s2:
        return 1.0

    # Check if one contains the other
    if s1 in s2 or s2 in s1:
        return 0.8

    # Check synonyms
    for main_skill, synonyms in SKILL_SYNONYMS.items():
        all_variants = [main_skill] + synonyms
        s1_match = any(v in s1 or s1 in v for v in all_variants)
        s2_match = any(v in s2 or s2 in v for v in all_variants)
        if s1_match and s2_match:
            return 0.9

    # Simple character-based similarity (Jaccard on character trigrams)
    def get_trigrams(s: str) -> set:
        if len(s) < 3:
            return {s}
        return {s[i:i+3] for i in range(len(s) - 2)}

    trigrams1 = get_trigrams(s1)
    trigrams2 = get_trigrams(s2)

    if not trigrams1 or not trigrams2:
        return 0.0

    intersection = len(trigrams1 & trigrams2)
    union = len(trigrams1 | trigrams2)

    return intersection / union if union > 0 else 0.0


def match_skills_semantic(
    cv_skills: List[str],
    job_skills: List[str],
    threshold: float = 0.6
) -> Dict[str, Any]:
    """
    Match CV skills against job requirements using semantic similarity.

    Returns:
        - matched_skills: Skills that match between CV and job
        - missing_skills: Required skills not found in CV
        - extra_skills: CV skills not required by job (bonus skills)
        - match_score: Overall matching percentage
    """
    if not cv_skills or not job_skills:
        return {
            "matched_skills": [],
            "missing_skills": job_skills or [],
            "extra_skills": cv_skills or [],
            "match_score": 0,
            "match_details": [],
        }

    cv_skills_lower = [strip_accents(s.lower().strip()) for s in cv_skills]
    job_skills_lower = [strip_accents(s.lower().strip()) for s in job_skills]

    matched = []
    match_details = []
    matched_cv_indices = set()

    for job_skill in job_skills_lower:
        best_match = None
        best_score = 0

        for i, cv_skill in enumerate(cv_skills_lower):
            if i in matched_cv_indices:
                continue

            score = calculate_skill_similarity(cv_skill, job_skill)
            if score > best_score and score >= threshold:
                best_score = score
                best_match = (i, cv_skill)

        if best_match:
            idx, cv_skill = best_match
            matched_cv_indices.add(idx)
            matched.append(job_skill)
            match_details.append({
                "job_skill": job_skill,
                "cv_skill": cv_skill,
                "similarity": round(best_score, 2),
            })

    missing = [s for s in job_skills_lower if s not in matched]
    extra = [cv_skills[i] for i in range(len(cv_skills)) if i not in matched_cv_indices]

    match_score = round((len(matched) / len(job_skills)) * 100) if job_skills else 0

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "extra_skills": extra,
        "match_score": match_score,
        "match_details": match_details,
    }


def build_enhanced_prompt(cv_text: str, pref_role: Optional[str], pref_location: Optional[str], must_keywords: List[str]) -> str:
    """Build an enhanced prompt for OpenAI CV analysis with comprehensive extraction."""
    return f"""Tu es un expert en recrutement et analyse de CV. Analyse ce CV français de manière approfondie.

CV (texte extrait):
---
{cv_text[:4000]}
---

Préférences utilisateur:
- Rôle recherché: {pref_role or 'Non spécifié'}
- Localisation: {pref_location or 'France'}
- Mots-clés obligatoires: {', '.join(must_keywords) if must_keywords else 'Aucun'}

Réponds en JSON avec cette structure exacte (sois exhaustif et précis):
{{
    "profil_resume": "Résumé du profil en 3-4 phrases, incluant le niveau d'expérience, le domaine principal, les points forts distinctifs et la valeur ajoutée",
    "titre_poste_cible": "Le titre de poste le plus adapté au profil (ex: Développeur Full Stack Senior, Chef de Projet Digital)",
    "niveau_experience": "junior|confirme|senior|expert",
    "annees_experience_total": 0,

    "competences_cles": ["compétence1", "compétence2", "compétence3", "compétence4", "compétence5", "compétence6", "compétence7", "compétence8"],
    "competences_techniques": ["tech1", "tech2", "tech3", "tech4", "tech5"],
    "competences_transversales": ["soft skill 1", "soft skill 2", "soft skill 3"],

    "experiences": [
        {{
            "entreprise": "Nom de l'entreprise",
            "poste": "Titre du poste",
            "periode": "2020-2023 ou Jan 2020 - Présent",
            "responsabilites": ["responsabilité 1", "responsabilité 2"],
            "realisations": ["réalisation chiffrée 1", "réalisation 2"]
        }}
    ],

    "formation": {{
        "diplome_principal": "Master, Licence, etc.",
        "ecole": "Nom de l'école/université",
        "annee": "2020",
        "specialite": "Informatique, Marketing, etc."
    }},

    "certifications": ["AWS Solutions Architect", "PMP", "TOEIC 950"],

    "langues": [
        {{"langue": "Français", "niveau": "Natif"}},
        {{"langue": "Anglais", "niveau": "Courant (TOEIC 900)"}}
    ],

    "projets_remarquables": [
        {{
            "nom": "Nom du projet",
            "description": "Description courte",
            "technologies": ["tech1", "tech2"],
            "impact": "Impact mesurable si disponible"
        }}
    ],

    "secteurs_cibles": ["Tech", "Finance", "Conseil"],
    "types_entreprise": ["Startup", "Grand groupe", "ESN"],

    "points_forts": ["Point fort 1", "Point fort 2", "Point fort 3"],
    "axes_amelioration": ["Axe 1 à développer", "Axe 2"],

    "requetes_recherche": [
        "requête optimisée 1 incluant le rôle et la localisation",
        "requête 2 avec compétences clés",
        "requête 3 variante sectorielle",
        "requête 4 titre alternatif",
        "requête 5 spécialisée"
    ],

    "score_cv": {{
        "note_globale": 75,
        "completude": 80,
        "impact": 70,
        "lisibilite": 85
    }},

    "conseils_personnalises": [
        "Conseil 1 pour améliorer le CV",
        "Conseil 2 spécifique au profil"
    ]
}}

Instructions importantes:
1. Extrais TOUTES les expériences professionnelles visibles dans le CV
2. Identifie les réalisations chiffrées (%, €, équipe de X personnes)
3. Les requêtes de recherche doivent être optimisées pour France Travail, LinkedIn, Indeed
4. Sois précis sur les technologies et outils mentionnés
5. Évalue objectivement les forces et faiblesses du CV"""
# Expanded role detection (all domains)
ROLE_HINTS = [
    # === TECH / IT ===
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
    # Design & UX
    "ux designer", "ui designer", "product designer", "ux researcher",
    # Security
    "security engineer", "cybersecurity", "pentester", "security analyst",
    # QA
    "qa engineer", "test engineer", "quality assurance", "sdet",

    # === MARKETING / COMMUNICATION ===
    "chef de projet marketing", "responsable marketing", "directeur marketing",
    "community manager", "social media manager", "content manager",
    "chargé de communication", "responsable communication", "directeur communication",
    "chef de produit", "product manager", "brand manager",
    "traffic manager", "growth manager", "acquisition manager",
    "seo manager", "sea manager", "responsable digital",
    "attaché de presse", "relations presse", "relations publiques",

    # === FINANCE / COMPTABILITÉ ===
    "comptable", "expert comptable", "aide comptable",
    "contrôleur de gestion", "directeur financier", "daf", "cfo",
    "analyste financier", "auditeur", "audit interne", "audit externe",
    "trésorier", "credit manager", "responsable recouvrement",
    "responsable paie", "gestionnaire paie", "fiscaliste",

    # === RESSOURCES HUMAINES ===
    "chargé de recrutement", "responsable recrutement", "talent acquisition",
    "responsable rh", "directeur rh", "drh", "hr manager", "hr business partner",
    "gestionnaire rh", "assistant rh", "chargé rh",
    "responsable formation", "chargé de formation", "ingénieur formation",
    "responsable paie", "gestionnaire paie",
    "responsable relations sociales", "juriste social",

    # === COMMERCIAL / VENTE ===
    "commercial", "attaché commercial", "technico-commercial",
    "responsable commercial", "directeur commercial",
    "business developer", "key account manager", "account manager",
    "ingénieur commercial", "ingénieur d'affaires",
    "responsable grands comptes", "chef des ventes", "directeur des ventes",
    "responsable adv", "assistant commercial",

    # === DESIGN / CRÉATION ===
    "graphiste", "designer graphique", "infographiste",
    "directeur artistique", "da", "creative director",
    "motion designer", "illustrateur", "webdesigner",
    "photographe", "vidéaste", "réalisateur",
    "chef de projet créatif", "responsable studio",

    # === JURIDIQUE ===
    "juriste", "juriste d'entreprise", "juriste droit des affaires",
    "juriste contrats", "juriste social", "juriste immobilier",
    "avocat", "notaire", "huissier",
    "responsable juridique", "directeur juridique",
    "compliance officer", "responsable conformité",

    # === SANTÉ / MÉDICAL ===
    "médecin", "infirmier", "infirmière", "aide-soignant",
    "pharmacien", "préparateur en pharmacie",
    "kinésithérapeute", "ostéopathe", "sage-femme",
    "psychologue", "orthophoniste", "ergothérapeute",
    "cadre de santé", "directeur d'établissement",

    # === INGÉNIERIE / INDUSTRIE ===
    "ingénieur", "technicien", "chef de projet industriel",
    "ingénieur mécanique", "ingénieur électrique", "ingénieur process",
    "ingénieur qualité", "responsable qualité", "qualiticien",
    "ingénieur méthodes", "ingénieur production", "responsable production",
    "ingénieur maintenance", "responsable maintenance", "technicien maintenance",
    "ingénieur hse", "responsable hse", "animateur hse",
    "chef de chantier", "conducteur de travaux", "ingénieur travaux",
    "acheteur", "responsable achats", "directeur achats",

    # === LOGISTIQUE / SUPPLY CHAIN ===
    "responsable logistique", "directeur logistique", "supply chain manager",
    "responsable entrepôt", "chef d'équipe logistique",
    "gestionnaire de stock", "approvisionneur", "planificateur",
    "responsable transport", "affréteur", "déclarant en douane",

    # === ADMINISTRATION / ASSISTANAT ===
    "assistant", "assistante", "assistant de direction", "assistant administratif",
    "secrétaire", "secrétaire de direction", "office manager",
    "standardiste", "hôte d'accueil", "hôtesse d'accueil",
    "gestionnaire administratif", "agent administratif",

    # === HÔTELLERIE / RESTAURATION ===
    "chef de cuisine", "chef cuisinier", "sous-chef", "commis de cuisine",
    "serveur", "chef de rang", "maître d'hôtel",
    "réceptionniste", "concierge", "directeur d'hôtel",
    "barman", "sommelier", "pâtissier",

    # === ÉDUCATION / FORMATION ===
    "enseignant", "professeur", "formateur", "animateur",
    "responsable pédagogique", "ingénieur pédagogique",
    "coach", "consultant formation",

    # === MANAGEMENT GÉNÉRAL ===
    "manager", "responsable", "directeur", "chef de projet",
    "project manager", "chef d'équipe", "team lead",
    "scrum master", "agile coach", "product owner",
    "consultant", "chef de service", "directeur général", "dg", "ceo",
]

# Professional skills to detect in CV (all domains, not just tech)
PROFESSIONAL_SKILLS = {
    # === TECH / IT ===
    # Programming Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "ruby", "go", "golang",
    "rust", "swift", "kotlin", "scala", "php", "perl", "r", "matlab", "julia",
    "objective-c", "dart", "elixir", "clojure", "haskell", "lua", "shell", "bash",
    # Frontend
    "react", "reactjs", "vue", "vuejs", "angular", "svelte", "nextjs", "next.js",
    "nuxt", "gatsby", "html", "css", "sass", "scss", "tailwind", "bootstrap",
    "webpack", "vite", "redux", "graphql", "jquery",
    # Backend
    "nodejs", "node.js", "express", "fastapi", "django", "flask", "spring",
    "rails", "laravel", "symfony", "asp.net", "nestjs",
    # Databases
    "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch",
    "oracle", "sqlite", "prisma", "sqlalchemy",
    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
    "jenkins", "gitlab", "linux", "nginx",
    # Data & ML
    "pandas", "numpy", "tensorflow", "pytorch", "spark", "hadoop", "kafka",
    "tableau", "powerbi", "jupyter", "machine learning", "deep learning",

    # === MARKETING / COMMUNICATION ===
    "seo", "sea", "sem", "google ads", "facebook ads", "linkedin ads", "tiktok ads",
    "google analytics", "analytics", "hubspot", "mailchimp", "sendinblue", "brevo",
    "crm", "salesforce", "marketing automation", "inbound marketing", "outbound",
    "community management", "social media", "réseaux sociaux", "content marketing",
    "copywriting", "storytelling", "branding", "brand management", "e-réputation",
    "influence marketing", "affiliation", "growth hacking", "acquisition",
    "emailing", "newsletter", "webmarketing", "marketing digital",
    "relations presse", "relations publiques", "communication corporate",
    "communication interne", "événementiel", "sponsoring",

    # === FINANCE / COMPTABILITÉ ===
    "comptabilité", "accounting", "audit", "contrôle de gestion", "controlling",
    "finance", "trésorerie", "treasury", "consolidation", "ifrs", "gaap",
    "fiscalité", "tax", "paie", "payroll", "facturation", "recouvrement",
    "budget", "budgeting", "forecast", "reporting financier", "kpi",
    "analyse financière", "financial analysis", "business plan", "valorisation",
    "excel", "vba", "sap", "sage", "cegid", "quadra", "ebp",
    "credit management", "risk management", "compliance", "kyc", "aml",

    # === RESSOURCES HUMAINES ===
    "recrutement", "recruitment", "sourcing", "chasse de têtes", "headhunting",
    "entretien", "onboarding", "offboarding", "sirh", "hris", "workday", "talentsoft",
    "formation", "training", "développement rh", "gpec", "gepp",
    "paie", "administration du personnel", "droit social", "droit du travail",
    "relations sociales", "cse", "négociation collective", "accord d'entreprise",
    "marque employeur", "employer branding", "qvt", "qualité de vie au travail",
    "diversité", "inclusion", "handicap", "rse",

    # === COMMERCIAL / VENTE ===
    "vente", "sales", "négociation", "prospection", "closing", "upselling",
    "cross-selling", "account management", "key account", "grands comptes",
    "business development", "développement commercial", "b2b", "b2c",
    "pipeline", "crm", "salesforce", "hubspot", "pipedrive",
    "objectifs commerciaux", "kpi", "chiffre d'affaires", "marge",
    "relation client", "fidélisation", "satisfaction client", "nps",
    "retail", "grande distribution", "e-commerce", "marketplace",

    # === DESIGN / CRÉATION ===
    "photoshop", "illustrator", "indesign", "after effects", "premiere pro",
    "figma", "sketch", "adobe xd", "invision", "zeplin", "canva",
    "ui design", "ux design", "ui/ux", "webdesign", "web design",
    "design graphique", "graphic design", "direction artistique", "da",
    "motion design", "animation", "3d", "blender", "cinema 4d", "maya",
    "branding", "identité visuelle", "logo", "charte graphique",
    "packaging", "print", "édition", "mise en page", "typography",

    # === JURIDIQUE ===
    "droit des affaires", "droit commercial", "droit des sociétés",
    "droit du travail", "droit social", "contentieux", "litigation",
    "propriété intellectuelle", "pi", "marques", "brevets", "rgpd", "gdpr",
    "contrats", "contract management", "négociation", "due diligence",
    "conformité", "compliance", "réglementation", "veille juridique",
    "droit immobilier", "droit fiscal", "droit pénal", "droit public",

    # === SANTÉ / MÉDICAL ===
    "médecin", "infirmier", "infirmière", "aide-soignant", "pharmacien",
    "kinésithérapeute", "sage-femme", "psychologue", "orthophoniste",
    "laboratoire", "analyses", "imagerie médicale", "radiologie",
    "bloc opératoire", "urgences", "réanimation", "soins intensifs",
    "ehpad", "hôpital", "clinique", "cabinet médical",
    "recherche clinique", "essais cliniques", "pharmacovigilance",
    "dispositifs médicaux", "réglementation sanitaire", "has", "ansm",

    # === INGÉNIERIE / INDUSTRIE ===
    "autocad", "solidworks", "catia", "revit", "bim", "cao", "dao",
    "génie civil", "bâtiment", "construction", "travaux publics", "tp",
    "mécanique", "électrique", "électronique", "automatisme", "plc",
    "maintenance", "gmao", "lean", "six sigma", "kaizen", "5s",
    "qualité", "iso 9001", "iso 14001", "qhse", "hse", "sécurité",
    "production", "industrialisation", "méthodes", "process",
    "supply chain", "logistique", "approvisionnement", "achats", "procurement",
    "erp", "sap", "oracle", "gpao", "mes",

    # === ÉDUCATION / FORMATION ===
    "enseignement", "pédagogie", "formation", "e-learning", "mooc",
    "ingénierie pédagogique", "conception pédagogique", "lms", "moodle",
    "animation", "facilitation", "coaching", "mentorat", "tutorat",
    "évaluation", "certification", "diplôme", "compétences",

    # === HÔTELLERIE / RESTAURATION / TOURISME ===
    "hôtellerie", "restauration", "cuisine", "chef", "commis", "serveur",
    "réception", "conciergerie", "housekeeping", "room service",
    "revenue management", "yield management", "booking", "réservation",
    "tourisme", "agence de voyage", "tour operator", "guide",
    "événementiel", "banquet", "traiteur", "catering",

    # === LOGISTIQUE / TRANSPORT ===
    "logistique", "logistics", "supply chain", "approvisionnement",
    "entreposage", "warehouse", "wms", "préparation de commandes", "picking",
    "transport", "affrètement", "douane", "import", "export", "incoterms",
    "livraison", "dernier kilomètre", "last mile", "fleet management",
    "caces", "chariot élévateur", "manutention",

    # === ADMINISTRATION / ASSISTANAT ===
    "assistanat", "secrétariat", "accueil", "standard", "téléphonique",
    "gestion administrative", "classement", "archivage", "courrier",
    "agenda", "planning", "organisation", "coordination",
    "word", "excel", "powerpoint", "outlook", "office 365", "google workspace",
    "saisie", "frappe", "rédaction", "compte-rendu", "pv",

    # === COMPÉTENCES TRANSVERSALES ===
    "management", "leadership", "gestion d'équipe", "encadrement",
    "gestion de projet", "project management", "pmo", "prince2", "pmp",
    "agile", "scrum", "kanban", "lean", "amélioration continue",
    "communication", "présentation", "prise de parole", "rédaction",
    "analyse", "synthèse", "résolution de problèmes", "problem solving",
    "négociation", "persuasion", "influence", "diplomatie",
    "anglais", "english", "espagnol", "allemand", "italien", "chinois",
    "bilingue", "trilingue", "toeic", "toefl", "ielts", "bulats",
}

# Alias pour compatibilité
TECH_SKILLS = PROFESSIONAL_SKILLS

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

    # Single-letter skills need special context validation to avoid false positives
    single_letter_contexts = {
        "r": [
            "langage r", "language r", "r studio", "rstudio", "r programming",
            "programmation r", "statistiques r", "r statistics", "cran",
            "tidyverse", "ggplot", "dplyr", "r markdown"
        ],
        "c": [
            "langage c", "language c", "c programming", "programmation c",
            "ansi c", "c89", "c99", "c11", "gcc", "clang"
        ],
    }

    for skill in TECH_SKILLS:
        if " " not in skill and skill in words:
            # For single-letter skills, require context validation
            if len(skill) == 1:
                contexts = single_letter_contexts.get(skill, [])
                if contexts and not any(ctx in text_lower for ctx in contexts):
                    continue  # Skip if no valid context found
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
    """Categorize detected skills into groups (all domains)."""
    categories = {
        # Tech
        "langages_prog": [],
        "frontend": [],
        "backend": [],
        "databases": [],
        "cloud_devops": [],
        "data_ml": [],
        # Business
        "marketing": [],
        "finance": [],
        "rh": [],
        "commercial": [],
        "design": [],
        "juridique": [],
        "sante": [],
        "industrie": [],
        "logistique": [],
        "langues": [],
        "outils": [],
    }

    skill_categories = {
        # === TECH ===
        # Programming Languages
        "python": "langages_prog", "javascript": "langages_prog", "typescript": "langages_prog",
        "java": "langages_prog", "c++": "langages_prog", "c#": "langages_prog", "ruby": "langages_prog",
        "go": "langages_prog", "golang": "langages_prog", "rust": "langages_prog", "swift": "langages_prog",
        "kotlin": "langages_prog", "scala": "langages_prog", "php": "langages_prog", "r": "langages_prog",
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
        "oracle": "databases", "sqlite": "databases", "prisma": "databases",
        # Cloud & DevOps
        "aws": "cloud_devops", "azure": "cloud_devops", "gcp": "cloud_devops",
        "docker": "cloud_devops", "kubernetes": "cloud_devops", "terraform": "cloud_devops",
        "jenkins": "cloud_devops", "gitlab": "cloud_devops", "linux": "cloud_devops", "nginx": "cloud_devops",
        # Data & ML
        "pandas": "data_ml", "numpy": "data_ml", "tensorflow": "data_ml", "pytorch": "data_ml",
        "spark": "data_ml", "kafka": "data_ml", "tableau": "data_ml", "powerbi": "data_ml",
        "machine learning": "data_ml", "deep learning": "data_ml", "jupyter": "data_ml",

        # === MARKETING / COMMUNICATION ===
        "seo": "marketing", "sea": "marketing", "sem": "marketing", "google ads": "marketing",
        "facebook ads": "marketing", "linkedin ads": "marketing", "google analytics": "marketing",
        "hubspot": "marketing", "mailchimp": "marketing", "sendinblue": "marketing",
        "crm": "marketing", "salesforce": "marketing", "marketing automation": "marketing",
        "community management": "marketing", "social media": "marketing", "content marketing": "marketing",
        "copywriting": "marketing", "storytelling": "marketing", "branding": "marketing",
        "growth hacking": "marketing", "emailing": "marketing", "newsletter": "marketing",

        # === FINANCE / COMPTABILITÉ ===
        "comptabilité": "finance", "accounting": "finance", "audit": "finance",
        "contrôle de gestion": "finance", "finance": "finance", "trésorerie": "finance",
        "consolidation": "finance", "ifrs": "finance", "gaap": "finance",
        "fiscalité": "finance", "paie": "finance", "payroll": "finance",
        "excel": "finance", "vba": "finance", "sap": "finance", "sage": "finance",
        "cegid": "finance", "budget": "finance", "forecast": "finance",

        # === RESSOURCES HUMAINES ===
        "recrutement": "rh", "recruitment": "rh", "sourcing": "rh",
        "sirh": "rh", "hris": "rh", "workday": "rh", "talentsoft": "rh",
        "formation": "rh", "training": "rh", "gpec": "rh", "gepp": "rh",
        "droit social": "rh", "droit du travail": "rh", "marque employeur": "rh",
        "qvt": "rh", "diversité": "rh", "inclusion": "rh",

        # === COMMERCIAL / VENTE ===
        "vente": "commercial", "sales": "commercial", "négociation": "commercial",
        "prospection": "commercial", "closing": "commercial", "b2b": "commercial", "b2c": "commercial",
        "business development": "commercial", "account management": "commercial",
        "pipedrive": "commercial", "retail": "commercial", "e-commerce": "commercial",

        # === DESIGN / CRÉATION ===
        "photoshop": "design", "illustrator": "design", "indesign": "design",
        "after effects": "design", "premiere pro": "design", "figma": "design",
        "sketch": "design", "adobe xd": "design", "canva": "design",
        "ui design": "design", "ux design": "design", "ui/ux": "design",
        "motion design": "design", "3d": "design", "blender": "design",

        # === JURIDIQUE ===
        "droit des affaires": "juridique", "droit commercial": "juridique",
        "contentieux": "juridique", "litigation": "juridique",
        "propriété intellectuelle": "juridique", "rgpd": "juridique", "gdpr": "juridique",
        "contrats": "juridique", "compliance": "juridique", "conformité": "juridique",

        # === SANTÉ / MÉDICAL ===
        "médecin": "sante", "infirmier": "sante", "pharmacien": "sante",
        "kinésithérapeute": "sante", "psychologue": "sante",
        "recherche clinique": "sante", "pharmacovigilance": "sante",

        # === INGÉNIERIE / INDUSTRIE ===
        "autocad": "industrie", "solidworks": "industrie", "catia": "industrie",
        "revit": "industrie", "bim": "industrie", "cao": "industrie",
        "lean": "industrie", "six sigma": "industrie", "kaizen": "industrie",
        "qualité": "industrie", "iso 9001": "industrie", "qhse": "industrie", "hse": "industrie",
        "maintenance": "industrie", "gmao": "industrie", "erp": "industrie",

        # === LOGISTIQUE / SUPPLY CHAIN ===
        "logistique": "logistique", "supply chain": "logistique",
        "warehouse": "logistique", "wms": "logistique",
        "transport": "logistique", "douane": "logistique", "incoterms": "logistique",
        "caces": "logistique",

        # === LANGUES ===
        "anglais": "langues", "english": "langues", "espagnol": "langues",
        "allemand": "langues", "italien": "langues", "chinois": "langues",
        "bilingue": "langues", "trilingue": "langues",
        "toeic": "langues", "toefl": "langues", "ielts": "langues",

        # === OUTILS TRANSVERSAUX ===
        "git": "outils", "jira": "outils", "confluence": "outils",
        "word": "outils", "powerpoint": "outils", "outlook": "outils",
        "office 365": "outils", "google workspace": "outils",
        "agile": "outils", "scrum": "outils", "kanban": "outils",
        "management": "outils", "gestion de projet": "outils", "project management": "outils",
    }

    for skill in skills:
        category = skill_categories.get(skill, "outils")
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
    Analyse complète et enrichie du profil utilisateur basée sur son CV et ses préférences.
    Combine extraction locale avancée et enrichissement OpenAI.

    Extrait:
    - Compétences techniques et transversales
    - Expériences professionnelles structurées
    - Certifications
    - Réalisations quantifiées
    - Score de qualité du CV
    - Suggestions d'amélioration
    """
    cv = latest_cv(db, user_id)
    raw_cv_text = cv.text or "" if cv else ""

    # Clean PDF text for better extraction
    cv_text = clean_pdf_text(raw_cv_text) if raw_cv_text else ""

    # =========================================================================
    # LOCAL EXTRACTION (Always performed, serves as fallback)
    # =========================================================================

    # Extract technical/professional skills
    tech_skills = extract_tech_skills(cv_text) if cv_text else []

    # Tokenize for frequency analysis
    tokens = tokenize(cv_text) if cv_text else []
    top_tokens = [w for w, _ in Counter(tokens).most_common(20) if len(w) > 1]

    # Combine tech skills with frequent tokens
    top_keywords = tech_skills[:15] + [t for t in top_tokens if t not in tech_skills][:5]
    top_keywords = top_keywords[:15]

    # Detect experience level
    experience_level = detect_experience_level(cv_text) if cv_text else "junior"

    # Categorize skills
    skill_categories = categorize_skills(tech_skills) if tech_skills else {}

    # Extract education
    education = extract_education(cv_text) if cv_text else {"ecoles": [], "diplomes": []}

    # NEW: Extract certifications
    certifications = extract_certifications(cv_text) if cv_text else {}

    # NEW: Extract work experiences
    work_experiences = extract_work_experiences(cv_text) if cv_text else []

    # NEW: Extract achievements
    achievements = extract_achievements(cv_text) if cv_text else []

    # NEW: Calculate total experience years
    total_experience_years = calculate_total_experience_years(work_experiences)

    # Extract skills by category
    extracted_skills = extract_skills_from_text(cv_text) if cv_text else {}

    # Flatten extracted skills
    all_extracted_skills = []
    for category, skills in extracted_skills.items():
        all_extracted_skills.extend(skills)

    # Clean user preferences
    cleaned_role = clean_field(pref.role)
    cleaned_location = clean_field(pref.location)

    # Parse must keywords
    must_keywords_raw = [kw for kw in (pref.must_keywords or "").split(",") if kw.strip()]
    must_keywords = [
        kw.strip().lower()
        for kw in must_keywords_raw
        if kw.strip() and kw.strip().lower() not in PLACEHOLDER_VALUES
    ]

    # Local analysis
    local_top_keywords = [w for w, _ in Counter(tokens).most_common(15) if len(w) > 1]
    local_roles = infer_roles(cv_text, cleaned_role)
    hits, missing = extract_must_hits(tokens, must_keywords)

    # Build initial queries
    queries = build_queries(local_roles, must_keywords, local_top_keywords, cleaned_location)

    # Initialize with local analysis results
    llm_used = False
    summary = ""
    roles = local_roles
    titre_poste = local_roles[0] if local_roles else None
    competences_techniques = extracted_skills.get("langages_programmation", []) + extracted_skills.get("frameworks_web", [])
    competences_transversales = extracted_skills.get("soft_skills", [])
    langues = extracted_skills.get("langues", [])
    formation_str = ", ".join(education.get("diplomes", [])[:2] + education.get("ecoles", [])[:1])
    secteurs = []
    points_forts = []
    axes_amelioration = []
    projets = []
    llm_experiences = []
    llm_score_cv = None
    conseils = []

    # =========================================================================
    # LLM ENRICHMENT (Optional, provides enhanced results)
    # =========================================================================

    if cv_text:
        prompt = build_enhanced_prompt(cv_text, cleaned_role, cleaned_location, must_keywords)
        llm_result = _call_openai(prompt, max_tokens=1500)

        if llm_result:
            llm_used = True

            # Profile summary
            llm_summary = llm_result.get("profil_resume", "")
            if isinstance(llm_summary, str) and llm_summary.strip():
                summary = llm_summary.strip()

            # Target job title
            llm_titre = llm_result.get("titre_poste_cible", "")
            if isinstance(llm_titre, str) and llm_titre.strip():
                titre_poste = llm_titre.strip()
                if titre_poste.lower() not in [r.lower() for r in roles]:
                    roles = [titre_poste] + roles[:2]

            # Experience level
            llm_niveau = llm_result.get("niveau_experience", "")
            if isinstance(llm_niveau, str) and llm_niveau.strip() in ["junior", "confirme", "senior", "expert"]:
                experience_level = llm_niveau.strip()

            # Total years
            llm_years = llm_result.get("annees_experience_total")
            if isinstance(llm_years, (int, float)) and llm_years > 0:
                total_experience_years = float(llm_years)

            # Key competencies
            llm_competences = llm_result.get("competences_cles", [])
            if isinstance(llm_competences, list) and llm_competences:
                top_keywords = [c for c in llm_competences if isinstance(c, str) and len(c.strip()) > 1][:15]

            # Technical skills
            llm_tech = llm_result.get("competences_techniques", [])
            if isinstance(llm_tech, list) and llm_tech:
                competences_techniques = [c for c in llm_tech if isinstance(c, str)]

            # Soft skills
            llm_soft = llm_result.get("competences_transversales", [])
            if isinstance(llm_soft, list) and llm_soft:
                competences_transversales = [c for c in llm_soft if isinstance(c, str)]

            # Languages (handle both string and dict formats)
            llm_langues = llm_result.get("langues", [])
            if isinstance(llm_langues, list) and llm_langues:
                processed_langues = []
                for lang in llm_langues:
                    if isinstance(lang, str):
                        processed_langues.append(lang)
                    elif isinstance(lang, dict):
                        langue_name = lang.get("langue", "")
                        niveau = lang.get("niveau", "")
                        if langue_name:
                            processed_langues.append(f"{langue_name} ({niveau})" if niveau else langue_name)
                langues = processed_langues

            # Formation (handle both string and dict formats)
            llm_formation = llm_result.get("formation")
            if isinstance(llm_formation, str) and llm_formation.strip():
                formation_str = llm_formation.strip()
            elif isinstance(llm_formation, dict):
                parts = []
                if llm_formation.get("diplome_principal"):
                    parts.append(llm_formation["diplome_principal"])
                if llm_formation.get("specialite"):
                    parts.append(llm_formation["specialite"])
                if llm_formation.get("ecole"):
                    parts.append(llm_formation["ecole"])
                if llm_formation.get("annee"):
                    parts.append(f"({llm_formation['annee']})")
                formation_str = " - ".join(parts) if parts else formation_str

            # Certifications from LLM
            llm_certs = llm_result.get("certifications", [])
            if isinstance(llm_certs, list) and llm_certs:
                for cert in llm_certs:
                    if isinstance(cert, str) and cert.strip():
                        # Add to appropriate category
                        cert_lower = cert.lower()
                        category = "it_general"
                        for cat, patterns in CERTIFICATIONS.items():
                            if any(p in cert_lower for p in patterns):
                                category = cat
                                break
                        if category not in certifications:
                            certifications[category] = []
                        certifications[category].append({"name": cert, "score": None})

            # Experiences from LLM
            llm_exp = llm_result.get("experiences", [])
            if isinstance(llm_exp, list) and llm_exp:
                for exp in llm_exp:
                    if isinstance(exp, dict):
                        llm_experiences.append({
                            "company": exp.get("entreprise"),
                            "title": exp.get("poste"),
                            "period": exp.get("periode"),
                            "responsibilities": exp.get("responsabilites", []),
                            "achievements": exp.get("realisations", []),
                        })

            # Projects
            llm_projets = llm_result.get("projets_remarquables", [])
            if isinstance(llm_projets, list) and llm_projets:
                for proj in llm_projets:
                    if isinstance(proj, dict):
                        projets.append({
                            "name": proj.get("nom"),
                            "description": proj.get("description"),
                            "technologies": proj.get("technologies", []),
                            "impact": proj.get("impact"),
                        })

            # Target sectors
            llm_secteurs = llm_result.get("secteurs_cibles", [])
            if isinstance(llm_secteurs, list) and llm_secteurs:
                secteurs = [s for s in llm_secteurs if isinstance(s, str)]

            # Strengths and improvements
            llm_points_forts = llm_result.get("points_forts", [])
            if isinstance(llm_points_forts, list):
                points_forts = [p for p in llm_points_forts if isinstance(p, str)]

            llm_axes = llm_result.get("axes_amelioration", [])
            if isinstance(llm_axes, list):
                axes_amelioration = [a for a in llm_axes if isinstance(a, str)]

            # Search queries
            llm_queries = llm_result.get("requetes_recherche", [])
            if isinstance(llm_queries, list) and llm_queries:
                queries = [q for q in llm_queries if isinstance(q, str)][:5]

            # CV Score from LLM
            llm_score = llm_result.get("score_cv")
            if isinstance(llm_score, dict):
                llm_score_cv = llm_score

            # Personalized advice
            llm_conseils = llm_result.get("conseils_personnalises", [])
            if isinstance(llm_conseils, list):
                conseils = [c for c in llm_conseils if isinstance(c, str)]

    # =========================================================================
    # CALCULATE CV QUALITY SCORE (Local calculation)
    # =========================================================================

    cv_quality = None
    if cv_text:
        try:
            cv_quality = calculate_cv_quality_score(
                text=cv_text,
                skills=tech_skills,
                experiences=work_experiences if work_experiences else llm_experiences,
                education=education,
                certifications=certifications,
                achievements=achievements,
            )
        except Exception as exc:
            log.warning("CV quality score failed: %s", exc)

    # Merge LLM score with local score if available
    if cv_quality and llm_score_cv:
        # Average the scores
        if llm_score_cv.get("note_globale"):
            cv_quality["total_score"] = round(
                (cv_quality["total_score"] + llm_score_cv["note_globale"]) / 2
            )

    # =========================================================================
    # BUILD SUMMARY
    # =========================================================================

    if not summary:
        summary_parts = []
        if titre_poste:
            level_label = {
                "junior": "Junior",
                "confirme": "Confirmé",
                "mid": "Confirmé",
                "senior": "Senior",
                "expert": "Expert",
                "management": "Manager",
            }.get(experience_level, experience_level)
            summary_parts.append(f"Profil {level_label} - {titre_poste}")

        if total_experience_years > 0:
            summary_parts.append(f"{total_experience_years} ans d'expérience")

        if formation_str:
            summary_parts.append(f"Formation: {formation_str}")

        if top_keywords:
            summary_parts.append(f"Compétences: {', '.join(top_keywords[:5])}")

        if not summary_parts:
            summary_parts.append("Ajoute un CV pour une analyse détaillée de ton profil.")

        summary = " | ".join(summary_parts)

    # Ensure queries have location
    if cleaned_location and queries:
        queries = [
            q if cleaned_location.lower() in q.lower() else f"{q} {cleaned_location}"
            for q in queries
        ][:5]

    # Merge experiences (prefer LLM if available, otherwise use local)
    final_experiences = llm_experiences if llm_experiences else work_experiences

    # Flatten certifications for simple display
    certifications_list = []
    for category, certs in certifications.items():
        for cert in certs:
            cert_display = cert.get("name", "")
            if cert.get("score"):
                cert_display += f" ({cert['score']})"
            if cert_display and cert_display not in certifications_list:
                certifications_list.append(cert_display)

    # =========================================================================
    # RETURN COMPREHENSIVE ANALYSIS
    # =========================================================================

    return {
        # Basic info
        "cv_present": bool(cv),
        "llm_used": llm_used,
        "summary": summary,

        # Target profile
        "titre_poste_cible": titre_poste,
        "inferred_roles": roles[:5],
        "secteurs_cibles": secteurs[:5],

        # Experience
        "niveau_experience": experience_level,
        "experience_level": experience_level,  # Alias for compatibility
        "total_experience_years": total_experience_years,
        "experiences": final_experiences[:10],

        # Skills
        "top_keywords": top_keywords,
        "competences_techniques": competences_techniques[:15],
        "competences_transversales": competences_transversales[:10],
        "skill_categories": skill_categories,
        "skills_by_category": extracted_skills,
        "tech_skills_count": len(tech_skills),

        # Education & Certifications
        "formation": formation_str,
        "education": education,
        "certifications": certifications,
        "certifications_list": certifications_list[:10],

        # Languages
        "langues": langues[:8],

        # Achievements & Projects
        "achievements": achievements[:10],
        "projets": projets[:5],

        # CV Quality
        "cv_quality_score": cv_quality,
        "points_forts": points_forts[:5],
        "axes_amelioration": axes_amelioration[:5],
        "conseils_personnalises": conseils[:5] if conseils else (cv_quality or {}).get("suggestions", [])[:5],

        # Job search
        "suggested_queries": queries,
        "must_hits": hits,
        "missing_must": missing,
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
    new_jobs: List[JobListing] = []  # Collecter les nouveaux jobs pour le dashboard

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

    def normalize_text(text: Optional[str]) -> str:
        """Normalise le texte pour la comparaison (minuscules, sans accents, sans ponctuation)."""
        if not text:
            return ""
        import unicodedata
        import re
        # Convertir en minuscules
        text = text.lower().strip()
        # Supprimer les accents
        text = unicodedata.normalize("NFD", text)
        text = "".join(c for c in text if unicodedata.category(c) != "Mn")
        # Garder uniquement les caractères alphanumériques et espaces
        text = re.sub(r"[^a-z0-9\s]", "", text)
        # Normaliser les espaces multiples
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def find_duplicate_job(title: str, company: str) -> Optional[JobListing]:
        """Recherche un doublon basé sur titre + entreprise normalisés."""
        norm_title = normalize_text(title)
        norm_company = normalize_text(company)
        if not norm_title or not norm_company:
            return None
        # Recherche dans la base avec une comparaison approximative
        candidates = (
            db.query(JobListing)
            .filter(JobListing.company.ilike(f"%{norm_company[:20]}%"))
            .limit(100)
            .all()
        )
        for candidate in candidates:
            if normalize_text(candidate.title) == norm_title and normalize_text(candidate.company) == norm_company:
                return candidate
        return None

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
                # 1. Vérifier d'abord par URL normalisée (match exact)
                existing = (
                    db.query(JobListing)
                    .filter(JobListing.url == norm_url)
                    .first()
                )
                # 2. Sinon, vérifier par titre + entreprise pour détecter les doublons cross-plateforme
                if not existing:
                    existing = find_duplicate_job(job.get("title"), job.get("company"))
                if existing:
                    # Le job existe déjà, on le collecte pour le dashboard
                    # Il sera rescorré avec les nouvelles préférences
                    new_jobs.append(existing)
                    continue
                record = JobListing(
                    source=job.get("source") or source_name,
                    title=(job.get("title") or "Sans titre")[:255],
                    company=(job.get("company") or "N/A")[:255],
                    location=job.get("location"),
                    url=norm_url,  # Stocker l'URL normalisée pour éviter les doublons
                    description=job.get("description"),
                    salary_min=job.get("salary_min"),
                )
                db.add(record)
                new_jobs.append(record)  # Collecter pour le dashboard
                inserted += 1
                src_key = job.get("source") or source_name
                sources[src_key] = sources.get(src_key, 0) + 1
    db.commit()

    # Ajouter les nouveaux jobs au dashboard de l'utilisateur
    added_to_dashboard = 0
    if new_jobs:
        user_cv = cv_keywords(db, user_id)
        added_to_dashboard = add_jobs_to_user_dashboard(db, user_id, new_jobs, pref, user_cv)
        log.info("Added %d jobs to user %d dashboard", added_to_dashboard, user_id)

    return {
        "inserted": inserted,
        "added_to_dashboard": added_to_dashboard,
        "tried_queries": tried,
        "sources": sources,
        "analysis": analysis,
    }
