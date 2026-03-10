import { useState } from 'react';

const PR_URL_RE = /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)\/?$/;

function parsePRUrls(text) {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  const valid = [];
  const invalid = [];

  for (const part of parts) {
    const m = part.match(PR_URL_RE);
    if (m) {
      valid.push({ url: part, repo: m[1], number: parseInt(m[2], 10) });
    } else {
      invalid.push(part);
    }
  }

  return { valid, invalid };
}

export default function PRInput({ onAdd, disabled }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim()) return;

    const { valid, invalid } = parsePRUrls(value);

    if (invalid.length > 0) {
      setError(`Invalid PR URL(s): ${invalid.join(', ')}`);
      return;
    }

    if (valid.length === 0) {
      setError('No valid GitHub PR URLs found');
      return;
    }

    setError('');
    setValue('');
    onAdd(valid);
  }

  return (
    <div className="pr-input-area">
      <form className="pr-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          placeholder="Paste GitHub PR URLs..."
          disabled={disabled}
        />
        <button type="submit" className="btn btn-primary" disabled={disabled || !value.trim()}>
          Add PRs
        </button>
      </form>
      {error && <div className="input-error">{error}</div>}
    </div>
  );
}
