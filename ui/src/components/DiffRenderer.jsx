import { useRef, useEffect, memo } from 'react';
import { html as diff2htmlHtml } from 'diff2html';
import hljs from 'highlight.js';
import 'diff2html/bundles/css/diff2html.min.css';

/**
 * Detect language from file extension in the diff header.
 */
function detectLang(diffString) {
  const match = diffString.match(/^diff --git a\/.+?\.(\w+)/m);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    kt: 'kotlin', swift: 'swift', m: 'objectivec', c: 'c', h: 'c',
    cpp: 'cpp', cs: 'csharp', php: 'php', sql: 'sql',
    html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml',
    css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
    md: 'markdown', sh: 'bash', bash: 'bash', zsh: 'bash',
    dockerfile: 'dockerfile', graphql: 'graphql', gql: 'graphql',
  };
  return map[ext] || null;
}

/**
 * Renders a unified diff with syntax highlighting.
 * Uses diff2html for structure, then highlights code content in-place
 * without breaking the table layout.
 */
function fixLineNumbers(container) {
  // Fix line-by-line mode line numbers (two divs in one cell)
  container.querySelectorAll('.d2h-code-linenumber').forEach((td) => {
    td.style.position = 'static';
    td.style.whiteSpace = 'nowrap';
    td.style.lineHeight = '1';
    const nums = td.querySelectorAll('.line-num1, .line-num2');
    nums.forEach((div) => {
      div.style.float = 'none';
      div.style.display = 'inline-block';
      div.style.width = '3em';
      div.style.textAlign = 'right';
      div.style.lineHeight = 'inherit';
    });
  });

  // Fix all sticky positioning
  container.querySelectorAll('.d2h-code-side-linenumber, .d2h-file-header').forEach((el) => {
    el.style.position = 'static';
  });
}

/**
 * Sync row heights between left and right side-by-side tables
 * so lines stay aligned.
 */
function syncSideBySideRows(container) {
  const sideDiffs = container.querySelectorAll('.d2h-file-side-diff');
  if (sideDiffs.length < 2) return;

  const leftRows = sideDiffs[0].querySelectorAll('tbody tr');
  const rightRows = sideDiffs[1].querySelectorAll('tbody tr');
  const count = Math.min(leftRows.length, rightRows.length);

  for (let i = 0; i < count; i++) {
    // Reset heights first
    leftRows[i].style.height = '';
    rightRows[i].style.height = '';

    const maxH = Math.max(leftRows[i].offsetHeight, rightRows[i].offsetHeight);
    leftRows[i].style.height = maxH + 'px';
    rightRows[i].style.height = maxH + 'px';
  }
}

function highlightCode(container, diffString) {
  const lang = detectLang(diffString);
  container.querySelectorAll('.d2h-code-line-ctn').forEach((el) => {
    const text = el.textContent || '';
    if (!text.trim()) return;
    try {
      let result;
      if (lang && hljs.getLanguage(lang)) {
        result = hljs.highlight(text, { language: lang, ignoreIllegals: true });
      } else {
        result = hljs.highlightAuto(text);
      }
      el.innerHTML = result.value;
    } catch {
      // leave unhighlighted
    }
  });
}

const DiffRenderer = memo(function DiffRenderer({ diffString, splitView = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !diffString) return;

    const outputFormat = splitView ? 'side-by-side' : 'line-by-line';

    const htmlStr = diff2htmlHtml(diffString, {
      outputFormat,
      drawFileList: false,
      matching: 'lines',
    });

    ref.current.innerHTML = htmlStr;
    fixLineNumbers(ref.current);
    highlightCode(ref.current, diffString);
    if (splitView) {
      // Wait for render then sync row heights
      requestAnimationFrame(() => {
        if (ref.current) syncSideBySideRows(ref.current);
      });
    }
  }, [diffString, splitView]);

  if (!diffString) return null;

  return <div ref={ref} className={splitView ? 'diff-split-view' : ''} />;
});

export default DiffRenderer;
