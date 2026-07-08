const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Document {
  id: number;
  user_id: number;
  title: string;
  content: string | null;
  doc_type: string | null;
  file_path: string | null;
  original_filename: string | null;
  file_size: number | null;
  file_type: string | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    signal,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || 'An error occurred');
  }

  return response.json();
}

export const api = {
  auth: {
    signup: (email: string, password: string) =>
      fetchApi<User>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    signin: (email: string, password: string) =>
      fetchApi<{ message: string; email: string; id: number }>('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    signout: () =>
      fetchApi<{ message: string }>('/api/auth/signout', {
        method: 'POST',
      }),
    me: () => fetchApi<User>('/api/auth/me'),
  },

  documents: {
    list: () => fetchApi<Document[]>('/api/documents'),
    get: (id: number) => fetchApi<Document>(`/api/documents/${id}`),
    create: (title: string, content?: string, docType?: string) =>
      fetchApi<Document>('/api/documents', {
        method: 'POST',
        body: JSON.stringify({ title, content, doc_type: docType }),
      }),
    update: (id: number, data: { title?: string; content?: string; doc_type?: string }) =>
      fetchApi<Document>(`/api/documents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchApi<{ message: string }>(`/api/documents/${id}`, {
        method: 'DELETE',
      }),
    upload: async (file: File, title?: string, docType?: string) => {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      if (docType) formData.append('doc_type', docType);
      const response = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(error.detail || 'Upload failed');
      }
      return response.json() as Promise<Document>;
    },
  },

  chat: {
    greeting: () => fetchApi<{ greeting: string }>('/api/chat/greeting'),
    message: (message: string, history?: { role: string; content: string }[], signal?: AbortSignal) =>
      fetchApi<ChatMessageResponse>('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({ message, history: history || [] }),
      }, signal),
    async *stream(message: string, history: { role: string; content: string }[] = [], signal?: AbortSignal): AsyncGenerator<StreamEvent> {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
        signal,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
        throw new Error(error.detail || 'An error occurred');
      }
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            yield JSON.parse(part.slice(6)) as StreamEvent;
          }
        }
      }
    },
  },

  legal: {
    caseBrief: (query: string, documentId?: number, signal?: AbortSignal) =>
      fetchApi<CaseBriefResponse>('/api/legal/case-brief', {
        method: 'POST',
        body: JSON.stringify({ query, document_id: documentId }),
      }, signal),
    summary: (query: string, summaryType?: string, documentId?: number, signal?: AbortSignal) =>
      fetchApi<LegalSummaryResponse>('/api/legal/summary', {
        method: 'POST',
        body: JSON.stringify({ query, summary_type: summaryType || 'general', document_id: documentId }),
      }, signal),
    arguments: (query: string, documentId?: number, signal?: AbortSignal) =>
      fetchApi<ArgumentExtractionResponse>('/api/legal/arguments', {
        method: 'POST',
        body: JSON.stringify({ query, document_id: documentId }),
      }, signal),
    citations: (query: string, documentId?: number, signal?: AbortSignal) =>
      fetchApi<CitationMapResponse>('/api/legal/citations', {
        method: 'POST',
        body: JSON.stringify({ query, document_id: documentId }),
      }, signal),
    templateFields: (templateName: string) =>
      fetchApi<{ template_name: string; fields: TemplateField[] }>(`/api/legal/template-fields?template_name=${encodeURIComponent(templateName)}`),
    generateDocument: (templateName: string, fieldValues: Record<string, string>, title?: string) =>
      fetchApi<GenerateDocumentResponse>('/api/legal/generate-document', {
        method: 'POST',
        body: JSON.stringify({ template_name: templateName, field_values: fieldValues, title }),
      }),
    memorandum: (query: string, documentId?: number, signal?: AbortSignal) =>
      fetchApi<MemorandumResponse>('/api/legal/memorandum', {
        method: 'POST',
        body: JSON.stringify({ query, document_id: documentId }),
      }, signal),
    debate: (query: string, documentId?: number, signal?: AbortSignal) =>
      fetchApi<DebateResponse>('/api/legal/debate', {
        method: 'POST',
        body: JSON.stringify({ query, document_id: documentId }),
      }, signal),
    glossary: (query: string, documentId?: number) =>
      fetchApi<GlossaryResponse>('/api/legal/glossary', {
        method: 'POST',
        body: JSON.stringify({ query, document_id: documentId }),
      }),
  },

  tutor: {
    listTopics: () =>
      fetchApi<{ topics: TutorTopic[] }>('/api/tutor/topics'),
    startSession: (topicId: string) =>
      fetchApi<TutorStartResponse>('/api/tutor/start', {
        method: 'POST',
        body: JSON.stringify({ topic_id: topicId }),
      }),
    submitAnswer: (answer: string) =>
      fetchApi<TutorAnswerResponse>('/api/tutor/answer', {
        method: 'POST',
        body: JSON.stringify({ answer }),
      }),
    continueLearning: () =>
      fetchApi<{ question: TutorQuestion; disclaimer: string }>('/api/tutor/continue-learning', {
        method: 'POST',
      }),
    startDynamicSession: (topicId: string) =>
      fetchApi<TutorStartResponse>('/api/tutor/start-dynamic', {
        method: 'POST',
        body: JSON.stringify({ topic_id: topicId }),
      }),
  },

  templates: {
    list: () => fetchApi<CatalogResponse>('/api/templates'),
  },

  health: () => fetchApi<{ status: string; service: string }>('/api/health'),
};

export interface CitedAuthority {
  name: string;
  citation: string | null;
  type: string;
  context: string;
  treatment: string;
}

export interface CitationMapResponse {
  case_name: string;
  cases_cited: CitedAuthority[];
  statutes_cited: CitedAuthority[];
  constitutional_provisions: CitedAuthority[];
  total_citations: number;
  key_precedent: string;
  sources: SourceDocument[];
  disclaimer: string;
}

export interface Argument {
  party: string;
  argument: string;
  reasoning: string;
  authorities: string[];
  court_resolution: string;
}

export interface ArgumentExtractionResponse {
  case_name: string;
  petitioner: string;
  respondent: string;
  petitioner_arguments: Argument[];
  respondent_arguments: Argument[];
  counterarguments_considered: string[];
  key_doctrines_statutes: string[];
  winning_party: string;
  rationale: string;
  sources: SourceDocument[];
  disclaimer: string;
}

export interface LegalSummaryResponse {
  title: string;
  summary_type: string;
  overview: string;
  key_findings: string[];
  legal_principles: string[];
  impact: string;
  key_points: string[];
  sources_consulted: string[];
  sources: SourceDocument[];
  disclaimer: string;
}

export interface CaseBriefResponse {
  case_name: string;
  citation: string[];
  court: string;
  date_filed: string;
  facts: string;
  procedural_history: string;
  issues: string[];
  holding: string;
  reasoning: string;
  rule_of_law: string;
  concurrence: string | null;
  dissent: string | null;
  significance: string;
  sources: SourceDocument[];
  disclaimer: string;
}

export interface TemplateField {
  name: string;
  category: string;
  hint: string;
}

export interface CatalogTemplate {
  name: string;
  description: string;
  filename: string;
  fields: TemplateField[];
  cover_page_fields?: TemplateField[];
}

export interface CatalogResponse {
  templates: CatalogTemplate[];
}

export interface GenerateDocumentResponse {
  id: number;
  title: string;
  content: string;
  doc_type: string;
}

export interface LegalIssue {
  issue: string;
  rule: string;
  application: string;
  conclusion: string;
}

export interface MemorandumResponse {
  to: string;
  author: string;
  date: string;
  re: string;
  question_presented: string;
  brief_answer: string;
  facts: string;
  issues: LegalIssue[];
  overall_conclusion: string;
  sources: SourceDocument[];
  disclaimer: string;
}

export interface SourceDocument {
  title: string;
  source_type: string;
  url?: string | null;
  citation?: string | null;
  court?: string | null;
  date_filed?: string | null;
  relevance_score?: number | null;
}

export interface SourceInfo {
  title: string;
  source: string;
  relevance_score: number;
}

export interface ChatMessageResponse {
  response: string;
  sources: SourceInfo[];
  source_docs: SourceDocument[];
  retrieval_count: number;
  suggested_tool: string | null;
  suggested_name: string | null;
  suggested_description: string | null;
  suggested_query: string | null;
}

export type StreamEvent =
  | { type: 'meta'; sources: SourceInfo[]; source_docs?: SourceDocument[]; retrieval_count: number; suggested_tool: string | null; suggested_name: string | null; suggested_description: string | null; suggested_query: string | null }
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; text: string };

export interface DebateArgument {
  side: string;
  title: string;
  argument: string;
  reasoning: string;
  authorities: string[];
  strength: string;
  counter_rebuttal: string | null;
}

export interface DebateResponse {
  topic: string;
  user_position: string;
  supporting_arguments: DebateArgument[];
  opposing_arguments: DebateArgument[];
  key_doctrines_statutes: string[];
  predicted_winner: string;
  rationale: string;
  practice_tips: string[];
  sources: SourceDocument[];
  disclaimer: string;
}

export interface GlossaryResponse {
  term: string;
  definition: string;
  etymology: string | null;
  jurisdiction: string | null;
  usage_example: string;
  related_terms: string[];
  also_known_as: string | null;
  practice_tips: string | null;
  citations: string[];
  from_seed: boolean;
  sources: SourceDocument[];
  disclaimer: string;
}

export interface TutorTopic {
  id: string;
  name: string;
  description: string;
  question_count: number;
}

export interface TutorQuestion {
  question: string;
  hint: string;
  expected_concepts: string[];
  difficulty: number;
}

export interface TutorStartResponse {
  topic_id: string;
  topic_name: string;
  topic_description: string;
  total_questions: number;
  current_question: TutorQuestion;
  current_index: number;
  questions: TutorQuestion[];
}

export interface TutorAnswerResponse {
  evaluation: string;
  explanation: string;
  follow_up_question: TutorQuestion | null;
  current_index: number;
  total_questions: number;
  is_complete: boolean;
  correct_count: number;
  wrong_count: number;
  attempts_exceeded: boolean;
  correct_answer_revealed: string | null;
  disclaimer: string;
}