export interface AboutSection {
  id: string;
  title: string;
  paragraphs: (string | { heading: string; items: string[] })[];
}

export const ABOUT_SECTIONS: AboutSection[] = [
  {
    id: "intro",
    title: "About YourHonor AI",
    paragraphs: [
      "Hey there 👋",
      "YourHonor AI is a learning tool built for law students who want to understand legal concepts by actually working with them — not just reading about them.",
    ],
  },
  {
    id: "why",
    title: "Why This Exists",
    paragraphs: [
      "Law school teaches you to think like a lawyer. But the way we practice law is changing fast, and AI is becoming a big part of that. This platform is here to help you get comfortable with AI-assisted legal work before you graduate — so you're not playing catch-up later.",
      "Everything here is built around one simple idea: you learn best by doing.",
    ],
  },
  {
    id: "how",
    title: "How It Works (No Jargon, Promise)",
    paragraphs: [
      "When you ask a question or use a tool, here's what happens behind the scenes:",
      {
        heading: "",
        items: [
          "We search through a library of legal sources — landmark cases, statutes, templates, and educational content",
          "We find the parts that are most relevant to what you're asking about",
          "An AI assistant puts together a response based on those sources, with citations so you can verify everything yourself",
        ],
      },
      "The result? Answers that are grounded in real legal material, not just AI guessing.",
    ],
  },
  {
    id: "tools",
    title: "What You Can Do Here",
    paragraphs: [
      {
        heading: "Case Briefs",
        items: [
          "Get structured briefs with facts, issues, holdings, and reasoning",
        ],
      },
      {
        heading: "Summaries",
        items: [
          "Break down complex legal topics into digestible takeaways",
        ],
      },
      {
        heading: "Arguments",
        items: [
          "Pull out and organize legal arguments from any source material",
        ],
      },
      {
        heading: "Citations",
        items: [
          "See how cases relate to each other and how courts have treated them",
        ],
      },
      {
        heading: "Memoranda",
        items: [
          "Draft IRAC-style legal memos on any question",
        ],
      },
      {
        heading: "Debate Analysis",
        items: [
          "Explore both sides of a legal argument with counterpoints",
        ],
      },
      {
        heading: "Legal Glossary",
        items: [
          "Look up 120+ legal terms with plain-English definitions and examples",
        ],
      },
      {
        heading: "AI Tutor",
        items: [
          "Learn through conversation with an AI that adapts to your answers — plus flashcard review mode!",
        ],
      },
      {
        heading: "Document Generator",
        items: [
          "Create legal documents from 24 ready-made templates",
        ],
      },
      {
        heading: "AI Chat",
        items: [
          "Ask anything and get pointed to the right tool or a sourced answer",
        ],
      },
    ],
  },
  {
    id: "beliefs",
    title: "A Few Things We Believe",
    paragraphs: [
      "Learning should be hands-on. You don't become a lawyer by watching YouTube.",
      "Sources matter. Every response should be traceable back to something real.",
      "AI is a tool, not a replacement. It helps you work faster and smarter, but you're still the one in charge.",
      "It's okay to not know. That's literally why you're here.",
    ],
  },
  {
    id: "disclaimer",
    title: "One Last Thing",
    paragraphs: [
      "This is educational software. It's designed to help you learn — not to give legal advice, draft real filings, or replace your textbooks. Always double-check AI-generated content against primary sources. Your professors will thank you.",
    ],
  },
];
