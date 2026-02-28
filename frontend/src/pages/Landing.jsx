import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Stack,
  Box,
  Grid,
  Paper,
  Chip,
  Divider,
} from "@mui/material";

function Landing() {
  const features = [
    {
      title: "Discover jobs fast",
      desc: "Search across Egypt, UAE, Saudi and EU and jump straight to the apply link.",
    },
    {
      title: "ATS score and fixes",
      desc: "Get an ATS score, keyword gaps and a clean rewrite plan per job.",
    },
    {
      title: "One pipeline dashboard",
      desc: "Save roles, track status and keep your hunt organized without chaos.",
    },
    {
      title: "Career coach chat",
      desc: "Ask what to do next and get checklists, scripts and next moves.",
    },
  ];

  return (
    <Box
      sx={{
        py: { xs: 6, md: 10 },
        background:
          "radial-gradient(900px 500px at 50% 0%, rgba(25,118,210,0.18), transparent 55%)",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={7}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label="EG" size="small" />
                <Chip label="UAE" size="small" />
                <Chip label="Saudi" size="small" />
                <Chip label="EU" size="small" />
                <Chip label="Gemini-powered" size="small" variant="outlined" />
              </Stack>

              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                }}
              >
                Your job hunt, cleaned up and sped up with AI
              </Typography>

              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ maxWidth: 620 }}
              >
                Discover roles, score your CV, generate tailored resumes and
                track every application in one simple pipeline. Fast inputs,
                clear outputs, no fluff.
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ pt: 1 }}
              >
                <Button
                  variant="contained"
                  size="large"
                  component={RouterLink}
                  to="/register"
                >
                  Get started
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  component={RouterLink}
                  to="/login"
                >
                  Sign in
                </Button>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                No spam, no lock-in. You stay in control.
              </Typography>
            </Stack>
          </Grid>

          <Grid item xs={12} md={5}>
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                What you can do in HuntFlow
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={2}>
                {features.map((f) => (
                  <Box key={f.title}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {f.desc}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label="Apply links" size="small" variant="outlined" />
                <Chip label="CV enhance" size="small" variant="outlined" />
                <Chip label="Resume builder" size="small" variant="outlined" />
                <Chip label="Pipeline" size="small" variant="outlined" />
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Landing;
