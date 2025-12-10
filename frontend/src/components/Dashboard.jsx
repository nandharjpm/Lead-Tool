import React, { useState } from 'react';
import {
  Mail,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Copy,
  Download,
} from 'lucide-react';
import './Dashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lead-tool.onrender.com';

export default function EmailFinderChecker() {
  const [activeTab, setActiveTab] = useState('finder');
  const [finderInput, setFinderInput] = useState({
    firstName: '',
    domain: '',
  });
  const [finderResults, setFinderResults] = useState([]);
  const [checkerResults, setCheckerResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [error, setError] = useState('');

  const validateEmailFormat = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleFindEmails = async () => {
    const { firstName, domain } = finderInput;
    setError('');

    if (!firstName || !domain) {
      setError('Please fill in all fields before searching.');
      return;
    }

    setLoading(true);
    setFinderResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/find-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          domain: domain.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.reason === 'smtp_unavailable') {
          setError('SMTP server unavailable. Port 25 may be blocked. Please check your network settings.');
        } else {
          setError(data.message || 'Failed to find emails. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (data.success && data.results) {
        setFinderResults(data.results);
      } else {
        setError('No results found or invalid response.');
      }
    } catch (err) {
      console.error('Error finding emails:', err);
      setError('Failed to connect to server. Make sure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEmails = async () => {
    setError('');
    const emails = bulkEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (!emails.length) {
      setError('Please enter at least one email to verify.');
      return;
    }

    // Validate email formats
    const invalidEmails = emails.filter(email => !validateEmailFormat(email));
    if (invalidEmails.length > 0) {
      setError(`Invalid email format(s): ${invalidEmails.join(', ')}`);
      return;
    }

    setLoading(true);
    setCheckerResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/check-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: emails,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.reason === 'smtp_unavailable') {
          setError('SMTP server unavailable. Port 25 may be blocked. Please check your network settings.');
        } else {
          setError(data.message || 'Failed to check emails. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (data.success && data.results) {
        setCheckerResults(data.results);
      } else {
        setError('No results found or invalid response.');
      }
    } catch (err) {
      console.error('Error checking emails:', err);
      setError('Failed to connect to server. Make sure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
  };

  const downloadResults = (results) => {
    if (!results.length) return;
    const csv =
      'Email,Status,Confidence\n' +
      results.map((r) => `${r.email},${r.status},${r.confidence}%`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const activeResults = activeTab === 'finder' ? finderResults : checkerResults;

  const getStatusClass = (status) => {
    if (status === 'valid') return 'pill pill-valid';
    if (status === 'invalid') return 'pill pill-invalid';
    if (status === 'risky') return 'pill pill-risky';
    return 'pill';
  };

  const getStatusIcon = (status) => {
    if (status === 'valid') return <CheckCircle size={14} />;
    if (status === 'invalid') return <XCircle size={14} />;
    if (status === 'risky') return <AlertCircle size={14} />;
    return null;
  };

  const summary = activeResults.reduce(
    (acc, r) => {
      acc.total++;
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { total: 0, valid: 0, risky: 0, invalid: 0 }
  );

  return (

    <div className="top-content">
      <div className="header-section">

        <h1 className="header-large-heading">
         Accurate email discovery for your 
         <span className='span-color'> Healthcare </span>
         outreach.
        </h1>
      </div>


      <div className="email-dashboard">
        <div className="email-dashboard__card">
          <header className="email-header">
            <div className="email-header__icon">
              <Mail size={18} />
            </div>
            <div>
              <h1 className="email-header__title">Email Finder &amp; Checker</h1>
              <p className="email-header__subtitle">
                Find patterns &amp; validate email addresses in seconds.
              </p>
            </div>
          </header>


          <div className="email-tabs">
            <button
              className={'email-tab' + (activeTab === 'finder' ? ' email-tab--active' : '')}
              onClick={() => { setActiveTab('finder'); setError('') }} >
              <Search size={16} />
              Finder
            </button>
            <button
              className={'email-tab' + (activeTab === 'checker' ? ' email-tab--active' : '')}
              onClick={() => { setActiveTab('checker'); setError('') }}>
              <CheckCircle size={16} />
              Checker
            </button>
          </div>

          {error && (
            <div className="email-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'finder' ? (
            <>
              <div className="finder-inline">
                <div className="fg">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={`${finderInput.firstName}`.trim()}
                    onChange={(e) => {
                      const [firstName, ...rest] = e.target.value.split(" ");
                      setFinderInput({ ...finderInput, firstName});
                    }}
                    placeholder="John Doe"
                  />
                </div>

                <div className="fg">
                  <label>Company Domain</label>
                  <input
                    type="text"
                    value={finderInput.domain}
                    onChange={(e) =>
                      setFinderInput({ ...finderInput, domain: e.target.value })
                    }
                    placeholder="company.com"
                  />
                </div>

                <button
                  className="btn-find"
                  onClick={handleFindEmails}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Finding…
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      Find
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="checker-inline">
                <div className="checker-block">
                  <label>Email Address</label>
                  <input
                    type="text"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    placeholder="john@company.com"
                    className="checker-input"
                  />
                </div>

                <button
                  className="btn-primary" onClick={handleCheckEmails} disabled={loading} >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Checking…
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Verify
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* results */}
          {(finderResults.length > 0 || checkerResults.length > 0) && (
            <section className="results-section">
              <div className="results-summary">
                <div className="summary-card">
                  <span className="summary-label">Total: </span>
                  <span className="summary-value">{summary.total}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Valid: </span>
                  <span className="summary-value summary-value--valid">
                    {summary.valid}
                  </span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Risky: </span>
                  <span className="summary-value summary-value--risky">
                    {summary.risky}
                  </span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Invalid: </span>
                  <span className="summary-value summary-value--invalid">
                    {summary.invalid}
                  </span>
                </div>
              </div>

              <div className="results-card">
                <div className="results-header">
                  <div>
                    <div className="results-title">Results</div>
                    <div className="results-subtitle">
                      {activeTab === 'finder' ? 'Finder' : 'Checker'} ·{' '}
                      {activeResults.length} rows
                    </div>
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => downloadResults(activeResults)}
                    disabled={!activeResults.length}
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                </div>

                <div className="results-list">
                  {activeResults.map((result, idx) => (
                    <div className="result-row" key={idx}>
                      <div className="result-main">
                        <div className="result-email" title={result.email}>
                          {result.email}
                        </div>
                        <div className="result-meta">
                          Confidence:{' '}
                          <span className="result-meta-strong">
                            {result.confidence}%
                          </span>
                        </div>
                      </div>
                      <div className="result-actions">
                        <span className={getStatusClass(result.status)}>
                          {getStatusIcon(result.status)}
                          <span>{result.status}</span>
                        </span>
                        <button
                          className="icon-btn"
                          onClick={() => copyToClipboard(result.email)}
                          title="Copy email"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {!activeResults.length && (
                    <div className="results-empty">
                      No results yet. Run a search to see suggestions.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
