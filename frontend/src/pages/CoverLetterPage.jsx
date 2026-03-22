import React, { useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  CircularProgress,
  Alert,
  Snackbar,
  Box,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { api, normalizeApiError } from "../api/api";

export default function CoverLetterPage() {
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [cvText, setCvText] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!jobTitle.trim() || !company.trim()) {
      setError("Job title and company are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.node.cv.coverLetter({
        cv_text: cvText,
        job_title: jobTitle,
        company,
        job_description: jobDescription,
      });
      const letter =
        res?.data?.cover_letter ||
        res?.data?.data?.cover_letter ||
        res?.cover_letter ||
        "";
      setCoverLetter(letter);
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!coverLetter) return;
    navigator.clipboard.writeText(coverLetter).then(() => {
      setCopied(true);
    });
  };

  return (
    <Container maxWidth="md" sx={{ pb: 6 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        Cover Letter Generator
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Fill in the job details below and we will generate a tailored cover
        letter using your CV.
      </Typography>

      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Job Title *"
              fullWidth
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
            <TextField
              label="Company *"
              fullWidth
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Stack>

          <TextField
            label="Job Description"
            fullWidth
            multiline
            minRows={4}
            maxRows={10}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here for a better-tailored letter..."
          />

          <TextField
            label="Your CV Text (optional — uses stored CV if left blank)"
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder="Paste your CV text here, or leave blank to use your uploaded CV..."
          />

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            variant="contained"
            size="large"
            onClick={handleGenerate}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {loading ? "Generating..." : "Generate Cover Letter"}
          </Button>
        </Stack>
      </Paper>

      {coverLetter && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Your Cover Letter</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
            >
              Copy
            </Button>
          </Stack>

          <Box
            component="textarea"
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            style={{
              width: "100%",
              minHeight: 320,
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.6,
              padding: "12px",
              border: "1px solid #ccc",
              borderRadius: 6,
              resize: "vertical",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </Paper>
      )}

      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        message="Copied to clipboard"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Container>
  );
}
