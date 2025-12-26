import React, { useState, useEffect } from 'react';
import {Mail, Search, CheckCircle, XCircle,AlertCircle, Loader2, Copy,Download} from 'lucide-react';
import './Dashboard.css';
import { Link, useLocation } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lead-tool.onrender.com';

export default function EmailFinderChecker() {
  const [finderInput, setFinderInput] = useState({
    fullName: '', firstName: '', lastName: '', domain: '',
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
  const res = await fetch(`${API_BASE_URL}/api/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset(),
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    }),
  });
  if (!res.ok) {
    // Try to provide a helpful error but don't crash the caller
    console.error('Failed to start session:', res.status, res.statusText);
    return null;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    console.error('Failed to parse session start response:', err);
    return null;
  }

  if (data && data.sessionId) {
    localStorage.setItem('sessionId', data.sessionId);
    setSessionId(data.sessionId);
    return data.sessionId;
  }

  return null;
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
    const { firstName, lastName, fullName, domain } = finderInput;
    setError('');

    if (!fullName || !domain) {
      setError('Please enter a full name and domain before searching.');
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
      const response = await fetch(`${API_BASE_URL}/api/find-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // send fullName and parsed parts; backend will parse first/last name from fullName
          fullName: fullName ? fullName.trim() : `${firstName.trim()} ${lastName ? lastName.trim() : ''}`.trim(),
          firstName: firstName ? firstName.trim() : '',
          lastName: lastName ? lastName.trim() : '',
          domain: domain.trim(),
          sessionId: activeSessionId,
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
                      <label>Full Name</label>
                      <input
                        type="text"
                        value={finderInput.fullName}
                        onChange={(e) => {
                          const value = e.target.value;

                            const [firstName, ...lastNameParts] = value.trim().split(/\s+/);

                            setFinderInput((prev) => ({
                              ...prev,
                              fullName: value,
                              firstName: firstName || '',
                              lastName: lastNameParts.join(' ') || '',
                            }));
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
