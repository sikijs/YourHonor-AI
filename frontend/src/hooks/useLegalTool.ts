'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, api } from '@/lib/api';

interface UseLegalToolResult<T> {
  query: string;
  setQuery: (q: string) => void;
  result: T | null;
  setResult: (r: T | null) => void;
  loading: boolean;
  saved: boolean;
  setSaved: (s: boolean) => void;
  copied: boolean;
  setCopied: (c: boolean) => void;
  documents: Document[];
  selectedDocId: number | undefined;
  setSelectedDocId: (id: number | undefined) => void;
  elapsed: number;
  handleSubmit: (e: React.FormEvent) => void;
  cancelRef: React.MutableRefObject<AbortController | null>;
  cancellingRef: React.MutableRefObject<boolean>;
  cancel: () => void;
}

export function useLegalTool<T>(
  apiCall: (query: string, documentId: number | undefined, signal: AbortSignal) => Promise<T>,
  onError: (err: string) => void,
): UseLegalToolResult<T> {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const cancelRef = useRef<AbortController | null>(null);
  const cancellingRef = useRef(false);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    cancellingRef.current = false;
    setLoading(true);
    setResult(null);
    setSaved(false);
    onError('');
    try {
      const res = await apiCall(query, selectedDocId, cancelRef.current.signal);
      setResult(res);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (!cancellingRef.current) onError('Request timed out. Legal analysis can take up to 3 minutes. Please try again.');
        return;
      }
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, loading, selectedDocId, apiCall, onError]);

  const cancel = useCallback(() => {
    cancellingRef.current = true;
    cancelRef.current?.abort();
    setLoading(false);
  }, []);

  return {
    query, setQuery,
    result, setResult,
    loading,
    saved, setSaved,
    copied, setCopied,
    documents,
    selectedDocId, setSelectedDocId,
    elapsed,
    handleSubmit,
    cancelRef, cancellingRef,
    cancel,
  };
}
