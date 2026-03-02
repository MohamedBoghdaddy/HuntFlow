// pages/ApplicationTracker.jsx (MERGED MVP)
// - Kanban tracker (MUI) + table/actions
// - Uses apiClient if available, falls back to fetch(API_BASE)
// - Works with different backend response shapes
// - Keeps status move button + dropdown status update
// - Applicant form (for /apply) with localStorage persistence

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Container,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  Box,
  TextField,
  Alert,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";

import apiClient, { normalizeApiError } from "../api/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export default function ApplicationTracker() {
  const statuses = useMemo(
    () => ["saved", "queued", "applied", "interview", "offer", "rejected"],
    [],
  );

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [view, setView] = useState("kanban"); // "kanban" | "table"
  const [complexOnly, setComplexOnly] = useState(false);

  const [applicant, setApplicant] = useState(() => {
    try {
      const saved = localStorage.getItem("applicant_profile");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      resume: "",
      coverLetter: "",
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem("applicant_profile", JSON.stringify(applicant));
    } catch {}
  }, [applicant]);

  const getAppId = (app) => app?._id || app?.id || app?.application_id;

  const normalizeList = (res) => {
    const data = res?.data ?? res; // apiClient vs fetch json
    const list =
      data?.applications ||
      data?.items ||
      data?.data?.applications ||
      data?.data?.items ||
      data?.data ||
      data ||
      [];
    return Array.isArray(list) ? list : [];
  };

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const request = useCallback(
    async (method, path, body) => {
      const p = path.startsWith("/") ? path : `/${path}`;

      // Prefer apiClient (axios) if available
      try {
        if (apiClient && typeof apiClient.request === "function") {
          const res = await apiClient.request({
            method,
            url: p,
            data: body,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          return { ok: true, data: res?.data };
        }
      } catch (err) {
        return { ok: false, error: normalizeApiError?.(err) || String(err) };
      }

      // Fallback to fetch
      try {
        const res = await fetch(`${API_BASE}${p}`, {
          method: method.toUpperCase(),
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false,
            error: data?.error || data?.detail || "Request failed",
          };
        }
        return { ok: true, data };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    [authHeaders, token],
  );

  const fetchApplications = useCallback(
    async (onlyComplex = false) => {
      if (!token) {
        setMessage("You must be logged in to view applications");
        setApps([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");

      const path = `/applications${onlyComplex ? "/complex" : ""}`;
      const res = await request("GET", path);

      if (res.ok) {
        setApps(normalizeList(res));
      } else {
        setMessage(res.error || "Failed to fetch applications");
      }

      setLoading(false);
    },
    [request, token],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      await fetchApplications(complexOnly);
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [fetchApplications, complexOnly]);

  const handleApplicantChange = (e) => {
    const { name, value } = e.target;
    setApplicant((prev) => ({ ...prev, [name]: value }));
  };

  const updateStatus = async (applicationId, status) => {
    const res = await request("PUT", `/applications/${applicationId}`, {
      status,
    });
    if (res.ok) {
      setMessage("Status updated");
      const updated =
        res?.data?.application || res?.data?.data?.application || res?.data;
      setApps((prev) =>
        prev.map((a) => {
          const id = getAppId(a);
          if (id !== applicationId) return a;
          if (updated && typeof updated === "object")
            return { ...a, ...updated };
          return { ...a, status };
        }),
      );
      return;
    }
    setMessage(res.error || "Failed to update status");
  };

  const nextStatus = (status) => {
    const s = status || "saved";
    const idx = statuses.indexOf(s);
    return idx >= 0 && idx < statuses.length - 1 ? statuses[idx + 1] : null;
  };

  const moveToNext = async (applicationId) => {
    const app = apps.find((a) => getAppId(a) === applicationId);
    const n = nextStatus(app?.status || "saved");
    if (!n) return;
    await updateStatus(applicationId, n);
  };

  const applyToJob = async (applicationId) => {
    if (!token) return setMessage("You must be logged in to apply");
    const res = await request(
      "POST",
      `/applications/${applicationId}/apply`,
      applicant,
    );
    if (res.ok) {
      setMessage("Application submitted successfully");
      await fetchApplications(complexOnly);
      return;
    }
    setMessage(res.error || "Failed to apply");
  };

  const contactRecruiter = async (applicationId) => {
    if (!token) return setMessage("You must be logged in");

    const subject = prompt("Email subject:", "Application follow-up");
    const body = prompt("Email message:", "Hello...");
    if (!subject || !body) return;

    const res = await request(
      "POST",
      `/applications/${applicationId}/contact`,
      {
        subject,
        message: body,
      },
    );

    if (res.ok) setMessage("Email sent successfully");
    else setMessage(res.error || "Failed to send email");
  };

  const generateInterviewPrep = async (applicationId) => {
    if (!token) return setMessage("You must be logged in");

    const res = await request(
      "GET",
      `/applications/${applicationId}/interview-prep`,
    );
    if (res.ok) {
      const prep =
        res?.data?.prep ||
        res?.data?.data?.prep ||
        res?.data?.message ||
        "No content returned";
      alert(prep);
      return;
    }
    setMessage(res.error || "Failed to generate interview prep");
  };

  const grouped = useMemo(() => {
    return statuses.reduce((acc, status) => {
      acc[status] = apps.filter((app) => (app?.status || "saved") === status);
      return acc;
    }, {});
  }, [apps, statuses]);

  const titleOf = (app) => app?.job?.title || app?.title || "Unknown";
  const companyOf = (app) => app?.job?.company || app?.company || "";
  const statusOf = (app) => app?.status || "saved";

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
        >
          <Box>
            <Typography variant="h4">Applications</Typography>
            <Typography variant="body2" color="text.secondary">
              Track status, apply, email recruiters, and generate interview prep
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <Chip
              clickable
              label={view === "kanban" ? "Kanban view" : "Table view"}
              onClick={() =>
                setView((v) => (v === "kanban" ? "table" : "kanban"))
              }
              variant="outlined"
            />
            <Chip
              clickable
              color={complexOnly ? "warning" : "default"}
              label={complexOnly ? "Manual-Effort: ON" : "Manual-Effort: OFF"}
              onClick={() => setComplexOnly((v) => !v)}
              variant="outlined"
            />
            <Button
              variant="contained"
              onClick={() => fetchApplications(complexOnly)}
              disabled={loading}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>

        {message && <Alert severity="info">{message}</Alert>}

        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Applicant profile (used for Apply)
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="First name"
                name="firstName"
                value={applicant.firstName}
                onChange={handleApplicantChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Last name"
                name="lastName"
                value={applicant.lastName}
                onChange={handleApplicantChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={applicant.email}
                onChange={handleApplicantChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={applicant.phone}
                onChange={handleApplicantChange}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Resume URL"
                name="resume"
                value={applicant.resume}
                onChange={handleApplicantChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cover letter"
                name="coverLetter"
                value={applicant.coverLetter}
                onChange={handleApplicantChange}
              />
            </Grid>
          </Grid>
        </Paper>

        {loading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}>
            <CircularProgress size={22} />
            <Typography>Loading applications...</Typography>
          </Box>
        ) : view === "kanban" ? (
          <Grid container spacing={2}>
            {statuses.map((status) => (
              <Grid item xs={12} sm={6} md={4} lg={2} key={status}>
                <Paper elevation={3} sx={{ p: 2, minHeight: "60vh" }}>
                  <Typography
                    variant="h6"
                    align="center"
                    gutterBottom
                    sx={{ textTransform: "capitalize" }}
                  >
                    {status}
                  </Typography>

                  <Divider sx={{ mb: 1 }} />

                  <Stack spacing={1}>
                    {grouped[status]?.length === 0 ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        align="center"
                      >
                        None
                      </Typography>
                    ) : (
                      grouped[status].map((app) => {
                        const id = getAppId(app);
                        const n = nextStatus(statusOf(app));

                        return (
                          <Box
                            key={id}
                            sx={{
                              border: "1px solid #eee",
                              borderRadius: 2,
                              p: 1.2,
                            }}
                          >
                            <Typography variant="subtitle2">
                              {titleOf(app)}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {companyOf(app)}
                            </Typography>

                            <Stack spacing={1} sx={{ mt: 1 }}>
                              {statusOf(app) === "saved" && (
                                <Button
                                  variant="contained"
                                  size="small"
                                  fullWidth
                                  onClick={() => applyToJob(id)}
                                >
                                  Apply
                                </Button>
                              )}

                              <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                onClick={() => contactRecruiter(id)}
                              >
                                Email recruiter
                              </Button>

                              <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                onClick={() => generateInterviewPrep(id)}
                              >
                                Interview prep
                              </Button>

                              {n && (
                                <Button
                                  variant="text"
                                  size="small"
                                  fullWidth
                                  onClick={() => moveToNext(id)}
                                >
                                  Move to {n}
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        );
                      })
                    )}
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              My Applications
            </Typography>

            <Box sx={{ overflowX: "auto" }}>
              <table width="100%" border="1" cellPadding="8" cellSpacing="0">
                <thead>
                  <tr>
                    <th align="left">Title</th>
                    <th align="left">Company</th>
                    <th align="left">Status</th>
                    <th align="left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => {
                    const id = getAppId(app);
                    const s = statusOf(app);

                    return (
                      <tr key={id}>
                        <td>{titleOf(app)}</td>
                        <td>{companyOf(app)}</td>
                        <td>
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Status</InputLabel>
                            <Select
                              label="Status"
                              value={s}
                              onChange={(e) => updateStatus(id, e.target.value)}
                            >
                              {statuses.map((st) => (
                                <MenuItem key={st} value={st}>
                                  {st}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </td>
                        <td>
                          <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                          >
                            {s === "saved" && (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => applyToJob(id)}
                              >
                                Apply
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => contactRecruiter(id)}
                            >
                              Email
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => generateInterviewPrep(id)}
                            >
                              Interview Prep
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => moveToNext(id)}
                            >
                              Move next
                            </Button>
                          </Stack>
                        </td>
                      </tr>
                    );
                  })}
                  {apps.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <Typography variant="body2" color="text.secondary">
                          No applications found
                        </Typography>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Box>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
