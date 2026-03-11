import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import DescriptionIcon from "@mui/icons-material/Description";
import PsychologyIcon from "@mui/icons-material/Psychology";
import SaveIcon from "@mui/icons-material/Save";
import api from "../api/api";

function Profile() {
  const emptyProfile = useMemo(
    () => ({
      title: "",
      seniority: "",
      locations: [],
      links: { portfolio: "", github: "", linkedin: "" },
      authorization: "",
      salaryExpectation: { amount: "", currency: "" },
      preferences: {
        roles: [],
        industries: [],
        companies: [],
        salary: "",
        remoteOnly: false,
        cities: [],
      },
    }),
    [],
  );

  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cvFile, setCvFile] = useState(null);
  const [cvFileName, setCvFileName] = useState("");
  const [cvUploading, setCvUploading] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [creatingCv, setCreatingCv] = useState(false);

  const [message, setMessage] = useState({ type: "", text: "" });
  const [cvAnalysis, setCvAnalysis] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await api.get("/profile");
        const profileData = res?.data?.profile || emptyProfile;

        setProfile({
          title: profileData.title || "",
          seniority: profileData.seniority || "",
          locations: Array.isArray(profileData.locations)
            ? profileData.locations
            : [],
          links: {
            portfolio: profileData.links?.portfolio || "",
            github: profileData.links?.github || "",
            linkedin: profileData.links?.linkedin || "",
          },
          authorization: profileData.authorization || "",
          salaryExpectation: {
            amount: profileData.salaryExpectation?.amount || "",
            currency: profileData.salaryExpectation?.currency || "",
          },
          preferences: {
            roles: Array.isArray(profileData.preferences?.roles)
              ? profileData.preferences.roles
              : [],
            industries: Array.isArray(profileData.preferences?.industries)
              ? profileData.preferences.industries
              : [],
            companies: Array.isArray(profileData.preferences?.companies)
              ? profileData.preferences.companies
              : [],
            salary: profileData.preferences?.salary || "",
            remoteOnly: !!profileData.preferences?.remoteOnly,
            cities: Array.isArray(profileData.preferences?.cities)
              ? profileData.preferences.cities
              : [],
          },
        });
      } catch (err) {
        console.error("Failed to fetch profile", err);
        setMessage({
          type: "error",
          text: "Failed to load profile",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [emptyProfile]);

  const parseCommaString = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const normalizeProfilePayload = (currentProfile) => ({
    title: currentProfile.title,
    seniority: currentProfile.seniority,
    locations: parseCommaString(currentProfile.locations),
    links: currentProfile.links,
    authorization: currentProfile.authorization,
    salaryExpectation: {
      amount: currentProfile.salaryExpectation?.amount || "",
      currency: currentProfile.salaryExpectation?.currency || "",
    },
    preferences: {
      ...currentProfile.preferences,
      roles: parseCommaString(currentProfile.preferences.roles),
      industries: parseCommaString(currentProfile.preferences.industries),
      companies: parseCommaString(currentProfile.preferences.companies),
      cities: parseCommaString(currentProfile.preferences.cities),
      remoteOnly: !!currentProfile.preferences.remoteOnly,
    },
  });

  const mergeAutofillIntoProfile = (incoming = {}) => {
    setProfile((prev) => ({
      ...prev,
      title: incoming.title || prev.title,
      seniority: incoming.seniority || prev.seniority,
      locations:
        incoming.locations && incoming.locations.length
          ? incoming.locations
          : prev.locations,
      links: {
        portfolio: incoming.links?.portfolio || prev.links.portfolio,
        github: incoming.links?.github || prev.links.github,
        linkedin: incoming.links?.linkedin || prev.links.linkedin,
      },
      authorization: incoming.authorization || prev.authorization,
      salaryExpectation: {
        amount:
          incoming.salaryExpectation?.amount || prev.salaryExpectation.amount,
        currency:
          incoming.salaryExpectation?.currency ||
          prev.salaryExpectation.currency,
      },
      preferences: {
        ...prev.preferences,
        roles: incoming.preferences?.roles?.length
          ? incoming.preferences.roles
          : prev.preferences.roles,
        industries: incoming.preferences?.industries?.length
          ? incoming.preferences.industries
          : prev.preferences.industries,
        companies: incoming.preferences?.companies?.length
          ? incoming.preferences.companies
          : prev.preferences.companies,
        salary: incoming.preferences?.salary || prev.preferences.salary,
        remoteOnly:
          typeof incoming.preferences?.remoteOnly === "boolean"
            ? incoming.preferences.remoteOnly
            : prev.preferences.remoteOnly,
        cities: incoming.preferences?.cities?.length
          ? incoming.preferences.cities
          : prev.preferences.cities,
      },
    }));
  };

  const handleChange = (field) => (e) => {
    setProfile((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleNestedChange = (section, field) => (e) => {
    setProfile((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: e.target.value,
      },
    }));
  };

  const handlePreferencesChange = (field) => (e) => {
    const value = field === "remoteOnly" ? e.target.checked : e.target.value;

    setProfile((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value,
      },
    }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCvFile(file);
    setCvFileName(file.name);
    setMessage({
      type: "success",
      text: `Selected file: ${file.name}`,
    });
  };

  const uploadCv = async () => {
    if (!cvFile) {
      setMessage({
        type: "warning",
        text: "Please select a CV file first",
      });
      return null;
    }

    setCvUploading(true);
    setMessage({ type: "", text: "" });

    try {
      const formData = new FormData();
      formData.append("cv", cvFile);

      const res = await api.post("/cv/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage({
        type: "success",
        text: res?.data?.message || "CV uploaded successfully",
      });

      return res?.data;
    } catch (err) {
      console.error("Failed to upload CV", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "CV upload failed",
      });
      return null;
    } finally {
      setCvUploading(false);
    }
  };

  const handleAutofillFromCv = async () => {
    setAutofilling(true);
    setMessage({ type: "", text: "" });

    try {
      let uploadResult = null;

      if (cvFile) {
        uploadResult = await uploadCv();
        if (!uploadResult && cvFile) {
          setAutofilling(false);
          return;
        }
      }

      const res = await api.post("/cv/autofill", {
        fileId: uploadResult?.fileId,
      });

      const autofilledProfile =
        res?.data?.profile ||
        res?.data?.autofilledProfile ||
        res?.data?.data ||
        null;

      if (autofilledProfile) {
        mergeAutofillIntoProfile(autofilledProfile);
      }

      setMessage({
        type: "success",
        text:
          res?.data?.message ||
          "Profile was auto-filled from the CV successfully",
      });
    } catch (err) {
      console.error("Autofill failed", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to auto-fill profile from CV",
      });
    } finally {
      setAutofilling(false);
    }
  };

  const handleAnalyzeCv = async () => {
    setAnalyzing(true);
    setMessage({ type: "", text: "" });

    try {
      let uploadResult = null;

      if (cvFile) {
        uploadResult = await uploadCv();
        if (!uploadResult && cvFile) {
          setAnalyzing(false);
          return;
        }
      }

      const res = await api.post("/cv/analyze", {
        fileId: uploadResult?.fileId,
        profile: normalizeProfilePayload(profile),
      });

      setCvAnalysis(res?.data?.analysis || res?.data || null);

      setMessage({
        type: "success",
        text: res?.data?.message || "CV analyzed successfully",
      });
    } catch (err) {
      console.error("Analyze CV failed", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to analyze CV",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateCv = async () => {
    setCreatingCv(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = normalizeProfilePayload(profile);

      const res = await api.post("/cv/create", payload);

      const cvUrl = res?.data?.cvUrl || res?.data?.downloadUrl || null;

      setMessage({
        type: "success",
        text: cvUrl
          ? "CV created successfully"
          : res?.data?.message || "CV created successfully",
      });

      if (cvUrl) {
        window.open(cvUrl, "_blank");
      }
    } catch (err) {
      console.error("Create CV failed", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to create CV",
      });
    } finally {
      setCreatingCv(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = normalizeProfilePayload(profile);
      const res = await api.put("/profile", payload);

      if (res?.data?.profile) {
        setProfile({
          ...res.data.profile,
          locations: res.data.profile.locations || [],
          links: {
            portfolio: res.data.profile.links?.portfolio || "",
            github: res.data.profile.links?.github || "",
            linkedin: res.data.profile.links?.linkedin || "",
          },
          salaryExpectation: {
            amount: res.data.profile.salaryExpectation?.amount || "",
            currency: res.data.profile.salaryExpectation?.currency || "",
          },
          preferences: {
            roles: res.data.profile.preferences?.roles || [],
            industries: res.data.profile.preferences?.industries || [],
            companies: res.data.profile.preferences?.companies || [],
            salary: res.data.profile.preferences?.salary || "",
            remoteOnly: !!res.data.profile.preferences?.remoteOnly,
            cities: res.data.profile.preferences?.cities || [],
          },
        });
      }

      setMessage({
        type: "success",
        text: "Profile updated successfully",
      });
    } catch (err) {
      console.error("Failed to update profile", err);
      setMessage({
        type: "error",
        text:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Update failed",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Profile
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Upload your CV, auto-fill your profile, analyze your resume quality,
            or generate a new CV from your saved profile.
          </Typography>
        </Box>

        {message.text ? (
          <Alert severity={message.type || "info"}>{message.text}</Alert>
        ) : null}

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={700}>
                CV Actions
              </Typography>

              <Divider />

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadFileIcon />}
                  disabled={cvUploading || autofilling || analyzing}
                >
                  Select CV
                  <input
                    hidden
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileSelect}
                  />
                </Button>

                {cvFileName ? (
                  <Chip label={cvFileName} color="primary" variant="outlined" />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No CV selected
                  </Typography>
                )}
              </Stack>

              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={
                      cvUploading ? (
                        <CircularProgress size={18} />
                      ) : (
                        <UploadFileIcon />
                      )
                    }
                    onClick={uploadCv}
                    disabled={!cvFile || cvUploading}
                  >
                    {cvUploading ? "Uploading..." : "Upload CV"}
                  </Button>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    startIcon={
                      autofilling ? (
                        <CircularProgress size={18} />
                      ) : (
                        <AutoFixHighIcon />
                      )
                    }
                    onClick={handleAutofillFromCv}
                    disabled={autofilling || analyzing || cvUploading}
                  >
                    {autofilling ? "Auto-filling..." : "Autofill Profile"}
                  </Button>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="info"
                    startIcon={
                      analyzing ? (
                        <CircularProgress size={18} />
                      ) : (
                        <PsychologyIcon />
                      )
                    }
                    onClick={handleAnalyzeCv}
                    disabled={analyzing || autofilling || cvUploading}
                  >
                    {analyzing ? "Analyzing..." : "Analyze CV"}
                  </Button>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    startIcon={
                      creatingCv ? (
                        <CircularProgress size={18} />
                      ) : (
                        <DescriptionIcon />
                      )
                    }
                    onClick={handleCreateCv}
                    disabled={creatingCv || saving}
                  >
                    {creatingCv ? "Creating..." : "Create CV"}
                  </Button>
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        {cvAnalysis ? (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={700}>
                  CV Analysis
                </Typography>
                <Divider />

                {cvAnalysis.summary ? (
                  <Box>
                    <Typography fontWeight={700}>Summary</Typography>
                    <Typography color="text.secondary">
                      {cvAnalysis.summary}
                    </Typography>
                  </Box>
                ) : null}

                {cvAnalysis.score !== undefined ? (
                  <Box>
                    <Typography fontWeight={700}>Score</Typography>
                    <Chip
                      label={`Score: ${cvAnalysis.score}`}
                      color={
                        cvAnalysis.score >= 80
                          ? "success"
                          : cvAnalysis.score >= 60
                            ? "warning"
                            : "error"
                      }
                    />
                  </Box>
                ) : null}

                {Array.isArray(cvAnalysis.strengths) &&
                cvAnalysis.strengths.length ? (
                  <Box>
                    <Typography fontWeight={700} gutterBottom>
                      Strengths
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {cvAnalysis.strengths.map((item, idx) => (
                        <Chip
                          key={idx}
                          label={item}
                          color="success"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                {Array.isArray(cvAnalysis.weaknesses) &&
                cvAnalysis.weaknesses.length ? (
                  <Box>
                    <Typography fontWeight={700} gutterBottom>
                      Weaknesses
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {cvAnalysis.weaknesses.map((item, idx) => (
                        <Chip
                          key={idx}
                          label={item}
                          color="warning"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                {Array.isArray(cvAnalysis.suggestions) &&
                cvAnalysis.suggestions.length ? (
                  <Box>
                    <Typography fontWeight={700} gutterBottom>
                      Suggestions
                    </Typography>
                    <Stack spacing={1}>
                      {cvAnalysis.suggestions.map((item, idx) => (
                        <Alert key={idx} severity="info">
                          {item}
                        </Alert>
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                {!cvAnalysis.summary &&
                cvAnalysis.score === undefined &&
                !cvAnalysis.strengths?.length &&
                !cvAnalysis.weaknesses?.length &&
                !cvAnalysis.suggestions?.length ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {JSON.stringify(cvAnalysis, null, 2)}
                  </pre>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Profile Details
            </Typography>

            {loading ? (
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ py: 3 }}
              >
                <CircularProgress size={24} />
                <Typography>Loading profile...</Typography>
              </Stack>
            ) : (
              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Title"
                      fullWidth
                      value={profile.title}
                      onChange={handleChange("title")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Seniority"
                      fullWidth
                      value={profile.seniority}
                      onChange={handleChange("seniority")}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Locations (comma separated)"
                      fullWidth
                      value={
                        Array.isArray(profile.locations)
                          ? profile.locations.join(", ")
                          : profile.locations
                      }
                      onChange={handleChange("locations")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Portfolio URL"
                      fullWidth
                      value={profile.links.portfolio || ""}
                      onChange={handleNestedChange("links", "portfolio")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="GitHub URL"
                      fullWidth
                      value={profile.links.github || ""}
                      onChange={handleNestedChange("links", "github")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="LinkedIn URL"
                      fullWidth
                      value={profile.links.linkedin || ""}
                      onChange={handleNestedChange("links", "linkedin")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Work Authorization"
                      fullWidth
                      value={profile.authorization}
                      onChange={handleChange("authorization")}
                    />
                  </Grid>

                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="Salary Expectation"
                      fullWidth
                      type="number"
                      value={profile.salaryExpectation.amount || ""}
                      onChange={handleNestedChange(
                        "salaryExpectation",
                        "amount",
                      )}
                    />
                  </Grid>

                  <Grid item xs={6} sm={3}>
                    <TextField
                      label="Currency"
                      fullWidth
                      value={profile.salaryExpectation.currency || ""}
                      onChange={handleNestedChange(
                        "salaryExpectation",
                        "currency",
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Preferred Roles (comma separated)"
                      fullWidth
                      value={
                        Array.isArray(profile.preferences.roles)
                          ? profile.preferences.roles.join(", ")
                          : profile.preferences.roles
                      }
                      onChange={handlePreferencesChange("roles")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Preferred Industries (comma separated)"
                      fullWidth
                      value={
                        Array.isArray(profile.preferences.industries)
                          ? profile.preferences.industries.join(", ")
                          : profile.preferences.industries
                      }
                      onChange={handlePreferencesChange("industries")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Preferred Companies (comma separated)"
                      fullWidth
                      value={
                        Array.isArray(profile.preferences.companies)
                          ? profile.preferences.companies.join(", ")
                          : profile.preferences.companies
                      }
                      onChange={handlePreferencesChange("companies")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Preferred Cities (comma separated)"
                      fullWidth
                      value={
                        Array.isArray(profile.preferences.cities)
                          ? profile.preferences.cities.join(", ")
                          : profile.preferences.cities
                      }
                      onChange={handlePreferencesChange("cities")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Preferred Salary"
                      fullWidth
                      type="number"
                      value={profile.preferences.salary || ""}
                      onChange={handlePreferencesChange("salary")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!profile.preferences.remoteOnly}
                          onChange={handlePreferencesChange("remoteOnly")}
                        />
                      }
                      label="Remote Only"
                      sx={{ mt: 1 }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={
                        saving ? <CircularProgress size={18} /> : <SaveIcon />
                      }
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Profile"}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

export default Profile;
