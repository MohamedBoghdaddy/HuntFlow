import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Pagination,
  Drawer,
  Divider,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Chip,
  Box,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useNavigate } from "react-router-dom";
import { api, normalizeApiError } from "../api/api";

function JobFeed() {
  const navigate = useNavigate();
  const PAGE_SIZE = 12;

  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0); // total returned by backend (not global market size)
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    countries: ["eg", "ae", "sa", "eu"],
    remote_only: false,
    sort_by: "relevance", // relevance | date
    date_posted: "any", // any | 1 | 7 | 30
    job_types: [], // full_time, part_time, contract, permanent, internship
    where: "",
    salary_min: "",
    salary_max: "",
  });

  const max_days_old = useMemo(() => {
    if (filters.date_posted === "1") return 1;
    if (filters.date_posted === "7") return 7;
    if (filters.date_posted === "30") return 30;
    return null;
  }, [filters.date_posted]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const payload = {
        query: (search || "").trim() || "software",
        countries: filters.countries,
        pages: page,
        results_per_page: PAGE_SIZE,
        remote_only: filters.remote_only,
        sort_by: filters.sort_by,
        max_days_old,
        job_types: filters.job_types,
        where: filters.where?.trim() || null,
        salary_min:
          filters.salary_min !== "" ? Number(filters.salary_min) : null,
        salary_max:
          filters.salary_max !== "" ? Number(filters.salary_max) : null,
      };

      const res = await api.py.jobs.search(payload);

      const list = res?.data?.jobs || res?.jobs || [];
      const count =
        res?.data?.count ??
        res?.count ??
        (Array.isArray(list) ? list.length : 0);

      // We fetch up to "page" pages server-side, then show the current page slice
      const start = (page - 1) * PAGE_SIZE;
      const paged = Array.isArray(list)
        ? list.slice(start, start + PAGE_SIZE)
        : [];

      setJobs(paged);
      setTotal(count);
    } catch (err) {
      console.error("Failed to fetch jobs", err);
      alert(normalizeApiError(err));
      setJobs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchJobs();
  };

  const getJobId = (job) =>
    job?.job_url || job?.apply_url || job?.url || job?.id;

  const openDetail = (job) => {
    const jobId = getJobId(job);
    if (!jobId) return;
    sessionStorage.setItem(`hf_job_${jobId}`, JSON.stringify(job));
    navigate(`/jobs/${encodeURIComponent(jobId)}`);
  };

  const handleSave = async (job) => {
    try {
      const jobId = getJobId(job);
      await api.node.applications.create({ jobId });
      alert("Job saved to your pipeline");
    } catch (err) {
      alert(normalizeApiError(err));
    }
  };

  const toggleCountry = (c) => {
    setFilters((prev) => {
      const has = prev.countries.includes(c);
      const next = has
        ? prev.countries.filter((x) => x !== c)
        : [...prev.countries, c];
      return { ...prev, countries: next.length ? next : prev.countries };
    });
  };

  const toggleJobType = (t) => {
    setFilters((prev) => {
      const has = prev.job_types.includes(t);
      return {
        ...prev,
        job_types: has
          ? prev.job_types.filter((x) => x !== t)
          : [...prev.job_types, t],
      };
    });
  };

  const resetFilters = () => {
    setFilters({
      countries: ["eg", "ae", "sa", "eu"],
      remote_only: false,
      sort_by: "relevance",
      date_posted: "any",
      job_types: [],
      where: "",
      salary_min: "",
      salary_max: "",
    });
    setPage(1);
  };

  const applyFilters = () => {
    setFiltersOpen(false);
    setPage(1);
    fetchJobs();
  };

  return (
    <Container maxWidth="lg">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="h4" component="h1">
          Discover Jobs
        </Typography>

        <IconButton onClick={() => setFiltersOpen(true)} aria-label="filters">
          <FilterListIcon />
        </IconButton>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Search by title or company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
        <Button variant="contained" onClick={handleSearch}>
          Search
        </Button>

        <Button
          variant={filters.remote_only ? "contained" : "outlined"}
          onClick={() => {
            setFilters((p) => ({ ...p, remote_only: !p.remote_only }));
            setPage(1);
          }}
        >
          Remote
        </Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 3, flexWrap: "wrap" }}
        useFlexGap
      >
        <Chip label={`Sort: ${filters.sort_by}`} size="small" />
        <Chip
          label={`Date: ${
            filters.date_posted === "any"
              ? "Any time"
              : filters.date_posted === "1"
                ? "Past 24 hours"
                : filters.date_posted === "7"
                  ? "Past week"
                  : "Past month"
          }`}
          size="small"
        />
        <Chip
          label={`Remote: ${filters.remote_only ? "Yes" : "No"}`}
          size="small"
        />
        {filters.where?.trim() ? (
          <Chip label={`Location: ${filters.where}`} size="small" />
        ) : null}
        {filters.job_types.length ? (
          <Chip label={`Type: ${filters.job_types.join(" ")}`} size="small" />
        ) : null}
      </Stack>

      {loading ? (
        <Typography>Loading...</Typography>
      ) : jobs.length === 0 ? (
        <Typography>No jobs found</Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {jobs.map((job) => {
              const jobId = getJobId(job);

              return (
                <Grid item key={jobId} xs={12} sm={6} md={4}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      cursor: "pointer",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                    onClick={() => openDetail(job)}
                  >
                    <div>
                      <Typography variant="h6">{job.title || "Job"}</Typography>
                      <Typography variant="subtitle2" color="text.secondary">
                        {job.company || ""}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {job.location || "Remote"}
                      </Typography>
                    </div>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave(job);
                      }}
                      sx={{ mt: 1 }}
                    >
                      Save
                    </Button>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          {pageCount > 1 && (
            <Stack alignItems="center" sx={{ mt: 3 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(e, v) => setPage(v)}
              />
            </Stack>
          )}
        </>
      )}

      <Drawer
        anchor="right"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      >
        <Box sx={{ width: 360, p: 2 }}>
          <Typography variant="h6">Filters</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Filters supported by your Adzuna backend
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Countries
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap" }}
            useFlexGap
          >
            {["eg", "ae", "sa", "eu"].map((c) => (
              <Chip
                key={c}
                label={c.toUpperCase()}
                clickable
                color={filters.countries.includes(c) ? "primary" : "default"}
                onClick={() => toggleCountry(c)}
              />
            ))}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Sort by
          </Typography>
          <ToggleButtonGroup
            value={filters.sort_by}
            exclusive
            onChange={(e, v) => v && setFilters((p) => ({ ...p, sort_by: v }))}
            size="small"
          >
            <ToggleButton value="relevance">Most relevant</ToggleButton>
            <ToggleButton value="date">Most recent</ToggleButton>
          </ToggleButtonGroup>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2">Date posted</Typography>
          <RadioGroup
            value={filters.date_posted}
            onChange={(e) =>
              setFilters((p) => ({ ...p, date_posted: e.target.value }))
            }
          >
            <FormControlLabel
              value="any"
              control={<Radio />}
              label="Any time"
            />
            <FormControlLabel
              value="1"
              control={<Radio />}
              label="Past 24 hours"
            />
            <FormControlLabel value="7" control={<Radio />} label="Past week" />
            <FormControlLabel
              value="30"
              control={<Radio />}
              label="Past month"
            />
          </RadioGroup>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Job type
          </Typography>
          <Stack>
            {[
              ["full_time", "Full-time"],
              ["part_time", "Part-time"],
              ["contract", "Contract"],
              ["permanent", "Permanent"],
              ["internship", "Internship"],
            ].map(([k, label]) => (
              <FormControlLabel
                key={k}
                control={
                  <Checkbox
                    checked={filters.job_types.includes(k)}
                    onChange={() => toggleJobType(k)}
                  />
                }
                label={label}
              />
            ))}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={
              <Checkbox
                checked={filters.remote_only}
                onChange={() =>
                  setFilters((p) => ({ ...p, remote_only: !p.remote_only }))
                }
              />
            }
            label="Remote only"
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Location
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Cairo, Dubai, Riyadh..."
            value={filters.where}
            onChange={(e) =>
              setFilters((p) => ({ ...p, where: e.target.value }))
            }
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Salary range
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="Min"
              value={filters.salary_min}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  salary_min: e.target.value.replace(/\D/g, ""),
                }))
              }
            />
            <TextField
              fullWidth
              size="small"
              label="Max"
              value={filters.salary_max}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  salary_max: e.target.value.replace(/\D/g, ""),
                }))
              }
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" fullWidth onClick={resetFilters}>
              Reset
            </Button>
            <Button variant="contained" fullWidth onClick={applyFilters}>
              Show results
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Container>
  );
}

export default JobFeed;
