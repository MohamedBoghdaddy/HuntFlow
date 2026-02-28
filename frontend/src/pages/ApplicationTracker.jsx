import React, { useEffect, useMemo, useState } from "react";
import { Container, Typography, Grid, Paper, Stack, Button, Box } from "@mui/material";
import apiClient, { normalizeApiError } from "../api/api";

function ApplicationTracker() {
  const statuses = useMemo(
    () => ["saved", "queued", "applied", "interview", "offer", "rejected"],
    [],
  );

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const getAppId = (app) => app?._id || app?.id || app?.application_id;

  useEffect(() => {
    let alive = true;

    async function fetchApps() {
      try {
        // Works whether baseURL already includes /api or not
        const res = await apiClient.get("/applications");

        // Be tolerant to different backends/shapes
        const list =
          res?.data?.applications ||
          res?.data?.items ||
          res?.data?.data?.applications ||
          res?.data ||
          [];

        if (alive) setApplications(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to fetch applications", err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchApps();
    return () => {
      alive = false;
    };
  }, []);

  const moveToStatus = async (applicationId, newStatus) => {
    try {
      const res = await apiClient.put(`/applications/${applicationId}`, { status: newStatus });

      // If backend returns updated object, prefer it
      const updated =
        res?.data?.application ||
        res?.data?.data?.application ||
        res?.data;

      setApplications((prev) =>
        prev.map((app) => {
          const id = getAppId(app);
          if (id !== applicationId) return app;
          if (updated && typeof updated === "object") return { ...app, ...updated };
          return { ...app, status: newStatus };
        }),
      );
    } catch (err) {
      console.error("Failed to update application status", err);
      alert(normalizeApiError(err));
    }
  };

  const grouped = useMemo(() => {
    return statuses.reduce((acc, status) => {
      acc[status] = applications.filter((app) => (app?.status || "saved") === status);
      return acc;
    }, {});
  }, [applications, statuses]);

  const nextStatus = (status) => {
    const idx = statuses.indexOf(status);
    return idx >= 0 && idx < statuses.length - 1 ? statuses[idx + 1] : null;
  };

  return (
    <Container maxWidth="xl">
      <Typography variant="h4" gutterBottom>
        Applications Tracker
      </Typography>

      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
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

                <Stack spacing={1}>
                  {grouped[status]?.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center">
                      None
                    </Typography>
                  ) : (
                    grouped[status].map((app) => {
                      const id = getAppId(app);
                      const n = nextStatus(app.status);

                      return (
                        <Box key={id} sx={{ border: "1px solid #eee", borderRadius: 1, p: 1 }}>
                          <Typography variant="subtitle2">
                            {app?.job?.title || app?.title || "Unknown"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {app?.job?.company || app?.company || ""}
                          </Typography>

                          {n && (
                            <Button
                              variant="outlined"
                              size="small"
                              fullWidth
                              sx={{ mt: 1 }}
                              onClick={() => moveToStatus(id, n)}
                            >
                              Move to {n}
                            </Button>
                          )}
                        </Box>
                      );
                    })
                  )}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

export default ApplicationTracker;