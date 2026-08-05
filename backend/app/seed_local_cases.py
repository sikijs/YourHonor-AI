import logging

from app.services.ingestion import get_ingestion_service

logger = logging.getLogger(__name__)

LOCAL_CASES = [
    {
        "name": "Marbury v. Madison (1803)",
        "citation": "5 U.S. 137",
        "content": """Marbury v. Madison, 5 U.S. 137 (1803) - FOUNDATIONAL CASE FOR JUDICIAL REVIEW

PRINCIPLE: The Supreme Court has the power to review acts of Congress and declare them unconstitutional if they conflict with the Constitution.

FACTS: William Marbury was appointed as a justice of the peace by President John Adams in the final days of his administration. His commission was not delivered before Jefferson took office. Jefferson's Secretary of State, James Madison, refused to deliver the commission.

HOLDING: The Court held that: 1. Marbury had a right to his commission 2. Madison wrongfully refused to deliver it 3. BUT: The Supreme Court did not have jurisdiction to issue the writ of mandamus

REASONING: The Judiciary Act of 1789 gave the Supreme Court original jurisdiction to issue writs of mandamus, but this was unconstitutional because Article III limits Supreme Court original jurisdiction to cases affecting ambassadors and those in which a state shall be a party.

KEY PRINCIPLE: When a law conflicts with the Constitution, the Constitution must prevail. The judiciary has the power to say what the law is.""",

        "metadata": {
            "doc_type": "case_law",
            "category": "landmark_case",
            "citation": "5 U.S. 137",
            "year": 1803,
        },
    },
    {
        "name": "Miranda v. Arizona (1966)",
        "citation": "384 U.S. 436",
        "content": """Miranda v. Arizona, 384 U.S. 436 (1966) - RIGHT TO REMAIN SILENT

PRINCIPLE: Police must inform criminal suspects of their constitutional rights before custodial interrogation.

FACTS: Ernesto Miranda was arrested for kidnapping and rape. After two hours of police interrogation, he signed a written confession. He was never told he had the right to remain silent or to have an attorney present.

HOLDING: The Fifth Amendment privilege against self-incrimination requires law enforcement to advise suspects of their rights before custodial interrogation.

REASONING: Custodial interrogation is inherently coercive. Without proper warnings, any confession obtained is presumed to be compelled and therefore inadmissible.

RULE: Police must inform suspects of: 1) right to remain silent, 2) anything said can be used against them in court, 3) right to an attorney, 4) right to appointed counsel if they cannot afford one.""",

        "metadata": {
            "doc_type": "case_law",
            "category": "landmark_case",
            "citation": "384 U.S. 436",
            "year": 1966,
        },
    },
    {
        "name": "Brown v. Board of Education (1954)",
        "citation": "347 U.S. 483",
        "content": """Brown v. Board of Education, 347 U.S. 483 (1954) - SCHOOL DESEGREGATION

PRINCIPLE: Racial segregation in public schools violates the Equal Protection Clause of the Fourteenth Amendment.

FACTS: African American children were denied admission to public schools attended by white children under laws requiring or permitting racial segregation. The plaintiffs sought admission to segregated schools.

HOLDING: Separate educational facilities are inherently unequal. Segregation in public education deprives minority children of equal educational opportunities.

REASONING: Education is the most important function of state and local governments. Segregation generates a feeling of inferiority in minority children that may affect their hearts and minds in ways unlikely ever to be undone. Even if tangible factors are equal, segregation psychologically harms minority children.

SIGNIFICANCE: Overturned the 'separate but equal' doctrine established in Plessy v. Ferguson (1896).""",

        "metadata": {
            "doc_type": "case_law",
            "category": "landmark_case",
            "citation": "347 U.S. 483",
            "year": 1954,
        },
    },
    {
        "name": "Gideon v. Wainwright (1963)",
        "citation": "372 U.S. 335",
        "content": """Gideon v. Wainwright, 372 U.S. 335 (1963) - RIGHT TO COUNSEL

PRINCIPLE: The Sixth Amendment right to counsel applies to state criminal defendants through the Fourteenth Amendment Due Process Clause.

FACTS: Clarence Earl Gideon was charged with breaking and entering in Florida. He could not afford a lawyer and requested that the court appoint one. The court denied his request because Florida law only provided counsel for capital offenses.

HOLDING: The Sixth Amendment's guarantee of counsel is a fundamental right essential to a fair trial, made applicable to the states through the Fourteenth Amendment Due Process Clause.

REASONING: Lawyers in criminal court are necessities, not luxuries. The right to counsel is fundamental and essential for a fair trial. Any person haled into court who is too poor to hire a lawyer cannot be assured a fair trial unless counsel is provided.

SIGNIFICANCE: Overruled Betts v. Brady (1942). Established the right to appointed counsel for all indigent criminal defendants facing serious charges.""",

        "metadata": {
            "doc_type": "case_law",
            "category": "landmark_case",
            "citation": "372 U.S. 335",
            "year": 1963,
        },
    },
    {
        "name": "Roe v. Wade (1973)",
        "citation": "410 U.S. 113",
        "content": """Roe v. Wade, 410 U.S. 113 (1973) - CONSTITUTIONAL RIGHT TO PRIVACY AND ABORTION

PRINCIPLE: The constitutional right to privacy encompasses a woman's right to choose to have an abortion, subject to state regulation in the second and third trimesters.

FACTS: Jane Roe (pseudonym) filed a class action challenging Texas laws that criminalized abortion except to save the mother's life. She sought a declaratory judgment that the laws were unconstitutional.

HOLDING: The Fourteenth Amendment Due Process Clause protects a woman's qualified right to terminate her pregnancy against state interference, balanced against state interests in maternal health and potential life.

REASONING: The Constitution does not explicitly mention a right to privacy, but the Court has recognized that a guarantee of personal privacy exists under the Due Process Clause and other constitutional provisions. This right to privacy is broad enough to encompass a woman's decision whether or not to terminate her pregnancy.

TRIMESTER FRAMEWORK: First trimester — decision left to woman and her physician. Second trimester — states may regulate to protect maternal health. Third trimester — states may regulate or prohibit except when necessary to save the mother's life.

SIGNIFICANCE: Established constitutional abortion rights that stood for nearly 50 years until Dobbs v. Jackson Women's Health Organization (2022).""",

        "metadata": {
            "doc_type": "case_law",
            "category": "landmark_case",
            "citation": "410 U.S. 113",
            "year": 1973,
        },
    },
]


def _already_in_qdrant(title: str) -> bool:
    from app.services.qdrant_store import point_exists, COLLECTION_NAME
    try:
        return point_exists(COLLECTION_NAME, {"title": title, "source": "public_domain"})
    except Exception:
        return False


def seed_local_cases():
    ingestion_service = get_ingestion_service()
    total = len(LOCAL_CASES)
    ingested = 0
    skipped = 0

    logger.info(f"Seeding {total} local landmark cases into Qdrant...")

    for i, case in enumerate(LOCAL_CASES, 1):
        if _already_in_qdrant(case["name"]):
            skipped += 1
            logger.info(f"  [{i}/{total}] {case['name']} — already seeded, skipping")
            continue
        try:
            ingestion_service.ingest_document(
                content=case["content"],
                title=case["name"],
                source="public_domain",
                metadata=case["metadata"],
            )
            ingested += 1
            logger.info(f"  [{i}/{total}] {case['name']} — seeded")
        except Exception as e:
            logger.warning(f"  [{i}/{total}] {case['name']} — error: {e}")

    logger.info(f"Seeding complete: {ingested}/{total} cases ingested ({skipped} already present)")
    return ingested


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_local_cases()
