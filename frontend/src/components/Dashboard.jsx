import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
} from "@mui/material";

function Dashboard() {
  const [fullName, setFullName] = useState("");
  const [domain, setDomain] = useState("");
  const [results, setResults] = useState("Enter name and domain to find email addresses");

  const handleFindEmails = async () => {
    if (!fullName.trim() || !domain.trim()) {
      setResults("Please enter both name and domain");
      return;
    }

    setResults("Finding email addresses...");

    try {
      const response = await fetch('http://localhost:5000/api/find-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullName, domain }),
      });

      const data = await response.json();

      if (data.success && data.results && data.results.length > 0) {
        const emailList = data.results.map(result => 
          `${result.email} (${Math.round(result.score * 100)}% confidence)`
        ).join('\n');
        setResults(`Found ${data.totalFound} email(s):\n${emailList}`);
      } else {
        setResults("No email addresses found. Try different names or domains.");
      }
    } catch (err) {
      setResults("Failed to connect to server. Make sure backend is running.");
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100vw",
        background: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
        overflow: "hidden", // Prevent scrolling
        boxSizing: "border-box",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "95%",
          maxWidth: 800,
          padding: { xs: 3, sm: 4 },
          borderRadius: 3,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxSizing: "border-box",
          mx: 2,
        }}
      >
        <Box textAlign="center" mb={4}>
          <Typography
            variant="h6"
            fontWeight={600}
            gutterBottom
            sx={{
              fontSize: { xs: "1.8rem", sm: "2.5rem", md: "3rem" },
              background: "black",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              lineHeight: 1.2,
            }}
          >
            Find Email Addresses
          </Typography>
          <Typography
            variant="h7"
            fontWeight={400}
            sx={{
              fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
              background: "black",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              mb: 1,
            }}
          >
            With 99% Accuracy
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ 
              fontSize: { xs: "0.9rem", sm: "1rem" },
              opacity: 0.8
            }}
          >
            Enter details to find valid email addresses
          </Typography>
        </Box>

        <Box sx={{ width: "100%" }}>
          <Grid container spacing={5}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Enter person's full name"
                size="small"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    "&:hover fieldset": {
                      borderColor: "black",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "black",
                    },
                  },
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Enter company domain"
                size="small"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 1,
                    "&:hover fieldset": {
                      borderColor: "black",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "black",
                    },
                  },
                }}
              />
            </Grid>
          </Grid>

          <Box
            sx={{
              mt: 3,
              p: 3,
              borderRadius: 2,
              backgroundColor: "white",
              border: "black",
            }}
          >
            <Typography
              variant="body1"
              color="text.secondary"
              textAlign="center"
              sx={{ whiteSpace: 'pre-line' }}
            >
              {results}
            </Typography>
          </Box>

          <Box textAlign="center" mt={4}>
            <Button
              variant="contained"
              size="large"
              onClick={handleFindEmails}
              sx={{
                px: 4,
                py: 1,
                borderRadius: 2,
                fontSize: "1rem",
                fontWeight: 300,
                textTransform: "none",
                background: "black",
                boxShadow: "0 4px 12px 0 rgba(102, 126, 234, 0.3)",
                minWidth: 180,
                "&:hover": {
                  boxShadow: "0 6px 16px 0 rgba(102, 126, 234, 0.4)",
                  transform: "translateY(-1px)",
                },
                transition: "all 0.2s ease",
              }}
            >
              Find Emails
            </Button>
          </Box>
        </Box>

        <Box textAlign="center" mt={3}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ 
              opacity: 0.7,
              fontSize: "0.75rem"
            }}
          >
            Get accurate email addresses instantly
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default Dashboard;