'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, SourceInfo, SourceDocument, api } from '@/lib/api';
import { markdownComponents } from '@/components/markdownComponents';
import SourcePanel from '@/components/SourcePanel';

export default function ChatView({ user, onError, onNavigate }: { user: User; onError: (err: string) => void; onNavigate: (v: string) => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; sources?: SourceInfo[]; source_docs?: SourceDocument[]; suggested_tool?: string | null; suggested_name?: string | null; suggested_description?: string | null; suggested_query?: string | null }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadGreeting();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function loadGreeting() {
    try {
      const { greeting } = await api.chat.greeting();
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || isStreaming) return;

    cancelRef.current = new AbortController();
    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content })).slice(-10);

      for await (const event of api.chat.stream(userMessage, history, cancelRef.current.signal)) {
        if (event.type === 'meta') {
          setLoading(false);
          setIsStreaming(true);
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: '',
            sources: event.sources,
            source_docs: event.source_docs,
            suggested_tool: event.suggested_tool,
            suggested_name: event.suggested_name,
            suggested_description: event.suggested_description,
            suggested_query: event.suggested_query,
          }]);
        } else if (event.type === 'chunk') {
          setMessages((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            last.content += event.text;
            next[next.length - 1] = last;
            return next;
          });
        } else if (event.type === 'error') {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: event.text };
            return next;
          });
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages((prev) => {
        const next = [...prev];
        if (next[next.length - 1]?.role === 'assistant' && next[next.length - 1]?.content === '') next.pop();
        return next;
      });
      onError(err.message);
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>AI Assistant</h2>
          <p style={{ color: 'var(--gray-text)', margin: '0.25rem 0 0' }}>
            Ask anything — legal research, case analysis, document drafting, or general questions. I draw from our knowledge base of cases, legal documents, and web search results.
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => { setMessages([]); loadGreeting(); }} style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
          New Chat
        </button>
      </div>
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`message ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {(msg.source_docs && msg.source_docs.length > 0) && (
                <SourcePanel sources={msg.source_docs} />
              )}
              {msg.suggested_tool && msg.suggested_name && (
                <div
                  className="card"
                  onClick={() => msg.suggested_tool && onNavigate(msg.suggested_tool)}
                  style={{ margin: '0.25rem 1rem 0.75rem', padding: '0.75rem', cursor: 'pointer', border: '1px solid var(--blue-primary)', borderLeft: '4px solid var(--blue-primary)' }}
                >
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-primary)', margin: '0 0 0.25rem' }}>
                    Try the {msg.suggested_name} tool &rarr;
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', margin: 0 }}>
                    {msg.suggested_description}
                  </p>
                  {msg.suggested_query && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--dark-navy)', margin: '0.25rem 0 0', fontStyle: 'italic' }}>
                      Suggested query: &ldquo;{msg.suggested_query}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="message assistant"><div className="spinner-container"><span className="spinner" /><em>Thinking...</em></div><div style={{ marginTop: '0.5rem', textAlign: 'center' }}><button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }} style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>Cancel</button></div></div>}
          {isStreaming && <div style={{ textAlign: 'center', marginTop: '0.25rem' }}><button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setIsStreaming(false); }} style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>Stop</button></div>}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input" onSubmit={handleSend}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={loading || isStreaming}
            rows={2}
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'none' }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || isStreaming || !input.trim()}>
            Send
          </button>
        </form>
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem', textAlign: 'center' }}>
          This AI assistant provides educational information only. Not legal advice.
        </p>
      </div>
    </div>
  );
}
