import React, { useState } from 'react';
import {Mail, Search, CheckCircle, XCircle,AlertCircle, Loader2, Copy,Download, ChevronDown, ChevronUp} from 'lucide-react';
import './Dashboard.css';
import { Link, useLocation } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lead-tool.onrender.com';

export default function EmailFinderChecker() {
  const [finderInput, setFinderInput] = useState({
    firstName: '',
    domain: '',
  });
  const [finderResults, setFinderResults] = useState([]);
  const [checkerResults, setCheckerResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();

    const getTabFromPath = () => {
      if (location.pathname === '/email-verification') return 'checker';
      return 'finder';
    };

    const [activeTab, setActiveTab] = useState(getTabFromPath());

    useEffect(() => {
      setActiveTab(getTabFromPath());
    }, [location.pathname]);


  const [sessionId, setSessionId] = useState(
  () => localStorage.getItem('sessionId') || null
  );

  const startSession = async () => {
  const res = await fetch('/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset(),
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    }),
  });

  const data = await res.json();
  localStorage.setItem('sessionId', data.sessionId);
  setSessionId(data.sessionId);

  return data.sessionId;
};

useEffect(() => {
  const endSession = () => {
    const sid = localStorage.getItem('sessionId');
    if (!sid) return;

    navigator.sendBeacon(
      `${API_BASE_URL}/api/session/end`,
      JSON.stringify({ sessionId: sid })
    );
  };

  window.addEventListener('beforeunload', endSession);
  return () => window.removeEventListener('beforeunload', endSession);
}, []);



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
    
     // 🔥 ADD THIS BLOCK
    let activeSessionId = sessionId;
    if (!activeSessionId) {
    activeSessionId = await startSession();
  }

    try {
      const fingerprintId = localStorage.getItem('fingerprintId');
      const response = await fetch(`${API_BASE_URL}/api/find-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          domain: domain.trim(),
          fingerprintId
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
      'Email,Status,Confidence,Reasons\n' +
      results.map((r) => `${r.email},${r.status},${r.confidence}%,${(r.reasons || []).join('; ')}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleRowExpansion = (idx) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedRows(newExpanded);
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
  Accurate Email Finder & Verifier for <span className='span-color'>Healthcare Outreach</span>
</h1>
      </div>


      <div className="email-dashboard">
        <div className="email-dashboard__card">
          <header className="email-header">
            <div className="email-header__icon">
              <Mail size={18} />
            </div>
            <div>
              <h1 className="email-header__title">Email Finder &amp; Verifier Tool</h1>
              <p className="email-header__subtitle">
                Instantly find and verify business email addresses for sales, marketing, and outreach.</p>

            </div>
          </header>


          <div className="email-tabs">
  <Link
    to="/email-finder"
    className={'email-tab' + (activeTab === 'finder' ? ' email-tab--active' : '')}
  >
    <Search size={16} />
    Finder
  </Link>

  <Link
    to="/email-verification"
    className={'email-tab' + (activeTab === 'checker' ? ' email-tab--active' : '')}
  >
    <CheckCircle size={16} />
    Checker
  </Link>
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
                      <label>First Name</label>
                      <input
                        type="text"
                        value={finderInput.firstName}
                        onChange={(e) =>
                          setFinderInput({ ...finderInput, firstName: e.target.value })
                        }
                        placeholder="John"
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
                  {activeResults.map((result, idx) => {
                    const isExpanded = expandedRows.has(idx);
                    const hasDetails = result.reasons && result.reasons.length > 0 || result.checks;
                    return (
                      <div className="result-row" key={idx}>
                        <div className="result-row-main">
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
                            {hasDetails && (
                              <button
                                className="icon-btn"
                                onClick={() => toggleRowExpansion(idx)}
                                title="Show details"
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                            <button
                              className="icon-btn"
                              onClick={() => copyToClipboard(result.email)}
                              title="Copy email"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                        {isExpanded && hasDetails && (
                          <div className="result-details">
                            {result.reasons && result.reasons.length > 0 && (
                              <div className="result-details-section">
                                <strong>Verification Details:</strong>
                                <ul className="result-reasons">
                                  {result.reasons.map((reason, rIdx) => (
                                    <li key={rIdx}>{reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {result.checks && (
                              <div className="result-details-section">
                                <strong>Checks Performed:</strong>
                                <div className="result-checks">
                                  <span className={`check-badge ${result.checks.syntax ? 'check-pass' : 'check-fail'}`}>
                                    Syntax {result.checks.syntax ? '✓' : '✗'}
                                  </span>
                                  <span className={`check-badge ${result.checks.domain ? 'check-pass' : 'check-fail'}`}>
                                    Domain {result.checks.domain ? '✓' : '✗'}
                                  </span>
                                  <span className={`check-badge ${result.checks.mxRecords ? 'check-pass' : 'check-fail'}`}>
                                    MX Records {result.checks.mxRecords ? '✓' : '✗'}
                                  </span>
                                  {result.checks.smtp !== null && (
                                    <span className={`check-badge ${result.checks.smtp === true ? 'check-pass' : result.checks.smtp === false ? 'check-fail' : 'check-warn'}`}>
                                      SMTP {result.checks.smtp === true ? '✓' : result.checks.smtp === false ? '✗' : '?'}
                                    </span>
                                  )}
                                  {result.checks.disposable && (
                                    <span className="check-badge check-warn">
                                      Disposable ⚠
                                    </span>
                                  )}
                                  {result.checks.role && (
                                    <span className="check-badge check-info">
                                      Role-based ℹ
                                    </span>
                                  )}
                                  {result.checks.catchAll === true && (
                                    <span className="check-badge check-warn">
                                      Catch-all ⚠
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

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
