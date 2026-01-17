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
from .services.matching import add_jobs_to_user_dashboard, cv_keywords
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
    Analyse complète du profil utilisateur basée sur son CV et ses préférences.
    Combine extraction locale de compétences et enrichissement OpenAI.
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
    # Filter out single-letter tokens to avoid false positives like "r"
    top_tokens = [w for w, _ in Counter(tokens).most_common(20) if len(w) > 1]
    # Tech skills first, then other frequent keywords not already in tech_skills
    top_keywords = tech_skills[:15] + [t for t in top_tokens if t not in tech_skills][:5]
    top_keywords = top_keywords[:15]  # Limit to 15

    # Detect experience level
    experience_level = detect_experience_level(cv_text) if cv_text else None

    # Categorize skills for better display
    skill_categories = categorize_skills(tech_skills) if tech_skills else {}

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
    # Filter out single-letter tokens to avoid false positives
    local_top_keywords = [w for w, _ in Counter(tokens).most_common(15) if len(w) > 1]
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
                # Filter out single-letter skills that are likely false positives
                top_keywords = [
                    c for c in llm_competences
                    if isinstance(c, str) and len(c.strip()) > 1
                ][:15]

            llm_tech = llm_result.get("competences_techniques", [])
            if isinstance(llm_tech, list) and llm_tech:
                competences_techniques = [c for c in llm_tech if isinstance(c, str)]

            llm_soft = llm_result.get("competences_transversales", [])
            if isinstance(llm_soft, list) and llm_soft:
                competences_transversales = [c for c in llm_soft if isinstance(c, str)]

            llm_langues = llm_result.get("langues", [])
            if isinstance(llm_langues, list) and llm_langues:
                langues = [lang for lang in llm_langues if isinstance(lang, str)]

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
                    # Le job existe déjà, mais on le collecte pour le dashboard
                    new_jobs.append(existing)
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
