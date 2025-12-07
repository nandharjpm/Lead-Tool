import React, { useState } from 'react';
import { Mail, Search, CheckCircle, XCircle, AlertCircle, Loader2, Copy, Download } from 'lucide-react';

export default function EmailFinderChecker() {
  const [activeTab, setActiveTab] = useState('finder');
  const [finderInput, setFinderInput] = useState({ firstName: '', lastName: '', domain: '' });
  const [finderResults, setFinderResults] = useState([]);
  const [checkerResults, setCheckerResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [error, setError] = useState('');

  // Handle finding emails via backend API
  const handleFindEmails = async () => {
    const { firstName, lastName, domain } = finderInput;
    
    if (!firstName || !lastName || !domain) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setFinderResults([]);

    try {
      const response = await fetch('http://localhost:5000/api/find-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          fullName: `${firstName} ${lastName}`,
          domain 
        }),
      });

      const data = await response.json();

      if (data.success && data.results && data.results.length > 0) {
        const formattedResults = data.results.map(result => ({
          email: result.email,
          status: result.score > 0.7 ? 'valid' : result.score > 0.4 ? 'risky' : 'invalid',
          confidence: Math.round(result.score * 100)
        }));
        setFinderResults(formattedResults);
      } else {
        setError('No email addresses found. Try different names or domains.');
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure backend is running on port 5000.');
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle checking emails via backend API
  const handleCheckEmails = async () => {
    const emails = bulkEmails
      .split('\n')
      .map(e => e.trim())
      .filter(e => e);

    if (emails.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    setLoading(true);
    setError('');
    setCheckerResults([]);

    try {
      const response = await fetch('http://localhost:5000/api/verify-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      });

      const data = await response.json();

      if (data.success && data.results) {
        const formattedResults = data.results.map(result => ({
          email: result.email,
          status: result.valid ? 'valid' : 'invalid',
          confidence: result.confidence || (result.valid ? 85 : 20)
        }));
        setCheckerResults(formattedResults);
      } else {
        setError('Failed to verify emails. Please try again.');
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure backend is running on port 5000.');
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const downloadResults = (results) => {
    const csv = 'Email,Status,Confidence\n' + 
      results.map(r => `${r.email},${r.status},${r.confidence}%`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'valid': return 'text-green-600';
      case 'invalid': return 'text-red-600';
      case 'risky': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'valid': return <CheckCircle className="w-5 h-5" />;
      case 'invalid': return <XCircle className="w-5 h-5" />;
      case 'risky': return <AlertCircle className="w-5 h-5" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center mb-4">
            <Mail className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Email Finder & Checker</h1>
          <p className="text-gray-600">Find and verify email addresses instantly</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex border-b mb-6">
            <button
              onClick={() => setActiveTab('finder')}
              className={`flex-1 py-3 px-4 font-semibold transition-colors ${
                activeTab === 'finder'
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Search className="w-5 h-5 inline mr-2" />
              Email Finder
            </button>
            <button
              onClick={() => setActiveTab('checker')}
              className={`flex-1 py-3 px-4 font-semibold transition-colors ${
                activeTab === 'checker'
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircle className="w-5 h-5 inline mr-2" />
              Email Checker
            </button>
          </div>

          {/* Email Finder Tab */}
          {activeTab === 'finder' && (
            <div>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={finderInput.firstName}
                    onChange={(e) => setFinderInput({...finderInput, firstName: e.target.value})}
                    placeholder="John"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={finderInput.lastName}
                    onChange={(e) => setFinderInput({...finderInput, lastName: e.target.value})}
                    placeholder="Doe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
                  <input
                    type="text"
                    value={finderInput.domain}
                    onChange={(e) => setFinderInput({...finderInput, domain: e.target.value})}
                    placeholder="company.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button
                onClick={handleFindEmails}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Finding Emails...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Find Email Addresses
                  </>
                )}
              </button>
            </div>
          )}

          {/* Email Checker Tab */}
          {activeTab === 'checker' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Email Addresses (one per line)
              </label>
              <textarea
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                placeholder="john.doe@company.com&#10;jane.smith@company.com&#10;contact@business.com"
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
              />
              <button
                onClick={handleCheckEmails}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Checking Emails...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Verify Email Addresses
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        {(finderResults.length > 0 || checkerResults.length > 0) && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Results</h2>
              <button
                onClick={() => downloadResults(activeTab === 'finder' ? finderResults : checkerResults)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
            <div className="space-y-3">
              {(activeTab === 'finder' ? finderResults : checkerResults).map((result, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={getStatusColor(result.status)}>
                      {getStatusIcon(result.status)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{result.email}</p>
                      <p className="text-sm text-gray-500">
                        Status: <span className={`font-semibold ${getStatusColor(result.status)}`}>
                          {result.status.toUpperCase()}
                        </span> · Confidence: {result.confidence}%
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(result.email)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Copy email"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>⚡ Optimized for high-volume searches · 🌍 Serving US & India</p>
        </div>
      </div>
    </div>
  );
}


// import React, { useState } from "react";
// import {
//   Box,
//   Typography,
//   TextField,
//   Button,
//   Paper,
//   Grid,
// } from "@mui/material";

// function Dashboard() {
//   const [fullName, setFullName] = useState("");
//   const [domain, setDomain] = useState("");
//   const [results, setResults] = useState("Enter name and domain to find email addresses");

//   const handleFindEmails = async () => {
//     if (!fullName.trim() || !domain.trim()) {
//       setResults("Please enter both name and domain");
//       return;
//     }

//     setResults("Finding email addresses...");

  //   try {
  //     const response = await fetch('http://localhost:5000/api/find-emails', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({ fullName, domain }),
  //     });

  //     const data = await response.json();

  //     if (data.success && data.results && data.results.length > 0) {
  //       const emailList = data.results.map(result => 
  //         `${result.email} (${Math.round(result.score * 100)}% confidence)`
  //       ).join('\n');
  //       setResults(`Found ${data.totalFound} email(s):\n${emailList}`);
  //     } else {
  //       setResults("No email addresses found. Try different names or domains.");
  //     }
  //   } catch (err) {
  //     setResults("Failed to connect to server. Make sure backend is running.");
  //   }
  // };

//   return (
//     <Box
//       sx={{
//         height: "100vh",
//         width: "100vw",
//         background: "white",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         padding: 2,
//         overflow: "hidden", // Prevent scrolling
//         boxSizing: "border-box",
//       }}
//     >
//       <Paper
//         elevation={0}
//         sx={{
//           width: "95%",
//           maxWidth: 800,
//           padding: { xs: 3, sm: 4 },
//           borderRadius: 3,
//           background: "rgba(255, 255, 255, 0.95)",
//           backdropFilter: "blur(10px)",
//           border: "1px solid rgba(255, 255, 255, 0.2)",
//           boxSizing: "border-box",
//           mx: 2,
//         }}
//       >
//         <Box textAlign="center" mb={4}>
//           <Typography
//             variant="h6"
//             fontWeight={600}
//             gutterBottom
//             sx={{
//               fontSize: { xs: "1.8rem", sm: "2.5rem", md: "3rem" },
//               background: "black",
//               backgroundClip: "text",
//               WebkitBackgroundClip: "text",
//               color: "transparent",
//               lineHeight: 1.2,
//             }}
//           >
//             Find Email Addresses
//           </Typography>
//           <Typography
//             variant="h7"
//             fontWeight={400}
//             sx={{
//               fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
//               background: "black",
//               backgroundClip: "text",
//               WebkitBackgroundClip: "text",
//               color: "transparent",
//               mb: 1,
//             }}
//           >
//             With 99% Accuracy
//           </Typography>
//           <Typography
//             variant="body1"
//             color="text.secondary"
//             sx={{ 
//               fontSize: { xs: "0.9rem", sm: "1rem" },
//               opacity: 0.8
//             }}
//           >
//             Enter details to find valid email addresses
//           </Typography>
//         </Box>

//         <Box sx={{ width: "100%" }}>
//           <Grid container spacing={5}>
//             <Grid item xs={12} md={6}>
//               <TextField
//                 fullWidth
//                 variant="outlined"
//                 placeholder="Enter person's full name"
//                 size="small"
//                 value={fullName}
//                 onChange={(e) => setFullName(e.target.value)}
//                 sx={{
//                   "& .MuiOutlinedInput-root": {
//                     borderRadius: 2,
//                     "&:hover fieldset": {
//                       borderColor: "black",
//                     },
//                     "&.Mui-focused fieldset": {
//                       borderColor: "black",
//                     },
//                   },
//                 }}
//               />
//             </Grid>
            
//             <Grid item xs={12} md={6}>
//               <TextField
//                 fullWidth
//                 variant="outlined"
//                 placeholder="Enter company domain"
//                 size="small"
//                 value={domain}
//                 onChange={(e) => setDomain(e.target.value)}
//                 sx={{
//                   "& .MuiOutlinedInput-root": {
//                     borderRadius: 1,
//                     "&:hover fieldset": {
//                       borderColor: "black",
//                     },
//                     "&.Mui-focused fieldset": {
//                       borderColor: "black",
//                     },
//                   },
//                 }}
//               />
//             </Grid>
//           </Grid>

//           <Box
//             sx={{
//               mt: 3,
//               p: 3,
//               borderRadius: 2,
//               backgroundColor: "white",
//               border: "black",
//             }}
//           >
//             <Typography
//               variant="body1"
//               color="text.secondary"
//               textAlign="center"
//               sx={{ whiteSpace: 'pre-line' }}
//             >
//               {results}
//             </Typography>
//           </Box>

//           <Box textAlign="center" mt={4}>
//             <Button
//               variant="contained"
//               size="large"
//               onClick={handleFindEmails}
//               sx={{
//                 px: 4,
//                 py: 1,
//                 borderRadius: 2,
//                 fontSize: "1rem",
//                 fontWeight: 300,
//                 textTransform: "none",
//                 background: "black",
//                 boxShadow: "0 4px 12px 0 rgba(102, 126, 234, 0.3)",
//                 minWidth: 180,
//                 "&:hover": {
//                   boxShadow: "0 6px 16px 0 rgba(102, 126, 234, 0.4)",
//                   transform: "translateY(-1px)",
//                 },
//                 transition: "all 0.2s ease",
//               }}
//             >
//               Find Emails
//             </Button>
//           </Box>
//         </Box>

//         <Box textAlign="center" mt={3}>
//           <Typography
//             variant="caption"
//             color="text.secondary"
//             sx={{ 
//               opacity: 0.7,
//               fontSize: "0.75rem"
//             }}
//           >
//             Get accurate email addresses instantly
//           </Typography>
//         </Box>
//       </Paper>
//     </Box>
//   );
// }

// export default Dashboard;