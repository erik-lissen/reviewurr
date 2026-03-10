import { useState, useCallback, useRef } from 'react';
import PRInput from './components/PRInput';
import RawDiffView from './components/RawDiffView';
import FlowView from './components/FlowView';
import FileTree from './components/FileTree';
import { fetchPRs, analyzeFlow, getStatus } from './api';
import './styles.css';

// Color palette for repos
const REPO_COLORS = [
  { bg: 'rgba(88, 166, 255, 0.15)', border: 'rgba(88, 166, 255, 0.4)', text: '#58a6ff' },
  { bg: 'rgba(63, 185, 80, 0.15)', border: 'rgba(63, 185, 80, 0.4)', text: '#3fb950' },
  { bg: 'rgba(210, 153, 34, 0.15)', border: 'rgba(210, 153, 34, 0.4)', text: '#d29922' },
  { bg: 'rgba(188, 140, 255, 0.15)', border: 'rgba(188, 140, 255, 0.4)', text: '#bc8cff' },
  { bg: 'rgba(248, 81, 73, 0.15)', border: 'rgba(248, 81, 73, 0.4)', text: '#f85149' },
  { bg: 'rgba(219, 171, 121, 0.15)', border: 'rgba(219, 171, 121, 0.4)', text: '#dbab79' },
  { bg: 'rgba(121, 192, 255, 0.15)', border: 'rgba(121, 192, 255, 0.4)', text: '#79c0ff' },
  { bg: 'rgba(255, 123, 114, 0.15)', border: 'rgba(255, 123, 114, 0.4)', text: '#ff7b72' },
];

function getRepoColor(repo, repoIndex) {
  return REPO_COLORS[repoIndex % REPO_COLORS.length];
}

export default function App() {
  const [prs, setPrs] = useState([]); // { url, repo, number }
  const [diffs, setDiffs] = useState([]); // { pr: { url, repo, number }, diff: string }
  const [activeTab, setActiveTab] = useState('raw');
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'info'|'error'|'loading', text: string }
  const [activeFile, setActiveFile] = useState(null);
  const [splitView, setSplitView] = useState(false);
  const contentRef = useRef(null);

  // Track unique repos for color assignment
  const repoList = [...new Set(prs.map((p) => p.repo))];
  const repoColorMap = Object.fromEntries(repoList.map((r, i) => [r, i]));

  const handleAddPRs = useCallback(async (newPrs) => {
    // Deduplicate
    const existing = new Set(prs.map((p) => p.url));
    const unique = newPrs.filter((p) => !existing.has(p.url));
    if (unique.length === 0) return;

    const updatedPrs = [...prs, ...unique];
    setPrs(updatedPrs);

    // Fetch diffs for new PRs
    setLoading(true);
    setStatus({ type: 'loading', text: `Fetching diffs for ${unique.length} PR(s)...` });

    try {
      const result = await fetchPRs(unique.map((p) => p.url));
      // Server returns diffs as { [url]: diffString }
      const diffsObj = result.diffs || {};
      const newDiffs = unique.map((pr) => ({
        pr: { url: pr.url, repo: pr.repo, number: pr.number },
        diff: diffsObj[pr.url] || '',
      }));
      setDiffs((prev) => [...prev, ...newDiffs]);
      setStatus({ type: 'info', text: `Loaded ${newDiffs.length} diff(s)` });
      setAnalysis(null);
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [prs]);

  const handleRemovePR = useCallback((url) => {
    setPrs((prev) => prev.filter((p) => p.url !== url));
    setDiffs((prev) => {
      const pr = prs.find((p) => p.url === url);
      if (!pr) return prev;
      return prev.filter((d) => !(d.pr.repo === pr.repo && d.pr.number === pr.number));
    });
    setAnalysis(null);
  }, [prs]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setStatus({ type: 'loading', text: 'Analyzing flow with Claude...' });

    try {
      await analyzeFlow(); // kicks off analysis on server
      // Poll for completion
      while (true) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await getStatus();
        if (st.status === 'idle' && st.analysis) {
          setAnalysis(st.analysis);
          setStatus({ type: 'info', text: `Flow analysis complete — ${st.analysis.chunks?.length || 0} chunks` });
          break;
        }
        if (st.status === 'idle' && st.error) {
          throw new Error(st.error);
        }
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleSelectFile = useCallback((filePath) => {
    setActiveFile(filePath);
    // If on raw diff tab, scroll to that file's section
    if (contentRef.current) {
      const id = `file-${filePath.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Auto-expand if collapsed
        const header = el.querySelector('.collapsible-header');
        const body = el.querySelector('.collapsible-body');
        if (body && body.classList.contains('collapsed')) {
          header?.click();
        }
      }
    }
  }, []);

  return (
    <div className="app-layout">
      <div className="top-bar">
        <h1>reviewurr</h1>
        <div className="view-toggle">
          <button
            className={!splitView ? 'active' : ''}
            onClick={() => setSplitView(false)}
          >
            Unified
          </button>
          <button
            className={splitView ? 'active' : ''}
            onClick={() => setSplitView(true)}
          >
            Split
          </button>
        </div>
      </div>

      <PRInput onAdd={handleAddPRs} disabled={loading} />

      {prs.length > 0 && (
        <div className="pr-input-area" style={{ paddingTop: 0, borderTop: 'none' }}>
          <div className="pr-pills">
            {prs.map((pr) => {
              const colorIdx = repoColorMap[pr.repo] ?? 0;
              const color = getRepoColor(pr.repo, colorIdx);
              return (
                <span
                  key={pr.url}
                  className="pr-pill"
                  style={{
                    background: color.bg,
                    borderColor: color.border,
                    color: color.text,
                  }}
                >
                  {pr.repo.split('/')[1]}#{pr.number}
                  <button onClick={() => handleRemovePR(pr.url)} title="Remove">
                    &times;
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {status && (
        <div className={`status-bar ${status.type === 'loading' ? 'loading' : ''} ${status.type === 'error' ? 'error' : ''}`}>
          <span className="dot" />
          {status.text}
        </div>
      )}

      <div className="tab-bar">
        <button
          className={activeTab === 'raw' ? 'active' : ''}
          onClick={() => setActiveTab('raw')}
        >
          Raw Diff
        </button>
        <button
          className={activeTab === 'flow' ? 'active' : ''}
          onClick={() => setActiveTab('flow')}
        >
          Flow View
        </button>
      </div>

      <div className="main-area">
        <div className="content" ref={contentRef}>
          {activeTab === 'raw' && <RawDiffView diffs={diffs} activeFile={activeFile} splitView={splitView} />}
          {activeTab === 'flow' && (
            <FlowView
              analysis={analysis}
              diffs={diffs}
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
              hasPRs={prs.length > 0}
              splitView={splitView}
            />
          )}
        </div>

        {diffs.length > 0 && (
          <FileTree
            diffs={diffs}
            activeFile={activeFile}
            onSelectFile={handleSelectFile}
          />
        )}
      </div>
    </div>
  );
}
