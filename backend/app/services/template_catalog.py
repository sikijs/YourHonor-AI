import json
import re
from pathlib import Path
from typing import Optional

from app.models.template import CatalogTemplate, TemplateField

TEMPLATES_DIR = None
CATALOG_PATH = None


def _find_project_root() -> Path:
    here = Path(__file__).resolve().parent
    for parent in [here] + list(here.parents):
        candidate = parent / "catalog.json"
        if candidate.exists():
            return parent
    raise FileNotFoundError("Could not find project root (catalog.json not found in any parent)")


def _ensure_paths():
    global TEMPLATES_DIR, CATALOG_PATH
    if TEMPLATES_DIR is not None:
        return
    root = _find_project_root()
    TEMPLATES_DIR = root / "templates"
    CATALOG_PATH = root / "catalog.json"

PLACEHOLDER_PATTERN = re.compile(
    r'<span class="(coverpage_link|orderform_link|keyterms_link)">([^<]+)</span>'
)

FIELD_HINTS: dict[str, str] = {
    "Purpose": "What the confidential info will be used for — e.g. 'Evaluating a potential business partnership'",
    "Effective Date": "When the agreement starts — e.g. 'January 1, 2026' or 'The date both parties sign'",
    "MNDA Term": "How long the NDA remains in effect — e.g. '2 years' or 'Until terminated by either party'",
    "Term of Confidentiality": "How long secrets stay protected after the agreement ends — e.g. '5 years' or 'Perpetually for trade secrets'",
    "Governing Law": "Which state's laws apply — e.g. 'Delaware', 'New York', 'California'",
    "Jurisdiction": "Which courts handle disputes — e.g. 'courts located in New Castle, DE'",
    "Provider": "Name of the company providing services — e.g. 'Acme Cloud Solutions Inc.'",
    "Customer": "Name of the company receiving services — e.g. 'Beta Corp'",
    "Subscription Period": "How long the service lasts — e.g. '12 months' or 'Monthly, auto-renewing'",
    "Technical Support": "Level of support provided — e.g. 'Email support during business hours with 4-hour response'",
    "Use Limitations": "Restrictions on how the service can be used — e.g. '10 users, 100 GB storage, 10,000 API calls/month'",
    "Payment Process": "How and when payment is made — e.g. 'Monthly in advance via invoice, net 30'",
    "Order Date": "When the order is placed — e.g. 'January 15, 2026'",
    "Non-Renewal Notice Date": "Last day to cancel before auto-renewal — e.g. '30 days before renewal date'",
    "DPA": "Data Processing Agreement reference — e.g. 'The DPA attached as Exhibit A' or 'Standard DPA posted at company.com/dpa'",
    "Additional Warranties": "Extra promises beyond standard terms — e.g. 'Provider warrants 99.9% uptime' or 'None'",
    "General Cap Amount": "Maximum liability for most claims — e.g. 'fees paid in the last 12 months', '$50,000'",
    "Increased Claims": "Types of claims with higher liability caps — e.g. 'IP infringement', 'Breach of confidentiality', 'Data breach'",
    "Increased Cap Amount": "Higher liability limit for increased claims — e.g. '3x General Cap', '$1,000,000'",
    "Unlimited Claims": "Claims with NO liability cap — e.g. 'Fraud, gross negligence, willful misconduct, IP infringement'",
    "Provider Covered Claims": "Claims the provider is responsible for — e.g. 'Provider IP infringement, security breach'",
    "Customer Covered Claims": "Claims the customer is responsible for — e.g. 'Customer misuse of services, violation of law'",
    "Chosen Courts": "Which courts hear disputes — e.g. 'New Castle, DE'",
    "Partner": "Name of the partner company — e.g. 'Gamma Technologies LLC'",
    "Company": "Name of the company — e.g. 'Delta Enterprises Inc.'",
    "Program": "Name of the program or initiative — e.g. 'Partner Enablement Program 2026'",
    "Term": "Duration of the agreement — e.g. '1 year from Effective Date'",
    "Fees": "Amount or structure of fees — e.g. '$10,000 annual fee, payable quarterly'",
    "Notice Address": "Where legal notices are sent — e.g. '123 Main St, Wilmington, DE 19801'",
    "Target Uptime": "Guaranteed service availability — e.g. '99.9%' or '99.99%'",
    "Target Response Time": "Maximum time to respond to issues — e.g. '4 hours for critical, 24 hours for normal'",
    "Support Channel": "How support is accessed — e.g. 'Email, phone, or web portal'",
    "Uptime Credit": "Credit amount if uptime is missed — e.g. '5% of monthly fee per 0.5% below target'",
    "Response Time Credit": "Credit amount if response time is missed — e.g. '2% of monthly fee per missed response'",
    "Scheduled Downtime": "When planned maintenance occurs — e.g. 'Sundays 2-4 AM ET'",
    "Customer Policies": "Customer's internal policies the provider must follow — e.g. 'Data security policy, acceptable use policy'",
    "Security Policy": "Reference to the security policy — e.g. 'Security policy attached as Exhibit B'",
    "SOW Term": "Duration of a Statement of Work — e.g. '6 months from SOW Effective Date'",
    "Insurance Minimums": "Minimum insurance coverage — e.g. '$1M general liability, $1M professional liability'",
    "Deliverables": "What is delivered — e.g. 'Custom software module with source code and documentation'",
    "Deliverable": "A single item being delivered — e.g. 'Architecture design document'",
    "Rejection Period": "Days to reject deliverables — e.g. '15 days after delivery'",
    "Resubmission Period": "Days to fix and resubmit rejected work — e.g. '10 days after rejection notice'",
    "Customer Obligations": "What the customer must provide — e.g. 'Access to systems, timely feedback, test data'",
    "Time of Assignment": "When IP rights transfer — e.g. 'Upon full payment' or 'Upon creation'",
    "Payment Period": "Days to pay after invoice — e.g. 'Net 30' or 'Net 45'",
    "Brand Guidelines": "How the partner may use the company's brand — e.g. 'Per brand guide at company.com/brand'",
    "Obligations": "Each party's responsibilities — e.g. 'Company provides leads, Partner meets revenue targets'",
    "Payment Schedule": "When payments are made — e.g. 'Quarterly in advance' or '50% upfront, 50% on completion'",
    "Territory": "Geographic scope — e.g. 'North America' or 'Worldwide'",
    "End Date": "When the agreement or term ends — e.g. 'December 31, 2026'",
    "Permitted Uses": "What the software can be used for — e.g. 'Internal business use only' or 'Hosting customer applications'",
    "Deletion Procedure": "How customer data is deleted after termination — e.g. '30 days written notice, permanent deletion within 60 days'",
    "License Limits": "Restrictions on software use — e.g. '5 named users, 3 production servers, 1 staging server'",
    "Warranty Period": "How long the software warranty lasts — e.g. '90 days from delivery'",
    "Agreement": "Reference to the underlying agreement this template modifies — e.g. 'The Master Services Agreement dated Jan 1, 2026'",
    "Categories of Personal Data": "Types of personal data processed — e.g. 'Names, email addresses, IP addresses, payment info'",
    "Categories of Data Subjects": "Whose data is processed — e.g. 'Customers, employees of customers, end users'",
    "Special Category Data": "Sensitive data types under GDPR Art. 9 — e.g. 'None' or 'Health data, biometric data'",
    "Special Category Data Restrictions or Safeguards": "Additional protections for sensitive data — e.g. 'Encrypted at rest and in transit, access logged'",
    "Frequency of Transfer": "How often data is transferred — e.g. 'Continuous' or 'Daily batch'",
    "Nature and Purpose of Processing": "Why the data is processed — e.g. 'To provide cloud services including account management and support'",
    "Duration of Processing": "How long processing continues — e.g. 'Duration of the Agreement plus 90 days for transition'",
    "Approved Subprocessors": "List of authorized subprocessors — e.g. 'AWS (us-east-1), Stripe, Zendesk'",
    "Governing Member State": "EU member state governing data processing — e.g. 'Ireland' or 'Luxembourg'",
    "Provider Security Contact": "Contact for security matters — e.g. 'security@provider.com'",
    "Pilot Period": "How long the pilot runs — e.g. '90 days' or '3 months'",
    "Evaluation Purposes": "What the pilot evaluates — e.g. 'Evaluate software performance and integration compatibility'",
    "Limitations": "Restrictions on the business associate's use of PHI — e.g. 'Only as necessary to perform services'",
    "Breach Notification Period": "Days to notify after discovering a breach — e.g. '30 days' or '45 days'",
    "BAA Effective Date": "When the Business Associate Agreement takes effect — e.g. 'January 1, 2026'",
    "Training Data": "What data the AI provider may use for training — e.g. 'No training data may include Customer confidential info'",
    "Training Purposes": "What the AI training is used for — e.g. 'Model improvement, but NOT for training competitive products'",
    "Training Restrictions": "Limitations on AI training use — e.g. 'Customer data may only be used for inference, never for model training'",
    "Improvement Restrictions": "How AI service improvements may use customer data — e.g. 'Anonymized usage data only, no content retention'",
    "Modifications": "Any changes to the standard MNDA terms — e.g. 'Section 5: confidentiality obligations survive 3 years. Add Section 12: Data Security Requirements.'",
    "Recipient Name": "Name and title of the person receiving the document — e.g. 'Professor Jane Smith' or 'Senior Partner, Corporate Law Division'",
    "Author Name": "Name and title of the person writing the document — e.g. 'John Doe, Summer Associate' or 'Legal Research Team'",
    "Subject": "Brief description of the document's topic — e.g. 'Enforceability of Non-Compete Clauses Under California Law'",
    "Question Presented": "The legal question to be analyzed — e.g. 'Whether a non-compete clause is enforceable against a former employee under California Business and Professions Code Section 16600'",
    "Brief Answer": "A short summary of your legal conclusion — e.g. 'No. California law broadly prohibits non-compete agreements unless a sale-of-business exception applies.'",
    "Facts": "Relevant factual background — e.g. 'Plaintiff signed a non-compete agreement on January 15, 2024, as part of her employment contract...'",
    "Discussion": "Legal analysis applying the law to the facts — e.g. 'Under California law, Business and Professions Code Section 16600 voids non-compete agreements...'",
    "Conclusion": "Final recommendation or holding — e.g. 'The non-compete clause is likely unenforceable. The client should proceed with the motion to strike.'",
    "Court Name": "The court where the action is filed — e.g. 'United States District Court for the Southern District of New York' or 'Superior Court of California, County of Los Angeles'",
    "Plaintiff Name": "Name of the party bringing the lawsuit — e.g. 'Jane Doe' or 'Acme Corporation'",
    "Defendant Name": "Name of the party being sued — e.g. 'John Smith' or 'Beta Industries, Inc.'",
    "Case Number": "The case number assigned by the court — e.g. '1:26-cv-00001' or '26CV-0001'",
    "Jurisdiction Statement": "Legal basis for the court's authority — e.g. 'This Court has diversity jurisdiction under 28 U.S.C. Section 1332 because Plaintiff is a citizen of California, Defendant is a citizen of New York, and the amount in controversy exceeds $75,000.'",
    "Causes of Action": "The legal claims being asserted — e.g. 'Count I: Breach of Contract; Count II: Negligence; Count III: Unjust Enrichment'",
    "Prayer for Relief": "The specific remedies requested — e.g. 'Compensatory damages in the amount of $250,000, punitive damages, attorneys' fees, costs, and such other relief as the Court deems just and proper.'",
    "Damages": "The monetary amount sought — e.g. '$250,000 in compensatory damages plus punitive damages to be determined at trial'",
    "Admissions": "Paragraphs of the complaint that are admitted — e.g. 'Defendant admits the allegations in paragraphs 1-5, 10, and 15-20.'",
    "Denials": "Paragraphs of the complaint that are denied — e.g. 'Defendant denies the allegations in paragraphs 6-9, 11-14, and 21-30.'",
    "Affirmative Defenses": "Legal defenses that must be raised in the answer — e.g. '1. Failure to state a claim upon which relief can be granted. 2. Statute of limitations. 3. Contributory negligence. 4. Waiver and estoppel.'",
    "Counterclaims": "Claims the defendant brings against the plaintiff — e.g. 'Count I: Breach of Contract (Defendant's work was not completed on time, causing damages). Count II: Defamation.'",
    "Sender Name": "Name and title of the person sending the demand letter — e.g. 'Sarah Johnson, Attorney at Law' or 'Michael Chen, CEO'",
    "Amount Demanded": "The specific monetary amount demanded — e.g. '$75,000 for unpaid wages and overtime compensation'",
    "Response Deadline": "Date by which the recipient must respond — e.g. 'February 28, 2026' or '30 days from the date of this letter'",
    "Facts Summary": "Brief factual background leading to the demand — e.g. 'On June 1, 2025, Plaintiff entered into a consulting agreement with Defendant...'",
    "Legal Basis": "The legal grounds for the demand — e.g. 'Under the Fair Labor Standards Act and state wage and hour laws...'",
    "Party 1": "First party to the settlement agreement — e.g. 'Jane Doe (Plaintiff)' or 'ABC Corporation'",
    "Party 2": "Second party to the settlement agreement — e.g. 'John Smith (Defendant)' or 'XYZ LLC'",
    "Recitals": "Background facts explaining why the settlement is being entered — e.g. 'WHEREAS, on January 15, 2025, Plaintiff filed a complaint against Defendant alleging breach of contract...'",
    "Settlement Amount": "The total amount being paid to settle the matter — e.g. '$100,000 paid in a lump sum within 30 days of execution'",
    "Release Provisions": "Scope of claims being released — e.g. 'Plaintiff releases Defendant from all claims arising out of or relating to the employment relationship, including but not limited to claims under Title VII, state law, and contract law.'",
    "Confidentiality Terms": "Terms governing confidentiality of the settlement — e.g. 'The terms of this Settlement Agreement shall remain confidential. Neither party shall disclose them except as required by law or to their legal and financial advisors.'",
    "Interrogatories": "Written questions the opposing party must answer under oath — e.g. '1. Describe in detail each communication you had with Plaintiff between January 1 and June 30, 2025. 2. Identify all documents that relate to Plaintiff's termination...'",
    "Requests for Production": "Documents or other evidence requested — e.g. '1. All personnel files and performance reviews for Plaintiff. 2. All emails between Defendant and Plaintiff from January 2025 to present. 3. Any surveillance footage...'",
}


class TemplateCatalogService:
    def __init__(self):
        self.templates: list[CatalogTemplate] = []
        self._loaded = False

    def load(self):
        if self._loaded:
            return

        _ensure_paths()

        if not CATALOG_PATH.exists():
            raise FileNotFoundError(f"Catalog not found: {CATALOG_PATH}")

        raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

        for entry in raw.get("templates", []):
            filename = entry["filename"]
            file_path = TEMPLATES_DIR / filename

            fields = []
            cover_page_fields = None

            if file_path.exists():
                content = file_path.read_text(encoding="utf-8")
                fields = self._extract_fields(content)

            cover_filename = self._cover_page_filename(filename)
            cover_path = TEMPLATES_DIR / cover_filename
            if cover_path.exists():
                cover_content = cover_path.read_text(encoding="utf-8")
                cover_page_fields = self._extract_cover_fields(cover_content)

            self.templates.append(
                CatalogTemplate(
                    name=entry["name"],
                    description=entry["description"],
                    filename=filename,
                    fields=fields,
                    cover_page_fields=cover_page_fields or None,
                )
            )

        self._loaded = True

    def _extract_fields(self, content: str) -> list[TemplateField]:
        seen = set()
        fields = []
        for match in PLACEHOLDER_PATTERN.finditer(content):
            category = match.group(1)
            name = match.group(2).strip()
            key = f"{category}:{name}"
            if key not in seen:
                seen.add(key)
                fields.append(
                    TemplateField(
                        name=name,
                        category=category,
                        placeholder=f'<span class="{category}">{name}</span>',
                        hint=FIELD_HINTS.get(name, f"Enter value for '{name}'"),
                    )
                )
        return fields

    def _extract_cover_fields(self, content: str) -> list[TemplateField]:
        fields = []
        heading_pattern = re.compile(r"^### (.+)$", re.MULTILINE)
        for match in heading_pattern.finditer(content):
            name = match.group(1).strip()
            if name == "Governing Law & Jurisdiction":
                fields.append(TemplateField(name="Governing Law", category="cover_page", placeholder="### Governing Law & Jurisdiction", hint=FIELD_HINTS.get("Governing Law", "State whose laws apply")))
                fields.append(TemplateField(name="Jurisdiction", category="cover_page", placeholder="### Governing Law & Jurisdiction", hint=FIELD_HINTS.get("Jurisdiction", "Courts that handle disputes")))
                continue
            if name == "MNDA Modifications":
                name = "Modifications"
            fields.append(
                TemplateField(
                    name=name,
                    category="cover_page",
                    placeholder=f"### {name}",
                    hint=FIELD_HINTS.get(name, f"Enter value for '{name}'"),
                )
            )
        return fields

    def _cover_page_filename(self, template_filename: str) -> str:
        stem = Path(template_filename).stem
        if stem.endswith(("-coverpage", "-cover-page", "-cover_page")):
            return template_filename
        parts = stem.rsplit("-", 1)
        if len(parts) > 1 and parts[1].lower() in ("agreement", "license"):
            base = stem
        else:
            base = stem
        candidates = []
        if "Agreement" in base:
            candidates.append(base.replace("Agreement", "Agreement-coverpage"))
        if "License" in base:
            candidates.append(base.replace("License", "License-coverpage"))
        candidates.append(f"{base}-coverpage")
        for c in candidates:
            candidate_path = TEMPLATES_DIR / f"{c}.md"
            if candidate_path.exists():
                return candidate_path.name
        return stem + "-coverpage.md"

    def get_catalog(self) -> list[CatalogTemplate]:
        self.load()
        return self.templates

    def find_by_name(self, name: str) -> Optional[CatalogTemplate]:
        self.load()
        for t in self.templates:
            if t.name.lower() == name.lower():
                return t
        return None

    def find_by_filename(self, filename: str) -> Optional[CatalogTemplate]:
        self.load()
        for t in self.templates:
            if t.filename == filename:
                return t
        return None

    def guess_template(self, query: str) -> Optional[CatalogTemplate]:
        self.load()
        query_lower = query.lower()
        for t in self.templates:
            if t.name.lower() in query_lower or any(
                word in query_lower for word in t.name.lower().split()
            ):
                return t
        return None


template_catalog = TemplateCatalogService()


def get_template_catalog() -> TemplateCatalogService:
    return template_catalog
