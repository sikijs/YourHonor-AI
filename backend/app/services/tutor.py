import os
import logging
import re
from typing import Optional

from litellm import completion
from app.models.tutor import (
    TutorQuestion, TutorStartResponse, TutorAnswerResponse,
    GeneratedEvaluation,
)
from app.services.retrieval import parse_llm_json

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openrouter/qwen/qwen3-14b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

TOPICS = {
    "contracts": {
        "name": "Contracts",
        "description": "Formation, performance, and enforcement of legally binding agreements.",
        "questions": [
            TutorQuestion(
                question="What are the four essential elements required for a valid contract?",
                hint="Think about what makes a promise legally enforceable.",
                expected_concepts=["offer", "acceptance", "consideration", "mutual assent", "meeting of the minds"],
                difficulty=1,
            ),
            TutorQuestion(
                question="What is consideration in contract law? Explain with an example of valid consideration and one where consideration is lacking.",
                hint="Consider the difference between a bargained-for exchange and a gift.",
                expected_concepts=["bargained-for exchange", "legal detriment", "benefit", "adequacy vs sufficiency"],
                difficulty=2,
            ),
            TutorQuestion(
                question="Under the common law, when is an offer considered terminated before acceptance?",
                hint="Think about what circumstances can end the power of acceptance.",
                expected_concepts=["revocation", "rejection", "counteroffer", "lapse of time", "death or incapacity"],
                difficulty=2,
            ),
            TutorQuestion(
                question="Explain the difference between a bilateral contract and a unilateral contract. Provide an example of each.",
                hint="Focus on how acceptance is communicated in each type.",
                expected_concepts=["promise for a promise", "promise for an act", "acceptance by performance", "communication"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the Statute of Frauds and what types of contracts must be in writing to be enforceable?",
                hint="Consider contracts that are historically prone to fraud or misunderstanding.",
                expected_concepts=["writing requirement", "sale of land", "suretyship", "contracts lasting over one year", "goods over $500"],
                difficulty=3,
            ),
            TutorQuestion(
                question="When can a contract be voided due to a unilateral mistake? How does this differ from a mutual mistake?",
                hint="Consider the difference between both parties being wrong versus one party being wrong.",
                expected_concepts=["mutual mistake", "unilateral mistake", "material fact", "known or should have known", "risk allocation"],
                difficulty=4,
            ),
            TutorQuestion(
                question="Under the UCC versus common law, how are additional terms in an acceptance treated? What is the 'battle of the forms'?",
                hint="UCC 2-207 changes the common law 'mirror image' rule for sale of goods.",
                expected_concepts=["UCC 2-207", "additional terms", "mirror image rule", "merchant vs non-merchant", "conditional acceptance"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the doctrine of promissory estoppel and when can it be used as a substitute for consideration?",
                hint="This doctrine allows enforcement of promises even without consideration.",
                expected_concepts=["promissory estoppel", "reasonable reliance", "foreseeable reliance", "injustice prevention", "clear and definite promise"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the parol evidence rule and what are its exceptions?",
                hint="This rule limits the use of prior or contemporaneous evidence to vary contract terms.",
                expected_concepts=["integrated agreement", "merger clause", "ambiguity exception", "fraud or misrepresentation", "course of dealing"],
                difficulty=4,
            ),
            TutorQuestion(
                question="When is specific performance available as a remedy for breach of contract? When is it unavailable?",
                hint="Specific performance is an equitable remedy, not available as of right.",
                expected_concepts=["inadequacy of damages", "unique subject matter", "real property presumption", "personal services exception", "feasibility of supervision"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is the difference between a condition precedent, a condition subsequent, and a concurrent condition? Give an example of each.",
                hint="Conditions affect when a duty to perform arises or when it is discharged.",
                expected_concepts=["condition precedent", "condition subsequent", "concurrent condition", "express vs constructive condition", "material vs minor breach"],
                difficulty=3,
            ),
        ],
    },
    "torts": {
        "name": "Torts",
        "description": "Civil wrongs, negligence, strict liability, and intentional torts.",
        "questions": [
            TutorQuestion(
                question="What are the five elements of a negligence claim?",
                hint="Think about what a plaintiff must prove to win a negligence case.",
                expected_concepts=["duty", "breach", "actual causation", "proximate causation", "damages"],
                difficulty=1,
            ),
            TutorQuestion(
                question="Explain the 'reasonable person' standard in negligence. How does it apply to professionals versus ordinary individuals?",
                hint="Consider how the standard of care changes based on the defendant's circumstances.",
                expected_concepts=["objective standard", "reasonable person", "professional standard", "custom and practice"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the doctrine of res ipsa loquitur and when can a plaintiff use it?",
                hint="This doctrine translates to 'the thing speaks for itself.'",
                expected_concepts=["inference of negligence", "exclusive control", "ordinarily would not happen without negligence", "burden shifting"],
                difficulty=3,
            ),
            TutorQuestion(
                question="Compare and contrast contributory negligence, comparative negligence, and assumption of risk.",
                hint="Each doctrine affects how a plaintiff's own conduct impacts recovery.",
                expected_concepts=["contributory negligence bar", "comparative fault", "pure vs modified comparative", "express assumption", "implied assumption"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the difference between an intentional tort and negligence? Give an example of each for the same harm.",
                hint="Focus on the defendant's state of mind or intent.",
                expected_concepts=["intent", "purpose or knowledge", "substantial certainty", "difference in mental state", "level of fault required"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the difference between strict liability for abnormally dangerous activities and strict liability for defective products?",
                hint="Both impose liability without fault, but the policy goals and tests differ.",
                expected_concepts=["Rylands v. Fletcher", "Restatement Torts 519-520", "design defect", "manufacturing defect", "failure to warn"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What are the elements of the tort of intentional infliction of emotional distress (IIED)? Why is it treated differently from other intentional torts?",
                hint="This tort has a heightened standard compared to battery or assault.",
                expected_concepts=["extreme and outrageous conduct", "severe emotional distress", "intent or recklessness", "causation", "bystander recovery"],
                difficulty=4,
            ),
            TutorQuestion(
                question="Explain the concept of proximate cause in negligence. What is the 'substantial factor' test and how does it relate to foreseeability?",
                hint="Proximate cause limits liability even when actual cause is established.",
                expected_concepts=["substantial factor", "foreseeability", "direct causation", "intervening cause", "superseding cause", "Palsgraf v. Long Island RR"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the difference between slander and libel? What damages must be shown for each, and how does the First Amendment affect defamation claims involving public figures?",
                hint="The distinction turns on the form of the defamatory statement and the plaintiff's status.",
                expected_concepts=["slander per se", "libel", "special damages", "public figure", "actual malice", "New York Times v. Sullivan"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is a nuisance and how does it differ from trespass to land?",
                hint="One involves interference with use and enjoyment; the other involves physical invasion.",
                expected_concepts=["private nuisance", "public nuisance", "substantial interference", "physical invasion", "reasonable use balancing"],
                difficulty=3,
            ),
        ],
    },
    "constitutional_law": {
        "name": "Constitutional Law",
        "description": "Structure of government, individual rights, and judicial review.",
        "questions": [
            TutorQuestion(
                question="What is judicial review and which Supreme Court case established it?",
                hint="Think about the power of courts to review laws for constitutionality.",
                expected_concepts=["Marbury v. Madison", "Article III", "review of legislative acts", "Constitution as supreme law"],
                difficulty=1,
            ),
            TutorQuestion(
                question="Explain the three-prong test established in Lemon v. Kurtzman for evaluating Establishment Clause violations.",
                hint="This test involves the purpose and effect of government action regarding religion.",
                expected_concepts=["secular purpose", "primary effect neither advances nor inhibits", "excessive entanglement", "Establishment Clause"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the difference between strict scrutiny, intermediate scrutiny, and rational basis review? When is each applied?",
                hint="The level of scrutiny depends on the classification or right at issue.",
                expected_concepts=["strict scrutiny", "intermediate scrutiny", "rational basis", "suspect classification", "fundamental right", "compelling interest"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the state action requirement under the Fourteenth Amendment? Can private conduct ever be considered state action?",
                hint="The Constitution generally limits government, not private actors.",
                expected_concepts=["government conduct", "private actor exceptions", "public function test", "entanglement test", "symbiotic relationship"],
                difficulty=4,
            ),
            TutorQuestion(
                question="Explain the overbreadth and vagueness doctrines in First Amendment jurisprudence.",
                hint="These doctrines relate to how laws are written, not how they are applied.",
                expected_concepts=["overbreadth", "chilling effect", "substantial overbreadth", "void for vagueness", "fair notice", "arbitrary enforcement"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is the modern test for Congress's power under the Commerce Clause after United States v. Lopez?",
                hint="Lopez revived limits on Commerce Clause power that had been dormant since the New Deal.",
                expected_concepts=["channels of commerce", "instrumentalities of commerce", "substantial effect on interstate commerce", "economic vs non-economic activity", "aggregation principle"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the difference between substantive due process and procedural due process? Give an example of each.",
                hint="One concerns the content of laws; the other concerns how laws are enforced.",
                expected_concepts=["fundamental rights", "life liberty or property", "notice and hearing", "strict scrutiny", "incorporation doctrine"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the 'state action' doctrine and why is it important for constitutional claims?",
                hint="The Constitution generally protects against government, not private, conduct.",
                expected_concepts=["Fourteenth Amendment", "government actor", "public function test", "entwinement test", "private discrimination"],
                difficulty=3,
            ),
            TutorQuestion(
                question="Explain the tiers of scrutiny for Equal Protection Clause violations. What classifications trigger each tier?",
                hint="Not all classifications are treated equally under the Equal Protection Clause.",
                expected_concepts=["strict scrutiny", "intermediate scrutiny", "rational basis", "suspect classification", "quasi-suspect classification"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the free exercise of religion under the First Amendment after Employment Division v. Smith?",
                hint="Smith changed the standard for neutral laws of general applicability.",
                expected_concepts=["neutral law of general applicability", "compelling interest test", "individualized exemptions", "RFRA", "religious accommodation"],
                difficulty=4,
            ),
        ],
    },
    "criminal_procedure": {
        "name": "Criminal Procedure",
        "description": "Fourth, Fifth, and Sixth Amendment rights in the criminal justice system.",
        "questions": [
            TutorQuestion(
                question="What constitutes a 'search' under the Fourth Amendment? What constitutes a 'seizure'?",
                hint="Consider the reasonable expectation of privacy test.",
                expected_concepts=["reasonable expectation of privacy", "Katz v. United States", "trespass doctrine", "seizure of person", "free to leave test"],
                difficulty=1,
            ),
            TutorQuestion(
                question="What are the exceptions to the warrant requirement under the Fourth Amendment? List at least four.",
                hint="Courts have recognized many situations where a warrant is not required.",
                expected_concepts=["consent", "plain view", "search incident to arrest", "exigent circumstances", "automobile exception", "stop and frisk"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What are the requirements for a valid Miranda warning? When must it be given?",
                hint="Consider what triggers the obligation to warn and what the warning must include.",
                expected_concepts=["custody", "interrogation", "right to remain silent", "right to counsel", "waiver", "Miranda v. Arizona"],
                difficulty=2,
            ),
            TutorQuestion(
                question="Explain the 'fruit of the poisonous tree' doctrine and its exceptions.",
                hint="This doctrine extends the exclusionary rule to evidence derived from illegal conduct.",
                expected_concepts=["inevitable discovery", "independent source", "attenuation", "exclusionary rule", "derivative evidence"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the difference between a Terry stop and a formal arrest? What level of suspicion is required for each?",
                hint="The standard of suspicion differs based on the level of intrusion.",
                expected_concepts=["reasonable suspicion", "probable cause", "Terry v. Ohio", "brief and limited", "length and scope"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the good faith exception to the exclusionary rule and what policies support it?",
                hint="This exception applies when officers reasonably rely on what they believe is lawful authority.",
                expected_concepts=["good faith exception", "reasonable reliance", "deterrence rationale", "United States v. Leon", "objectively reasonable"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is the plain view doctrine? What three conditions must be satisfied for its application?",
                hint="This exception allows warrantless seizure of evidence visible from a lawful vantage point.",
                expected_concepts=["lawful vantage point", "inadvertent discovery", "immediately apparent incriminating nature", "lawful access to object", "probable cause nexus"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What are a suspect's Fifth Amendment rights during custodial interrogation? When can they be waived?",
                hint="The Fifth Amendment protects against compelled self-incrimination during questioning.",
                expected_concepts=["right to remain silent", "custody requirement", "interrogation requirement", "knowing and voluntary waiver", "invocation must be unambiguous"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What constitutes an 'interrogation' for Miranda purposes? What is the 'functional equivalent' of interrogation?",
                hint="Interrogation includes more than express questioning.",
                expected_concepts=["express questioning", "functional equivalent", "reasonably likely to elicit incriminating response", "Rhode Island v. Innis", "booking questions exception"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is the Sixth Amendment right to counsel and when does it attach? How does it differ from the Fifth Amendment right to counsel under Miranda?",
                hint="The Sixth Amendment right is offense-specific and attaches at a different stage.",
                expected_concepts=["criminal prosecution", "adversarial judicial proceedings", "offense-specific", "deliberate elicitation", "Massiah doctrine"],
                difficulty=4,
            ),
        ],
    },
    "evidence": {
        "name": "Evidence",
        "description": "Rules governing what evidence can be presented in court.",
        "questions": [
            TutorQuestion(
                question="What is relevance and when is relevant evidence inadmissible under Federal Rule of Evidence 403?",
                hint="Not all relevant evidence is admissible — there is a balancing test.",
                expected_concepts=["probative", "material", "unfair prejudice", "confusion of issues", "undue delay", "FRE 403 balancing"],
                difficulty=1,
            ),
            TutorQuestion(
                question="What is hearsay and why is it generally inadmissible?",
                hint="Consider the reliability concerns with out-of-court statements.",
                expected_concepts=["out-of-court statement", "offered for truth of the matter", "declarant", "crossexamination concerns", "reliability"],
                difficulty=2,
            ),
            TutorQuestion(
                question="List and explain at least five exceptions to the hearsay rule that apply regardless of declarant availability.",
                hint="These exceptions are based on inherent reliability.",
                expected_concepts=["present sense impression", "excited utterance", "then-existing mental state", "business records", "public records", "learned treatises"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the difference between impeachment and rehabilitation of a witness? What methods are permitted for each?",
                hint="Impeachment attacks credibility; rehabilitation restores it.",
                expected_concepts=["bias or motive", "prior inconsistent statement", "character for truthfulness", "reputation evidence", "specific instances", "FRE 607-609"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the best evidence rule (original document rule) and when does it apply?",
                hint="This rule concerns proving the content of a writing.",
                expected_concepts=["original document required", "writing recording or photograph", "proving content", "exceptions for lost originals", "FRE 1001-1008"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What are the requirements for introducing a business record under the business records exception to hearsay (FRE 803(6))?",
                hint="Business records are a hearsay exception that requires foundation testimony.",
                expected_concepts=["regularly conducted business activity", "made at or near the time", "by a person with knowledge", "kept in course of regularly conducted activity", "trustworthiness inquiry"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is character evidence and when is it admissible in a criminal case?",
                hint="Character evidence rules differ depending on whether it's offered by the prosecution or defense.",
                expected_concepts=["propensity inference", "character trait", "FRE 404", "essentials of charge or defense", "character witness testimony"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the difference between a lay opinion and expert opinion testimony? What foundation is required for each?",
                hint="The rules governing opinion testimony depend on whether the witness has specialized knowledge.",
                expected_concepts=["lay opinion", "rationally based on perception", "helpful to fact-finder", "expert testimony", "reliable principles and methods", "FRE 701-702"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the privilege against self-incrimination in the evidentiary context? Who can invoke it and when?",
                hint="This privilege protects witnesses from being compelled to testify against themselves.",
                expected_concepts=["Fifth Amendment privilege", "testimonial communication", "criminal case only", "witness in civil case", "waiver by taking the stand"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is authentication of evidence? Give examples of how different types of evidence are authenticated.",
                hint="Authentication requires proof that evidence is what its proponent claims it is.",
                expected_concepts=["FRE 901", "witness testimony", "distinctive characteristics", "chain of custody", "self-authenticating documents", "public records"],
                difficulty=2,
            ),
        ],
    },
    "property_law": {
        "name": "Property Law",
        "description": "Real and personal property, estates, land transactions, and landlord-tenant law.",
        "questions": [
            TutorQuestion(
                question="What are the four requirements for adverse possession of real property?",
                hint="Think about what a trespasser must show to claim ownership.",
                expected_concepts=["actual possession", "open and notorious", "hostile", "continuous for statutory period", "exclusive"],
                difficulty=2,
            ),
            TutorQuestion(
                question="Explain the difference between a fee simple absolute and a life estate. What happens to the property in each case upon the owner's death?",
                hint="Consider who owns the future interest in each type of estate.",
                expected_concepts=["fee simple absolute", "life estate", "reversion", "remainder", "duration of interest"],
                difficulty=1,
            ),
            TutorQuestion(
                question="What is the difference between a joint tenancy and a tenancy in common? What is required to create a joint tenancy?",
                hint="Consider the right of survivorship and the four unities.",
                expected_concepts=["right of survivorship", "four unities", "time title interest possession", "severance", "equal shares"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the implied warranty of habitability in residential leases? Can a tenant waive this warranty?",
                hint="This warranty concerns the condition of rented property.",
                expected_concepts=["fit for human habitation", "landlord duty to repair", "public policy", "retaliatory eviction", "rent withholding"],
                difficulty=3,
            ),
            TutorQuestion(
                question="Explain the Rule Against Perpetuities. Give an example of an interest that violates it.",
                hint="This rule limits how long property can be controlled from the grave.",
                expected_concepts=["lives in being plus 21 years", "must vest or fail", "remoteness of vesting", "charitable exception", "wait-and-see approach"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is a covenant running with the land? What requirements must be met for a covenant to bind successors?",
                hint="Covenants that run with the land impose obligations on future owners.",
                expected_concepts=["vertical privity", "horizontal privity", "touch and concern the land", "intent to run", "notice to successor"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is the difference between an easement and a license? How is an easement created?",
                hint="One is a property interest; the other is merely a personal permission.",
                expected_concepts=["easement appurtenant", "easement in gross", "express grant", "prescription", "necessity", "implication"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What are the duties that a landlord owes to a tenant under the implied warranty of habitability? What remedies does a tenant have if the warranty is breached?",
                hint="This warranty ensures rented property is fit for basic human living.",
                expected_concepts=["fit premises", "essential facilities", "repair and deduct", "rent abatement", "constructive eviction", "retaliatory eviction"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the difference between a present possessory estate and a future interest? Name three types of future interests.",
                hint="Future interests give a right to possession at a later time.",
                expected_concepts=["reversion", "remainder", "executory interest", "vested vs contingent", "right of entry"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the doctrine of waste in property law? When can a life tenant be liable for waste?",
                hint="Waste protects the interests of future interest holders against current possessors.",
                expected_concepts=["voluntary waste", "permissive waste", "ameliorative waste", "life tenant duties", "reasonable use"],
                difficulty=3,
            ),
        ],
    },
    "civil_procedure": {
        "name": "Civil Procedure",
        "description": "Jurisdiction, pleadings, discovery, motions, and trial procedure in civil cases.",
        "questions": [
            TutorQuestion(
                question="What is the difference between subject matter jurisdiction and personal jurisdiction?",
                hint="One concerns the court's power over the type of case; the other concerns power over the parties.",
                expected_concepts=["subject matter jurisdiction", "personal jurisdiction", "federal question", "diversity jurisdiction", "minimum contacts"],
                difficulty=1,
            ),
            TutorQuestion(
                question="What is the minimum contacts test established in International Shoe Co. v. Washington?",
                hint="This test determines when a court can exercise personal jurisdiction over an out-of-state defendant.",
                expected_concepts=["minimum contacts", "fair play and substantial justice", "purposeful availment", "relatedness of claim to contacts", "traditional notions of fair play"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is required for a federal court to have diversity jurisdiction under 28 U.S.C. Section 1332?",
                hint="Consider both the citizenship of the parties and the amount in controversy.",
                expected_concepts=["complete diversity", "amount in controversy exceeds $75,000", "citizenship of parties", "domicile for individuals", "principal place of business for corporations"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the difference between a motion to dismiss for failure to state a claim (Rule 12(b)(6)) and a motion for summary judgment (Rule 56)?",
                hint="One tests the legal sufficiency of the pleadings; the other tests whether there are factual disputes.",
                expected_concepts=["plausibility standard", "Twombly/Iqbal", "no genuine dispute of material fact", "evidence outside pleadings", "judgment as a matter of law"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the Erie doctrine and when does it require a federal court to apply state law?",
                hint="This doctrine governs which law federal courts apply in diversity cases.",
                expected_concepts=["Erie v. Tompkins", "substantive vs procedural", "outcome-determinative test", "Federal Rules of Civil Procedure", "horizontal choice of law"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is the scope of discovery under Rule 26? How has it changed with the 2015 amendments?",
                hint="Discovery allows parties to obtain information from each other before trial.",
                expected_concepts=["proportionality", "relevant to a claim or defense", "privileged information", "ESI discovery", "contention interrogatories"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is claim preclusion (res judicata) and what elements must be shown to apply it?",
                hint="Claim preclusion bars relitigation of claims that were or could have been brought.",
                expected_concepts=["final judgment on the merits", "same parties or privies", "same cause of action", "transactional test", "merger and bar"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is issue preclusion (collateral estoppel) and how does it differ from claim preclusion?",
                hint="Issue preclusion bars relitigation of specific issues, not entire claims.",
                expected_concepts=["actually litigated", "actually decided", "essential to judgment", "mutuality vs non-mutuality", "defensive vs offensive"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is the standard for summary judgment under Rule 56? What must the moving party show?",
                hint="Summary judgment is appropriate when there are no genuine factual disputes.",
                expected_concepts=["no genuine dispute of material fact", "entitled to judgment as a matter of law", "burden shifting", "draw inferences in non-movant's favor", "Celotex trilogy"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is supplemental jurisdiction under 28 U.S.C. Section 1367 and when may a court decline to exercise it?",
                hint="Supplemental jurisdiction allows federal courts to hear additional claims arising from the same case.",
                expected_concepts=["same case or controversy", "common nucleus of operative fact", "pendent and ancillary jurisdiction", "novel or complex state issue", "predominate over federal claims"],
                difficulty=3,
            ),
        ],
    },
    "business_orgs": {
        "name": "Business Organizations",
        "description": "Corporations, LLCs, partnerships, agency law, and fiduciary duties.",
        "questions": [
            TutorQuestion(
                question="What are the key differences between a sole proprietorship, a partnership, and a corporation?",
                hint="Consider liability, taxation, and management structure.",
                expected_concepts=["personal liability vs limited liability", "pass-through taxation vs double taxation", "formation requirements", "management and control", "continuity of existence"],
                difficulty=1,
            ),
            TutorQuestion(
                question="What fiduciary duties do corporate directors and officers owe to the corporation?",
                hint="These duties govern how directors and officers must act in their corporate roles.",
                expected_concepts=["duty of care", "duty of loyalty", "business judgment rule", "good faith", "conflicts of interest"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the business judgment rule and when does it protect directors from liability?",
                hint="This rule provides a shield for director decision-making.",
                expected_concepts=["presumption of good faith", "informed decision", "rational business purpose", "no self-dealing", "procedural due care"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is veil piercing and what must a plaintiff show to pierce the corporate veil?",
                hint="This doctrine allows creditors to reach shareholders' personal assets.",
                expected_concepts=["alter ego theory", "undercapitalization", "failure to observe corporate formalities", "fraud or injustice", "commingling of assets"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What are the fiduciary duties a general partner owes to other partners in a partnership?",
                hint="Partnerships are governed by both statutory and common law duties.",
                expected_concepts=["duty of loyalty", "duty of care", "duty to disclose", "no competition with partnership", "accounting for profits"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the difference between a corporation and an LLC in terms of taxation, management, and flexibility?",
                hint="These two business forms differ in structure, formality, and tax treatment.",
                expected_concepts=["pass-through taxation", "double taxation", "operating agreement vs bylaws", "member-managed vs director-managed", "formalities required"],
                difficulty=2,
            ),
            TutorQuestion(
                question="What is the duty of care owed by corporate directors? How does the business judgment rule protect them?",
                hint="Directors must act with a certain level of diligence in overseeing corporate affairs.",
                expected_concepts=["reasonable care", "informed decision-making", "good faith", "no gross negligence", "ordinary prudence standard"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is the difference between actual authority, apparent authority, and inherent authority in agency law?",
                hint="Authority determines whether a principal is bound by an agent's actions.",
                expected_concepts=["express actual authority", "implied actual authority", "apparent authority", "ratification", "estoppel"],
                difficulty=3,
            ),
            TutorQuestion(
                question="What is a derivative lawsuit and what procedural hurdles must a shareholder meet to bring one?",
                hint="Derivative suits allow shareholders to sue on behalf of the corporation.",
                expected_concepts=["demand requirement", "demand futility", "contemporaneous ownership", "adequate representation", "special litigation committee"],
                difficulty=4,
            ),
            TutorQuestion(
                question="What is the difference between a merger and an asset sale? What rights do shareholders have in each?",
                hint="Corporate combinations can be structured differently with different voting and appraisal rights.",
                expected_concepts=["statutory merger", "asset purchase", "appraisal rights", "shareholder vote required", "successor liability"],
                difficulty=3,
            ),
        ],
    },
}


class TutorSession:
    def __init__(self, topic_id: str):
        self.topic_id = topic_id
        self.topic_data = TOPICS.get(topic_id)
        self.questions = list(self.topic_data["questions"])
        self.current_index = 0
        self.correct_count = 0
        self.wrong_count = 0
        self.attempts_on_question = 0
        self.history: list[dict] = []


class TutorService:
    def __init__(self):
        self._sessions: dict[int, TutorSession] = {}

    def get_topics(self) -> list[dict]:
        return [
            {"id": tid, "name": t["name"], "description": t["description"], "question_count": len(t["questions"])}
            for tid, t in TOPICS.items()
        ]

    def start_session(self, topic_id: str, user_id: int) -> TutorStartResponse:
        if topic_id not in TOPICS:
            raise ValueError(f"Unknown topic: {topic_id}")
        session = TutorSession(topic_id)
        self._sessions[user_id] = session
        q = session.questions[0]
        return TutorStartResponse(
            topic_id=topic_id,
            topic_name=session.topic_data["name"],
            topic_description=session.topic_data["description"],
            total_questions=len(session.questions),
            current_question=q,
            current_index=0,
            questions=session.questions,
        )

    def submit_answer(self, answer: str, user_id: int) -> TutorAnswerResponse:
        session = self._sessions.get(user_id)
        if not session:
            raise ValueError("No active tutoring session. Start one first.")

        q = session.questions[session.current_index]
        session.attempts_on_question += 1

        attempts_exceeded = False
        correct_answer_revealed = None
        eval_result = None

        if re.search(r"^(i don'?t know|no idea|not sure|i have no|i'm not sure|i dunno|i don'?t understand|i don'?t have any)", answer.strip().lower()):
            eval_result = GeneratedEvaluation(
                evaluation="incorrect",
                explanation="It's okay not to know — that's what learning is for. Take a moment to review the hint below, then try answering the question again.",
                follow_up_question=q.question,
                follow_up_hint=q.hint,
                is_complete=False,
            )

        system_prompt = """You are a law school tutor using the Socratic method. Evaluate the student's answer and provide constructive feedback.

For each answer:
1. EVALUATION: Classify as "correct", "partially_correct", or "incorrect"
2. EXPLANATION: Explain what the student got right and what they missed. Reference the expected concepts.
3. FOLLOW-UP: If the student needs more help, generate a simpler follow-up question on the same topic. If they answered well, generate a more advanced follow-up.
4. COMPLETE: Set to true only when the student has demonstrated sufficient understanding of the current concept.

Guidelines:
- Be encouraging but academically rigorous
- Use the Socratic method — ask probing questions rather than just lecturing
- If the answer is wrong, break the concept down and ask a simpler version
- If the answer is correct, build on it with a deeper question
- Never fabricate legal rules or citations
- If the student admits they don't know or says "no idea", always classify as "incorrect" — do not treat it as correct"""

        user_prompt = f"""Topic: {session.topic_data['name']}
Question: {q.question}
Expected concepts: {', '.join(q.expected_concepts)}
Student's answer: {answer}

Evaluate this answer and provide a follow-up or determine if the student has mastered this concept."""

        if eval_result is None:
            try:
                response = completion(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format=GeneratedEvaluation,
                    max_tokens=2000,
                    temperature=0.3,
                )

                raw = response.choices[0].message.content
                if raw is None:
                    raw = getattr(response.choices[0].message, "reasoning_content", None) or ""
                parsed = parse_llm_json(raw)
                eval_result = GeneratedEvaluation(**parsed)

            except Exception as e:
                logger.error(f"Tutor LLM call failed: {e}")
                eval_result = GeneratedEvaluation(
                    evaluation="incorrect",
                    explanation="I couldn't evaluate your answer. Let's try a different approach.",
                    follow_up_question=None,
                    follow_up_hint=None,
                    is_complete=False,
                )

        if session.attempts_on_question >= 5 and eval_result.evaluation != "correct":
            attempts_exceeded = True
            eval_result.is_complete = True
            eval_result.follow_up_question = None
            concepts = q.expected_concepts
            if len(concepts) == 1:
                correct_answer_revealed = f"The expected concept was: {concepts[0]}."
            else:
                formatted = "; ".join(f"{i+1}. {c}" for i, c in enumerate(concepts))
                correct_answer_revealed = f"The expected concepts were: {formatted}."
            eval_result.explanation += (
                "  You've used all " + str(session.attempts_on_question) +
                " attempts for this question. The correct answer has been shown above. Let's move to the next question."
            )

        if eval_result.evaluation == "correct":
            session.correct_count += 1
        else:
            session.wrong_count += 1

        session.history.append({
            "question": q.question,
            "answer": answer,
            "evaluation": eval_result.evaluation,
            "explanation": eval_result.explanation,
        })

        next_question = None
        if eval_result.is_complete:
            session.current_index += 1
            session.attempts_on_question = 0
            if session.current_index < len(session.questions):
                nq = session.questions[session.current_index]
                next_question = TutorQuestion(
                    question=nq.question,
                    hint=nq.hint,
                    expected_concepts=nq.expected_concepts,
                    difficulty=nq.difficulty,
                )
        elif eval_result.follow_up_question:
            next_question = TutorQuestion(
                question=eval_result.follow_up_question,
                hint=eval_result.follow_up_hint or q.hint,
                expected_concepts=q.expected_concepts,
                difficulty=q.difficulty + 1,
            )
        else:
            session.current_index += 1
            session.attempts_on_question = 0
            if session.current_index < len(session.questions):
                nq = session.questions[session.current_index]
                next_question = TutorQuestion(
                    question=nq.question,
                    hint=nq.hint,
                    expected_concepts=nq.expected_concepts,
                    difficulty=nq.difficulty,
                )

        is_session_complete = session.current_index >= len(session.questions)

        if is_session_complete:
            total = len(session.questions)
            logger.info(f"User {user_id} completed topic '{session.topic_data['name']}' "
                        f"({session.correct_count}/{total} correct)")

        return TutorAnswerResponse(
            evaluation=eval_result.evaluation,
            explanation=eval_result.explanation,
            follow_up_question=next_question,
            current_index=session.current_index,
            total_questions=len(session.questions),
            is_complete=is_session_complete,
            correct_count=session.correct_count,
            wrong_count=session.wrong_count,
            attempts_exceeded=attempts_exceeded,
            correct_answer_revealed=correct_answer_revealed,
        )

    def get_session_state(self, user_id: int) -> Optional[dict]:
        session = self._sessions.get(user_id)
        if not session:
            return None
        return {
            "topic_id": session.topic_id,
            "topic_name": session.topic_data["name"],
            "current_index": session.current_index,
            "total_questions": len(session.questions),
            "correct_count": session.correct_count,
            "wrong_count": session.wrong_count,
        }


tutor_service = TutorService()


def get_tutor_service() -> TutorService:
    return tutor_service
