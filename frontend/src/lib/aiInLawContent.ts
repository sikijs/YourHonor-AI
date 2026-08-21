export interface AiSection {
  id: string;
  title: string;
  paragraphs: string[];
  subsections?: AiSection[];
}

export const AI_IN_LAW: AiSection[] = [
  {
    id: "intro",
    title: "Understanding AI in Law",
    paragraphs: [
      "Artificial Intelligence is rapidly changing the legal profession. To use it responsibly, lawyers must first understand what AI actually is, and what it is not.",
      "Many people use terms like Artificial Intelligence, Machine Learning, and Generative AI interchangeably, but they are not the same thing.",
    ],
  },
  {
    id: "ai",
    title: "Artificial Intelligence (AI)",
    paragraphs: [
      "Artificial Intelligence is the broad concept of machines performing tasks that normally require human intelligence. These tasks include understanding language, recognizing patterns, making predictions, analyzing documents, and solving problems.",
      "AI is not 'thinking' like a human being. It does not possess consciousness, emotions, or true understanding. Instead, AI systems process enormous amounts of data and identify statistical patterns that allow them to produce useful outputs.",
      'Think of AI as a highly advanced analytical tool — powerful, fast, but still dependent on human supervision.',
    ],
    subsections: [
      {
        id: "ai-uses",
        title: "What AI Can Do in Law",
        paragraphs: [
          "In law, AI can assist with: searching legal databases, reviewing and writing contracts, writing and editing legal briefs, identifying patterns in litigation, predicting legal outcomes, and organizing evidence in discovery.",
        ],
      },
    ],
  },
  {
    id: "ml",
    title: "Machine Learning (ML)",
    paragraphs: [
      'Machine Learning is a subset of AI. Traditional software follows fixed instructions: "If X happens, do Y." Machine Learning works differently. Instead of manually programming every rule, developers train the system using large amounts of data. The system then learns patterns from that data.',
      "The more high-quality data a machine learning system receives, the better its predictions usually become.",
      "However, machine learning systems are only as good as the data they are trained on. If the training data contains bias, errors, or incomplete information, the AI system may reproduce or even amplify those problems.",
      "This becomes critically important in law, where fairness and accuracy are essential.",
    ],
    subsections: [
      {
        id: "ml-examples",
        title: "Examples",
        paragraphs: [
          "A spam filter learns which emails are likely spam. A fraud detection system learns suspicious transaction patterns. A legal AI system learns relationships between cases, rulings, and legal arguments.",
        ],
      },
    ],
  },
  {
    id: "genai",
    title: "Generative AI",
    paragraphs: [
      'Generative AI is a newer branch of AI designed to create new content. Unlike earlier AI systems that mainly classified or predicted information, generative AI can produce written text, legal summaries, contracts, emails, images, and computer code. Systems like ChatGPT are examples of generative AI.',
      "Generative AI does not 'know' facts the way humans do. Instead, it predicts the most statistically likely next word or sequence of words based on patterns learned from massive amounts of training data.",
      "At a conceptual level, it works like an extremely advanced autocomplete system — predicting entire paragraphs and arguments rather than just the next word.",
      "This predictive process is based on probabilities rather than understanding. That distinction matters enormously in legal practice.",
    ],
  },
  {
    id: "training",
    title: "Training Data and Probabilities",
    paragraphs: [
      "AI systems are trained using enormous datasets collected from books, websites, legal documents, articles, court opinions, and many other sources.",
      "During training, the AI learns patterns such as which words commonly appear together, how legal arguments are structured, relationships between legal concepts, and citation formats.",
      "When you ask an AI a question, it does not 'search its memory' like a human lawyer. Instead, it calculates probabilities about what response is most likely appropriate based on patterns in its training data.",
      "This is why AI can sound extremely confident even when it is wrong. The system is designed to produce fluent and convincing language — not guaranteed truth.",
    ],
  },
  {
    id: "hallucinations",
    title: "AI Hallucinations",
    paragraphs: [
      "One of the most important risks in legal AI is the phenomenon known as hallucination. A hallucination occurs when an AI system generates false or fabricated information while presenting it as factual.",
      "Examples include inventing court cases, creating fake legal citations, misstating holdings, fabricating quotations, and combining real cases with imaginary facts.",
      "This is not 'lying' in the human sense. The AI is not intentionally deceptive. It is generating language based on statistical probability, and sometimes the prediction is incorrect.",
      "Several attorneys have already faced sanctions after submitting AI-generated fake citations to courts without verification.",
      "AI can assist legal reasoning, but it cannot replace professional responsibility.",
    ],
  },
  {
    id: "practice",
    title: "AI in Legal Practice Today",
    paragraphs: [
      "AI is already deeply integrated into modern legal work. Many legal professionals now use AI-enhanced platforms such as Westlaw and LexisNexis to accelerate research and analyze case law.",
      "These systems can summarize cases, suggest relevant precedents, identify legal trends, recommend authorities, and predict how judges may respond to arguments.",
      "Tasks that once required many billable hours can sometimes now be completed in minutes.",
    ],
    subsections: [
      {
        id: "contract-review",
        title: "Contract Review Automation",
        paragraphs: [
          "Instead of manually reading hundreds of pages line by line, AI tools can detect unusual clauses, identify missing provisions, flag inconsistencies, compare contracts against standard templates, and highlight risk areas.",
          "For example, an AI tool reviewing a merger agreement might identify non-standard indemnification language, missing arbitration clauses, or unusual termination provisions. This dramatically improves efficiency, especially in large corporate transactions.",
          "However, lawyers must still review the output carefully because AI may miss context, nuance, or strategic implications.",
        ],
      },
      {
        id: "ediscovery",
        title: "E-Discovery",
        paragraphs: [
          "Modern lawsuits may involve millions of emails, text messages, internal memos, cloud documents, and digital communications.",
          "AI-powered e-discovery systems help lawyers search massive datasets, identify relevant evidence, detect suspicious communication patterns, and prioritize important documents.",
          "Without AI assistance, reviewing modern digital evidence manually would often be impossible due to cost and time constraints.",
        ],
      },
      {
        id: "predictive",
        title: "Predictive Analytics in Litigation",
        paragraphs: [
          "Some AI systems analyze historical rulings, judicial behavior, settlement patterns, types of claims, and jury tendencies to predict litigation outcomes.",
          "Law firms may use these systems to estimate likelihood of success, settlement ranges, expected duration of litigation, and judicial tendencies.",
          "These tools raise important questions: Can justice truly be predicted statistically? Do such systems reinforce historical biases? Could lawyers become overly dependent on algorithmic recommendations?",
        ],
      },
    ],
  },
  {
    id: "predictive-analytics",
    title: "Predictive Analytics",
    paragraphs: [
      "Predictive analytics uses historical data — past rulings, judge behavior, settlement patterns, claim statistics, and jury tendencies — to estimate the likely outcome of a case before it is decided. It does not predict with certainty; it calculates probabilities based on how similar matters have resolved in the past.",
      "In the legal system, law firms use these tools to advise clients on whether to settle, what a fair settlement range might be, how long litigation may take, and which arguments a particular judge tends to find persuasive. Courts and governments use them too: risk-assessment systems such as COMPAS analyze a defendant's background to estimate the likelihood of reoffending, informing decisions about bail, sentencing, and parole.",
      "Predictive analytics works well with large, stable bodies of data — insurance disputes, routine contracts, traffic offenses — where patterns are statistically meaningful. It is far less reliable for novel legal questions, first-impression issues, or cases driven by unique human facts.",
      "Critics raise serious concerns. The models are only as good as their training data: if that data reflects historic bias, the predictions may reproduce it. Some systems are 'black boxes' whose reasoning cannot be fully explained, which conflicts with legal values of transparency and due process. And a probability is not a verdict — a judge or jury must still weigh the case on its own facts.",
      "For students, predictive analytics is worth understanding because it is reshaping practice: associates increasingly use it for case strategy, budgeting, and settlement recommendations. The skill is not running the tool — it is knowing when the prediction is trustworthy and when it must be challenged.",
    ],
  },
  {
    id: "reasoning-graphs",
    title: "Legal Reasoning Graphs",
    paragraphs: [
      "A legal reasoning graph is a visual map of how authorities connect. Cases are represented as nodes, and the links between them are relationships: case A cites case B, case C overrules case D, this doctrine derives from that line of cases, this argument responds to that counterargument. The result is a picture of an argument's or a doctrine's full lineage, instead of a flat list of citations.",
      "In practice, this is the idea behind the citation maps used in legal research platforms such as Westlaw and LexisNexis. When a lawyer 'Shepardizes' a case, they trace the web of later decisions that cite, distinguish, or overrule it — effectively walking a reasoning graph to confirm a case is still good law and to find how courts have treated it.",
      "Reasoning graphs are also used to teach and analyze doctrine. A graph can show how a principle evolved — for example, how the right to counsel developed from Betts v. Brady to Gideon v. Wainwright — or how one holding such as Roe v. Wade was later limited and overruled by Dobbs v. Jackson. In litigation, lawyers build informal graphs of their own: every claim supported by premises, every premise supported by authorities, and every authority open to attack.",
      "The limits are important. A graph shows relationships that already exist in the data; it does not create new arguments or tell you which line of cases will persuade a court. Links can mislead if the data is incomplete or if similar-sounding cases are conflated. And legal reasoning is more than structure — the weight of authority, policy considerations, and the facts of the case are not captured in a node and an edge.",
      "For students, reasoning graphs are a study aid as much as a tool: mapping a doctrine by hand forces you to see which cases are load-bearing, which are peripheral, and which have been quietly undermined. The Doctrine Explorer in this app is a small example — 36 doctrines traced across 92 landmark cases.",
    ],
  },
  {
    id: "courts",
    title: "AI in Courts",
    paragraphs: [
      "AI is not only used by lawyers — it is increasingly used inside court systems themselves. One well-known example is COMPAS, a risk assessment tool used in some criminal justice systems to predict the likelihood that a defendant may reoffend.",
      "Judges may use such assessments during sentencing, bail determinations, and parole decisions. Supporters argue these systems improve consistency and efficiency.",
      "Critics argue they may reinforce racial or socioeconomic bias, lack transparency, use flawed data, or violate due process rights.",
      'One major concern is the "black box" problem: sometimes even the developers cannot fully explain how complex AI systems reach their conclusions. This creates a serious tension with legal principles requiring transparency, fairness, and accountability.',
    ],
  },
  {
    id: "ethics",
    title: "Ethical and Professional Responsibility",
    paragraphs: [
      "Lawyers cannot delegate professional responsibility to machines. Under the American Bar Association Model Rules, attorneys have a duty of competence. Increasingly, courts and bar associations interpret this duty to include technological competence.",
      "In practical terms, lawyers must understand what AI tools can do, their limitations, their risks, and how to verify AI-generated work.",
      "Using AI without understanding it may itself become an ethical problem.",
    ],
    subsections: [
      {
        id: "confidentiality",
        title: "Confidentiality Risks",
        paragraphs: [
          "Many AI systems operate through cloud-based services. Uploading confidential client information into public AI tools may create privacy risks, data retention concerns, potential waiver issues, and security vulnerabilities.",
          "Lawyers must carefully review terms of service, data usage policies, confidentiality protections, and firm policies regarding AI use. Failing to do so could violate duties owed to clients.",
        ],
      },
      {
        id: "fake-citations",
        title: "Fake Citations and Professional Misconduct",
        paragraphs: [
          "Several highly publicized court cases involved attorneys submitting briefs containing completely fabricated AI-generated citations. The cited cases did not exist, the quotations were imaginary, and the legal holdings were invented.",
          "Courts responded with sanctions, fines, and reputational damage. The lesson is simple but critical: Never trust AI output without independent verification.",
          "AI can draft. AI can summarize. AI can accelerate work. But the lawyer remains responsible for every filing submitted to a court.",
        ],
      },
    ],
  },
  {
    id: "future",
    title: "The Future of AI in Law",
    paragraphs: [
      "AI will almost certainly reshape the legal profession. Some routine legal tasks may become heavily automated: basic document review, simple contract drafting, initial legal research, and administrative work.",
      "However, effective lawyers do far more than process information. Good lawyers exercise judgment, understand human behavior, negotiate strategically, persuade juries, build trust with clients, interpret ambiguous facts, and make ethical decisions.",
      "These human skills remain extremely difficult to automate.",
      'The future is therefore unlikely to be "AI replacing all lawyers." More realistically: lawyers who understand AI may replace lawyers who do not.',
    ],
  },
  {
    id: "careers",
    title: "New Legal Careers Emerging",
    paragraphs: [
      "AI is already creating entirely new legal roles, including legal technologists, AI compliance attorneys, AI governance specialists, algorithm auditors, privacy and cybersecurity counsel, and AI policy advisors.",
      "Governments around the world are also beginning to regulate AI systems, creating growing demand for lawyers who understand both law and technology.",
    ],
  },
  {
    id: "benefits",
    title: "Benefits of AI in Law",
    paragraphs: [
      "AI offers major advantages when used properly:",
      "Speed — Research that once required days may now take minutes.",
      "Cost Reduction — Automation can reduce expenses for clients and law firms.",
      "Greater Access to Justice — AI tools may help provide affordable legal assistance to people who cannot traditionally afford attorneys.",
      "Pattern Recognition — AI can identify trends and relationships across enormous datasets that humans could never analyze efficiently alone.",
    ],
  },
  {
    id: "risks",
    title: "Risks and Limitations",
    paragraphs: [
      "Despite its power, AI also introduces serious risks:",
      "Hallucinations — AI may generate completely false information.",
      "Bias — If training data contains bias, AI outputs may reproduce discrimination or unfair outcomes.",
      "Lack of Accountability — When automated systems make mistakes, determining responsibility can become difficult.",
      "Over-Reliance — Inexperienced lawyers may trust AI output too readily without independent analysis. This is especially dangerous in legal practice, where small errors can have life-changing consequences.",
    ],
  },
  {
    id: "final-thought",
    title: "Final Thought",
    paragraphs: [
      "AI is neither magic nor evil. It is a tool. Like any powerful tool, it can be used intelligently, irresponsibly, ethically, or carelessly.",
      "The lawyers who succeed in the coming decades will not be those who blindly reject AI, nor those who blindly trust it. They will be the professionals who understand how AI works, where it fails, when to rely on it, when to challenge it, and why human judgment still matters.",
      "\u201cIf you graduate without understanding AI, you\u2019ll be outdated. If you trust it blindly, you\u2019ll be dangerous.\u201d",
    ],
  },
];
