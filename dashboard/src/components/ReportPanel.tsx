import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ResearchNode } from '../types';
import { NotebookPreview } from './NotebookPreview';

interface Props {
  node: ResearchNode | null;
}

type Tab = 'report' | 'notebooks';

export function ReportPanel({ node }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('report');
  const [reportContent, setReportContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!node) {
      setReportContent('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/files/${encodeURIComponent(node.folderPath + '/report.md')}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setReportContent(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load report');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [node?.folderPath]);

  // Reset to report tab when node changes
  useEffect(() => {
    setActiveTab('report');
  }, [node?.id]);

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Select a research node to view details
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
        <button
          onClick={() => setActiveTab('report')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'report'
              ? 'text-zinc-100 border-b-2 border-teal-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Report
        </button>
        <button
          onClick={() => setActiveTab('notebooks')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'notebooks'
              ? 'text-zinc-100 border-b-2 border-teal-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Notebooks
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'report' && (
          <div className="p-4">
            {loading && (
              <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
                Loading report...
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center py-8 text-red-400 text-sm">
                {error}
              </div>
            )}
            {!loading && !error && reportContent && (
              <div className="otterwise-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reportContent}
                </ReactMarkdown>
              </div>
            )}
            {!loading && !error && !reportContent && (
              <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
                No report content available
              </div>
            )}
          </div>
        )}

        {activeTab === 'notebooks' && <NotebookPreview node={node} />}
      </div>

      {/* Markdown styles for dark theme */}
      <style>{`
        .otterwise-markdown h1 {
          color: rgb(244 244 245);
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
          margin-top: 1.5rem;
          line-height: 1.3;
        }
        .otterwise-markdown h2 {
          color: rgb(244 244 245);
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          margin-top: 1.25rem;
          line-height: 1.3;
        }
        .otterwise-markdown h3 {
          color: rgb(244 244 245);
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          margin-top: 1rem;
        }
        .otterwise-markdown h4,
        .otterwise-markdown h5,
        .otterwise-markdown h6 {
          color: rgb(228 228 231);
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          margin-top: 0.75rem;
        }
        .otterwise-markdown p {
          color: rgb(212 212 216);
          margin-bottom: 0.75rem;
          line-height: 1.6;
        }
        .otterwise-markdown a {
          color: rgb(20 184 166);
          text-decoration: underline;
        }
        .otterwise-markdown a:hover {
          color: rgb(94 234 212);
        }
        .otterwise-markdown code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          background-color: rgb(39 39 42);
          padding: 0.15em 0.4em;
          border-radius: 0.25rem;
          color: rgb(228 228 231);
        }
        .otterwise-markdown pre {
          background-color: rgb(39 39 42);
          border-radius: 0.375rem;
          padding: 1rem;
          overflow-x: auto;
          margin-bottom: 0.75rem;
        }
        .otterwise-markdown pre code {
          background: none;
          padding: 0;
          font-size: 0.8rem;
          line-height: 1.5;
        }
        .otterwise-markdown ul {
          color: rgb(212 212 216);
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .otterwise-markdown ol {
          color: rgb(212 212 216);
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .otterwise-markdown li {
          margin-bottom: 0.25rem;
          line-height: 1.6;
        }
        .otterwise-markdown blockquote {
          border-left: 3px solid rgb(63 63 70);
          padding-left: 1rem;
          color: rgb(161 161 170);
          margin-bottom: 0.75rem;
        }
        .otterwise-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0.75rem;
        }
        .otterwise-markdown th {
          background-color: rgb(39 39 42);
          color: rgb(228 228 231);
          font-weight: 600;
          text-align: left;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(63 63 70);
          font-size: 0.85rem;
        }
        .otterwise-markdown td {
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(63 63 70);
          color: rgb(212 212 216);
          font-size: 0.85rem;
        }
        .otterwise-markdown tr:nth-child(even) {
          background-color: rgb(39 39 42 / 0.5);
        }
        .otterwise-markdown hr {
          border-color: rgb(63 63 70);
          margin: 1rem 0;
        }
        .otterwise-markdown img {
          max-width: 100%;
          border-radius: 0.375rem;
        }

        /* Notebook HTML output (pandas tables, etc.) */
        .notebook-html-output table {
          width: 100%;
          border-collapse: collapse;
        }
        .notebook-html-output th {
          background-color: rgb(39 39 42);
          color: rgb(228 228 231);
          font-weight: 600;
          text-align: left;
          padding: 0.375rem 0.5rem;
          border: 1px solid rgb(63 63 70);
        }
        .notebook-html-output td {
          padding: 0.375rem 0.5rem;
          border: 1px solid rgb(63 63 70);
          color: rgb(212 212 216);
        }
        .notebook-html-output tr:nth-child(even) {
          background-color: rgb(39 39 42 / 0.5);
        }
      `}</style>
    </div>
  );
}
