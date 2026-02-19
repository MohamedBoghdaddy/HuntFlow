import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
} from '@mui/material';
import api from '../api/api';

/**
 * Profile page allows the user to view and update their professional
 * details. For simplicity, list-type fields (locations, roles, etc.)
 * are represented as comma-separated strings and converted back to
 * arrays on save.
 */
function Profile() {
  const [profile, setProfile] = useState({
    title: '',
    seniority: '',
    locations: [],
    links: { portfolio: '', github: '', linkedin: '' },
    authorization: '',
    salaryExpectation: { amount: '', currency: '' },
    preferences: {
      roles: [],
      industries: [],
      companies: [],
      salary: '',
      remoteOnly: false,
      cities: [],
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await api.get('/profile');
        setProfile({
          title: res.data.profile.title || '',
          seniority: res.data.profile.seniority || '',
          locations: res.data.profile.locations || [],
          links: res.data.profile.links || { portfolio: '', github: '', linkedin: '' },
          authorization: res.data.profile.authorization || '',
          salaryExpectation: res.data.profile.salaryExpectation || { amount: '', currency: '' },
          preferences: res.data.profile.preferences || {
            roles: [],
            industries: [],
            companies: [],
            salary: '',
            remoteOnly: false,
            cities: [],
          },
        });
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

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
    setProfile((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: e.target.value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Convert comma-separated strings to arrays
      const payload = {
        ...profile,
        locations: typeof profile.locations === 'string' ? profile.locations.split(',').map((s) => s.trim()).filter(Boolean) : profile.locations,
        preferences: {
          ...profile.preferences,
          roles:
            typeof profile.preferences.roles === 'string'
              ? profile.preferences.roles.split(',').map((s) => s.trim()).filter(Boolean)
              : profile.preferences.roles,
          industries:
            typeof profile.preferences.industries === 'string'
              ? profile.preferences.industries.split(',').map((s) => s.trim()).filter(Boolean)
              : profile.preferences.industries,
          companies:
            typeof profile.preferences.companies === 'string'
              ? profile.preferences.companies.split(',').map((s) => s.trim()).filter(Boolean)
              : profile.preferences.companies,
          cities:
            typeof profile.preferences.cities === 'string'
              ? profile.preferences.cities.split(',').map((s) => s.trim()).filter(Boolean)
              : profile.preferences.cities,
        },
      };
      await api.put('/profile', payload);
      alert('Profile updated successfully');
    } catch (err) {
      console.error('Failed to update profile', err);
      alert(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>
      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Title"
                fullWidth
                value={profile.title}
                onChange={handleChange('title')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Seniority"
                fullWidth
                value={profile.seniority}
                onChange={handleChange('seniority')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Locations (comma separated)"
                fullWidth
                value={Array.isArray(profile.locations) ? profile.locations.join(', ') : profile.locations}
                onChange={handleChange('locations')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Portfolio URL"
                fullWidth
                value={profile.links.portfolio || ''}
                onChange={handleNestedChange('links', 'portfolio')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="GitHub URL"
                fullWidth
                value={profile.links.github || ''}
                onChange={handleNestedChange('links', 'github')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="LinkedIn URL"
                fullWidth
                value={profile.links.linkedin || ''}
                onChange={handleNestedChange('links', 'linkedin')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Work Authorization"
                fullWidth
                value={profile.authorization}
                onChange={handleChange('authorization')}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Salary Expectation"
                fullWidth
                type="number"
                value={profile.salaryExpectation.amount || ''}
                onChange={handleNestedChange('salaryExpectation', 'amount')}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Currency"
                fullWidth
                value={profile.salaryExpectation.currency || ''}
                onChange={handleNestedChange('salaryExpectation', 'currency')}
              />
            </Grid>
            {/* Preferences fields */}
            <Grid item xs={12} sm={4}>
              <TextField
                label="Preferred Roles (comma separated)"
                fullWidth
                value={Array.isArray(profile.preferences.roles) ? profile.preferences.roles.join(', ') : profile.preferences.roles}
                onChange={handlePreferencesChange('roles')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Preferred Industries (comma separated)"
                fullWidth
                value={Array.isArray(profile.preferences.industries)
                  ? profile.preferences.industries.join(', ')
                  : profile.preferences.industries}
                onChange={handlePreferencesChange('industries')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Preferred Companies (comma separated)"
                fullWidth
                value={Array.isArray(profile.preferences.companies)
                  ? profile.preferences.companies.join(', ')
                  : profile.preferences.companies}
                onChange={handlePreferencesChange('companies')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Preferred Cities (comma separated)"
                fullWidth
                value={Array.isArray(profile.preferences.cities)
                  ? profile.preferences.cities.join(', ')
                  : profile.preferences.cities}
                onChange={handlePreferencesChange('cities')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Preferred Salary"
                fullWidth
                type="number"
                value={profile.preferences.salary || ''}
                onChange={handlePreferencesChange('salary')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Remote Only (true/false)"
                fullWidth
                value={profile.preferences.remoteOnly?.toString()}
                onChange={handlePreferencesChange('remoteOnly')}
              />
            </Grid>
            <Grid item xs={12}>
              <Button type="submit" variant="contained" color="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </Grid>
          </Grid>
        </form>
      )}
    </Container>
  );
}

export default Profile;