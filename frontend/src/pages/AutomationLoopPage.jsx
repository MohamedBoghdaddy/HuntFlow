import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DoNotDisturbOnOutlinedIcon from "@mui/icons-material/DoNotDisturbOnOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000",
  withCredentials: true,
});

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function hasAnyKeyword(text, keywords = []) {
  const fullText = normalizeText(text);
  return keywords.some((kw) => fullText.includes(normalizeText(kw)));
}

function countKeywordMatches(text, keywords = []) {
  const fullText = normalizeText(text);
  return keywords.reduce((count, kw) => {
    return fullText.includes(normalizeText(kw)) ? count + 1 : count;
  }, 0);
}

function calculateJobScore(job, profile) {
  const title = job.title || "";
  const company = job.company || "";
  const description = job.description || job.summary || "";
  const location = job.location || "";

  const combinedText = `${title} ${company} ${description} ${location}`;

  const targetRoles = profile?.targetRoles || [];
  const skills = profile?.skills || [];
  const preferredLocations = profile?.preferredLocations || [];
  const preferredJobTypes = profile?.preferredJobTypes || [];
  const seniority = profile?.seniority || "";
  const blacklistCompanies = profile?.blacklistCompanies || [];
  const blacklistKeywords = profile?.blacklistKeywords || [];

  let score = 0;
  const reasons = [];

  const roleMatches = countKeywordMatches(title, targetRoles) * 18;
  if (roleMatches > 0) {
    score += Math.min(roleMatches, 36);
    reasons.push("Title matches target role");
  }

  const skillMatches = countKeywordMatches(combinedText, skills) * 6;
  if (skillMatches > 0) {
    score += Math.min(skillMatches, 30);
    reasons.push("Skills match profile");
  }

  if (
    preferredLocations.length &&
    hasAnyKeyword(location, preferredLocations)
  ) {
    score += 12;
    reasons.push("Preferred location");
  }

  if (
    preferredJobTypes.length &&
    hasAnyKeyword(job.jobType || job.type || "", preferredJobTypes)
  ) {
    score += 10;
    reasons.push("Preferred job type");
  }

  if (seniority && hasAnyKeyword(combinedText, [seniority])) {
    score += 8;
    reasons.push("Seniority aligned");
  }

  if (
    job.remote === true ||
    hasAnyKeyword(combinedText, ["remote", "hybrid"])
  ) {
    score += 6;
    reasons.push("Remote/Hybrid friendly");
  }

  if (blacklistCompanies.length && hasAnyKeyword(company, blacklistCompanies)) {
    score -= 40;
    reasons.push("Blacklisted company");
  }

  if (
    blacklistKeywords.length &&
    hasAnyKeyword(combinedText, blacklistKeywords)
  ) {
    score -= 35;
    reasons.push("Contains blocked keywords");
  }

  if (job.easyApply === true) {
    score += 8;
    reasons.push("Easy apply");
  }

  if (job.hasExternalApply === true) {
    score += 4;
    reasons.push("Application route available");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    reasons,
  };
}

function scoreColor(score) {
  if (score >= 80) return "success";
  if (score >= 60) return "primary";
  if (score >= 40) return "warning";
  return "default";
}

function JobCard({ job, onApply }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        height: "100%",
        boxShadow: 2,
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {job.title}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {job.company} • {job.location || "Location not specified"}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={`Score ${job.matchScore}`}
              color={scoreColor(job.matchScore)}
              variant="filled"
            />
            {job.jobType && <Chip label={job.jobType} variant="outlined" />}
            {job.remote && <Chip label="Remote" variant="outlined" />}
            {job.easyApply && (
              <Chip label="Easy Apply" color="success" variant="outlined" />
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {job.description?.slice(0, 220) || "No description available."}
            {job.description?.length > 220 ? "..." : ""}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(job.reasons || []).map((reason, idx) => (
              <Chip key={idx} size="small" label={reason} />
            ))}
          </Stack>

          <Divider />

          <Stack direction="row" spacing={1}>
            {job.applyUrl && (
              <Button
                variant="outlined"
                href={job.applyUrl}
                target="_blank"
                rel="noreferrer"
              >
                View Job
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<SendOutlinedIcon />}
              onClick={() => onApply(job)}
            >
              Apply Now
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function AutomationLoopPage() {
  const [jobs, setJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [minScore, setMinScore] = useState(65);
  const [maxAutoApplyPerRun, setMaxAutoApplyPerRun] = useState(10);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    scanned: 0,
    matched: 0,
    applied: 0,
    skipped: 0,
  });

  const loopRef = useRef(null);

  const fetchData = async () => {
    try {
      setError("");
      setLoading(true);

      const [jobsRes, profileRes] = await Promise.all([
        api.get("/api/jobs/fetched"),
        api.get("/api/profile/me"),
      ]);

      const rawJobs = jobsRes.data?.jobs || [];
      const userProfile = profileRes.data?.profile || {};

      const scoredJobs = rawJobs.map((job) => {
        const { score, reasons } = calculateJobScore(job, userProfile);
        return {
          ...job,
          matchScore: score,
          reasons,
        };
      });

      scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

      setJobs(scoredJobs);
      setProfile(userProfile);
      setStats((prev) => ({
        ...prev,
        scanned: scoredJobs.length,
        matched: scoredJobs.filter((j) => j.matchScore >= minScore).length,
      }));
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message || "Failed to load jobs and profile.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => job.matchScore >= minScore);
  }, [jobs, minScore]);

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      matched: filteredJobs.length,
    }));
  }, [filteredJobs]);

  const handleApplyNow = async (job) => {
    try {
      setStatus(`Applying to ${job.title} at ${job.company}...`);

      await api.post("/api/automation/run", {
        manual: true,
        jobs: [job],
        minScore,
      });

      setStats((prev) => ({
        ...prev,
        applied: prev.applied + 1,
      }));

      setStatus(`Applied to ${job.title} at ${job.company}`);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          `Failed to apply to ${job.title} at ${job.company}.`,
      );
    }
  };

  const runAutomationCycle = async () => {
    try {
      setError("");

      const candidates = filteredJobs
        .filter((job) => !job.applied)
        .slice(0, maxAutoApplyPerRun);

      if (!candidates.length) {
        setStatus("No matching jobs available for this cycle.");
        return;
      }

      setStatus(`Running automation on ${candidates.length} jobs...`);

      const response = await api.post("/api/automation/run", {
        manual: false,
        jobs: candidates,
        minScore,
        maxAutoApplyPerRun,
      });

      const result = response.data || {};

      setStats((prev) => ({
        scanned: jobs.length,
        matched: filteredJobs.length,
        applied: result.appliedCount ?? prev.applied,
        skipped: result.skippedCount ?? prev.skipped,
      }));

      setStatus(result.message || "Automation cycle completed.");
      await fetchData();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message || "Automation loop failed during run.",
      );
      setRunning(false);
    }
  };

  const startLoop = async () => {
    setRunning(true);
    setStatus("Automation loop started.");
    await runAutomationCycle();

    loopRef.current = setInterval(
      async () => {
        await runAutomationCycle();
      },
      60 * 60 * 1000,
    ); // every 1 hour
  };

  const stopLoop = async () => {
    try {
      if (loopRef.current) {
        clearInterval(loopRef.current);
        loopRef.current = null;
      }

      await api.post("/api/automation/stop");
      setRunning(false);
      setStatus("Automation loop stopped.");
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message || "Failed to stop automation loop.",
      );
    }
  };

  useEffect(() => {
    let refreshInterval;

    if (autoRefresh && !running) {
      refreshInterval = setInterval(() => {
        fetchData();
      }, 60 * 1000);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [autoRefresh, running]);

  useEffect(() => {
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Box>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" fontWeight={800}>
                Automation Loop
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Automatically apply to fetched jobs that match the user profile
                and pass the score threshold.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              {!running ? (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={startLoop}
                >
                  Start Loop
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={stopLoop}
                >
                  Stop Loop
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        {loading && <LinearProgress />}

        {error && <Alert severity="error">{error}</Alert>}
        {status && <Alert severity="info">{status}</Alert>}

        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <WorkOutlineIcon color="primary" />
                    <Typography fontWeight={700}>Scanned</Typography>
                  </Stack>
                  <Typography variant="h4">{stats.scanned}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoAwesomeIcon color="primary" />
                    <Typography fontWeight={700}>Matched</Typography>
                  </Stack>
                  <Typography variant="h4">{stats.matched}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircleOutlineIcon color="success" />
                    <Typography fontWeight={700}>Applied</Typography>
                  </Stack>
                  <Typography variant="h4">{stats.applied}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DoNotDisturbOnOutlinedIcon color="warning" />
                    <Typography fontWeight={700}>Skipped</Typography>
                  </Stack>
                  <Typography variant="h4">{stats.skipped}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight={700}>
                Automation Controls
              </Typography>

              <Box>
                <Typography gutterBottom fontWeight={600}>
                  Minimum score to auto-apply: {minScore}
                </Typography>
                <Slider
                  value={minScore}
                  onChange={(_, value) => setMinScore(value)}
                  valueLabelDisplay="auto"
                  step={5}
                  min={0}
                  max={100}
                />
              </Box>

              <FormControl fullWidth>
                <InputLabel>Max Auto Apply Per Run</InputLabel>
                <Select
                  value={maxAutoApplyPerRun}
                  label="Max Auto Apply Per Run"
                  onChange={(e) =>
                    setMaxAutoApplyPerRun(Number(e.target.value))
                  }
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={15}>15</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                </Select>
              </FormControl>

              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography fontWeight={600}>Auto refresh jobs</Typography>
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              </Stack>

              <Button variant="outlined" onClick={fetchData}>
                Refresh Now
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Typography variant="h5" fontWeight={800}>
              Matching Jobs
            </Typography>
            <Chip
              label={`${filteredJobs.length} jobs above threshold`}
              color="primary"
            />
          </Stack>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : filteredJobs.length === 0 ? (
            <Alert severity="warning">
              No jobs currently match the selected score threshold.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {filteredJobs.map((job, index) => (
                <Grid item xs={12} md={6} lg={4} key={job.id || index}>
                  <JobCard job={job} onApply={handleApplyNow} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {profile && (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Profile Signals Used for Scoring
              </Typography>

              <Stack spacing={2}>
                <Box>
                  <Typography fontWeight={600}>Target Roles</Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    mt={1}
                  >
                    {(profile.targetRoles || []).map((item, idx) => (
                      <Chip key={idx} label={item} />
                    ))}
                  </Stack>
                </Box>

                <Box>
                  <Typography fontWeight={600}>Skills</Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    mt={1}
                  >
                    {(profile.skills || []).map((item, idx) => (
                      <Chip key={idx} label={item} />
                    ))}
                  </Stack>
                </Box>

                <Box>
                  <Typography fontWeight={600}>Preferred Locations</Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    mt={1}
                  >
                    {(profile.preferredLocations || []).map((item, idx) => (
                      <Chip key={idx} label={item} />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
