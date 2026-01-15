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


def detect_experience_level(text: str) -> str:
    """
    Detect experience level from CV text.
    Returns: 'junior', 'confirme', or 'senior'
    """
    text_lower = strip_accents(text.lower())

    # Count indicators for each level
    level_scores = {"junior": 0, "confirme": 0, "senior": 0}

    for level, indicators in EXPERIENCE_LEVELS.items():
        for indicator in indicators:
            indicator_normalized = strip_accents(indicator.lower())
            if indicator_normalized in text_lower:
                level_scores[level] += 1

    # Return the level with highest score, default to junior
    max_level = max(level_scores, key=level_scores.get)
    return max_level if level_scores[max_level] > 0 else "junior"


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


def build_enhanced_prompt(cv_text: str, pref_role: Optional[str], pref_location: Optional[str], must_keywords: List[str]) -> str:
    """Build an enhanced prompt for OpenAI CV analysis."""
    return f"""Analyse ce CV français et extrais les informations suivantes de manière structurée.

CV (texte extrait):
---
{cv_text[:2500]}
---

Préférences utilisateur:
- Rôle recherché: {pref_role or 'Non spécifié'}
- Localisation: {pref_location or 'France'}
- Mots-clés obligatoires: {', '.join(must_keywords) if must_keywords else 'Aucun'}

Réponds en JSON avec cette structure exacte:
{{
    "profil_resume": "Résumé du profil en 2-3 phrases maximum, incluant le niveau (étudiant/junior/confirmé/senior), le domaine et les points forts",
    "titre_poste_cible": "Le titre de poste le plus adapté au profil",
    "competences_cles": ["compétence1", "compétence2", "compétence3", "compétence4", "compétence5"],
    "competences_techniques": ["tech1", "tech2", "tech3"],
    "competences_transversales": ["soft1", "soft2"],
    "langues": ["langue1 (niveau)", "langue2 (niveau)"],
    "formation": "Diplôme principal et école/université",
    "niveau_experience": "junior|confirme|senior",
    "secteurs_cibles": ["secteur1", "secteur2"],
    "requetes_recherche": ["requête optimisée 1", "requête optimisée 2", "requête optimisée 3", "requête optimisée 4", "requête optimisée 5"]
}}

Les requêtes de recherche doivent être optimisées pour les sites d'emploi français (France Travail, LinkedIn, Indeed) et inclure la localisation si pertinente."""


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


def infer_roles(cv_text: str, pref_role: Optional[str]) -> List[str]:
    roles: List[str] = []
    if pref_role:
        roles.append(pref_role.lower())
    text = cv_text.lower()
    for hint in ROLE_HINTS:
        if hint in text:
            roles.append(hint)
    # deduplicate en conservant l'ordre
    seen = set()
    ordered = []
    for r in roles:
        if r not in seen:
            ordered.append(r)
            seen.add(r)
    return ordered


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
    Analyse complète du profil utilisateur basée sur son CV et ses préférences.
    Combine extraction locale de compétences et enrichissement OpenAI.
    """
    cv = latest_cv(db, user_id)
    cv_text = cv.text or "" if cv else ""
    tokens = tokenize(cv_text) if cv_text else []
    cleaned_role = clean_field(pref.role)
    cleaned_location = clean_field(pref.location)

    # Parse must keywords from preferences
    must_keywords_raw = [
        kw for kw in (pref.must_keywords or "").split(",") if kw.strip()
    ]
    must_keywords = [
        kw.strip().lower()
        for kw in must_keywords_raw
        if kw.strip() and kw.strip().lower() not in PLACEHOLDER_VALUES
    ]

    # Local analysis (always performed, serves as fallback)
    local_top_keywords = [w for w, _ in Counter(tokens).most_common(15)]
    local_roles = infer_roles(cv_text, cleaned_role)
    hits, missing = extract_must_hits(tokens, must_keywords)

    # Enhanced local analysis
    extracted_skills = extract_skills_from_text(cv_text) if cv_text else {}
    experience_level = detect_experience_level(cv_text) if cv_text else "junior"
    education = extract_education(cv_text) if cv_text else {"ecoles": [], "diplomes": []}

    # Flatten extracted skills for display
    all_extracted_skills = []
    for category, skills in extracted_skills.items():
        all_extracted_skills.extend(skills)

    # Build initial queries from local analysis
    queries = build_queries(local_roles, must_keywords, local_top_keywords, cleaned_location)

    # Initialize result with local analysis
    llm_used = False
    summary = ""
    top_keywords = all_extracted_skills[:15] if all_extracted_skills else local_top_keywords
    roles = local_roles
    titre_poste = local_roles[0] if local_roles else None
    competences_techniques = extracted_skills.get("langages_programmation", []) + extracted_skills.get("frameworks_web", [])
    competences_transversales = extracted_skills.get("soft_skills", [])
    langues = extracted_skills.get("langues", [])
    formation = ", ".join(education.get("diplomes", [])[:2] + education.get("ecoles", [])[:1])
    secteurs = []

    # OpenAI enrichment (optional, provides better results when available)
    if cv_text:
        prompt = build_enhanced_prompt(cv_text, cleaned_role, cleaned_location, must_keywords)
        llm_result = _call_openai(prompt, max_tokens=700)

        if llm_result:
            llm_used = True

            # Extract LLM results with fallbacks
            llm_summary = llm_result.get("profil_resume", "")
            if isinstance(llm_summary, str) and llm_summary.strip():
                summary = llm_summary.strip()

            llm_titre = llm_result.get("titre_poste_cible", "")
            if isinstance(llm_titre, str) and llm_titre.strip():
                titre_poste = llm_titre.strip()
                if titre_poste.lower() not in [r.lower() for r in roles]:
                    roles = [titre_poste] + roles[:2]

            llm_competences = llm_result.get("competences_cles", [])
            if isinstance(llm_competences, list) and llm_competences:
                top_keywords = [c for c in llm_competences if isinstance(c, str)][:15]

            llm_tech = llm_result.get("competences_techniques", [])
            if isinstance(llm_tech, list) and llm_tech:
                competences_techniques = [c for c in llm_tech if isinstance(c, str)]

            llm_soft = llm_result.get("competences_transversales", [])
            if isinstance(llm_soft, list) and llm_soft:
                competences_transversales = [c for c in llm_soft if isinstance(c, str)]

            llm_langues = llm_result.get("langues", [])
            if isinstance(llm_langues, list) and llm_langues:
                langues = [l for l in llm_langues if isinstance(l, str)]

            llm_formation = llm_result.get("formation", "")
            if isinstance(llm_formation, str) and llm_formation.strip():
                formation = llm_formation.strip()

            llm_niveau = llm_result.get("niveau_experience", "")
            if isinstance(llm_niveau, str) and llm_niveau.strip() in ["junior", "confirme", "senior"]:
                experience_level = llm_niveau.strip()

            llm_secteurs = llm_result.get("secteurs_cibles", [])
            if isinstance(llm_secteurs, list) and llm_secteurs:
                secteurs = [s for s in llm_secteurs if isinstance(s, str)]

            llm_queries = llm_result.get("requetes_recherche", [])
            if isinstance(llm_queries, list) and llm_queries:
                queries = [q for q in llm_queries if isinstance(q, str)][:5]

    # Build summary if not from LLM
    if not summary:
        summary_parts = []
        if titre_poste:
            summary_parts.append(f"Profil {experience_level} en {titre_poste}")
        if formation:
            summary_parts.append(f"Formation: {formation}")
        if top_keywords:
            summary_parts.append(f"Compétences: {', '.join(top_keywords[:5])}")
        if not summary_parts:
            summary_parts.append("Ajoute un CV pour une analyse détaillée de ton profil.")
        summary = " | ".join(summary_parts)

    # Ensure queries have location if specified
    if cleaned_location and queries:
        queries = [
            q if cleaned_location.lower() in q.lower() else f"{q} {cleaned_location}"
            for q in queries
        ][:5]

    return {
        "cv_present": bool(cv),
        "top_keywords": top_keywords,
        "inferred_roles": roles,
        "suggested_queries": queries,
        "must_hits": hits,
        "missing_must": missing,
        "summary": summary,
        "llm_used": llm_used,
        # Enhanced fields
        "titre_poste_cible": titre_poste,
        "niveau_experience": experience_level,
        "competences_techniques": competences_techniques[:10],
        "competences_transversales": competences_transversales[:5],
        "langues": langues[:5],
        "formation": formation,
        "secteurs_cibles": secteurs[:5],
        "skills_by_category": extracted_skills,
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
