import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config.js';
import { PAKISTAN_CITIES } from '../constants/cities.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import '../App.css';

const API_ROOT = API_BASE_URL.replace(/\/$/, '');

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const emptyGround = () => ({
  name: '',
  city: PAKISTAN_CITIES[0] ?? '',
  location: '',
  pricePerHour: '',
  description: '',
  imageUrl: '',
  imagePreview: '',
});

const resolveImageUrl = (raw) => {
  if (!raw) {
    return '';
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return `${API_ROOT}${raw}`;
  }
  return `${API_ROOT}/${raw}`;
};

function AdminPage() {
  const {
    user,
    initializing,
    loginWithGoogle,
    startPhoneSignIn,
    verifyPhoneCode,
    phoneConfirmation,
    logout,
    getIdToken,
    registerWithEmail,
    loginWithEmail,
    sendPasswordReset,
  } = useAuth();

  const [grounds, setGrounds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGround, setNewGround] = useState(emptyGround);
  const [newGroundImage, setNewGroundImage] = useState(null);
  const [groundImageDrafts, setGroundImageDrafts] = useState({});
  const [busyGroundId, setBusyGroundId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authSuccessMessage, setAuthSuccessMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [activeTab, setActiveTab] = useState('stats');
  const totalBookings = stats?.totals?.bookings ?? 0;
  const totalRevenue = stats?.totals?.revenue ?? 0;
  const statsByGround = stats?.byGround ?? [];
  const statsByCity = stats?.byCity ?? [];
  const statsUpcoming = stats?.upcoming ?? [];

  const cityOptions = useMemo(() => {
    const unique = new Set(PAKISTAN_CITIES);
    grounds.forEach((ground) => {
      if (ground.city) {
        unique.add(ground.city);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [grounds]);

  const showFlash = useCallback((type, text) => {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 3200);
  }, []);

  const authorizedFetch = useCallback(
    async (url, options = {}) => {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${idToken}`);

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [getIdToken]
  );

  const handleAuthFailure = useCallback(
    async (response) => {
      if (response.status === 401) {
        await logout().catch(() => {});
        setIsAdmin(false);
        showFlash('error', 'Session expired. Please sign in again.');
        return true;
      }
      if (response.status === 403) {
        setIsAdmin(false);
        showFlash('error', 'This account is not authorized for admin access.');
        return true;
      }
      return false;
    },
    [logout, showFlash]
  );

  const loadGrounds = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await authorizedFetch(`${API_BASE_URL}/api/admin/grounds`);

      if (await handleAuthFailure(response)) {
        return;
      }

      if (!response.ok) {
        throw new Error('Unable to load grounds.');
      }

      const data = await response.json();
      setGrounds(
        data.map((ground) => ({
          id: ground.id,
          name: ground.name ?? '',
          city: ground.city ?? '',
          location: ground.location ?? '',
          pricePerHour: ground.price_per_hour != null ? String(ground.price_per_hour) : '',
          description: ground.description ?? '',
          imageUrl: ground.image_url ?? '',
          imagePreview: resolveImageUrl(ground.image_url),
        }))
      );
    } catch (err) {
      console.error(err);
      showFlash('error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [authorizedFetch, handleAuthFailure, showFlash]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      setStatsError('');
      const response = await authorizedFetch(`${API_BASE_URL}/api/admin/stats`);
      if (await handleAuthFailure(response)) {
        return;
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Unable to load stats.');
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error(error);
      setStats(null);
      setStatsError(error.message || 'Could not load dashboard stats.');
    } finally {
      setStatsLoading(false);
    }
  }, [authorizedFetch, handleAuthFailure]);

  useEffect(() => {
    let active = true;

    const verifyAdminAccess = async () => {
      if (!user) {
        if (active) {
          setIsAdmin(false);
          setCheckingAdmin(false);
          setGrounds([]);
        }
        return;
      }

      setCheckingAdmin(true);
      try {
        const response = await authorizedFetch(`${API_BASE_URL}/api/auth/me`);
        if (await handleAuthFailure(response)) {
          if (active) {
            setCheckingAdmin(false);
          }
          return;
        }
        if (!response.ok) {
          throw new Error('Unable to verify admin access.');
        }
        const profile = await response.json();
        if (active) {
          const adminStatus = Boolean(profile.isAdmin);
          setIsAdmin(adminStatus);
          if (adminStatus) {
            setActiveTab('stats');
            await loadGrounds();
            await loadStats();
          } else {
            setGrounds([]);
            setStats(null);
            showFlash('error', 'This account does not have admin privileges.');
          }
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setIsAdmin(false);
          showFlash('error', error.message || 'Could not verify admin access.');
        }
      } finally {
        if (active) {
          setCheckingAdmin(false);
        }
      }
    };

    verifyAdminAccess();

    return () => {
      active = false;
    };
  }, [user, authorizedFetch, handleAuthFailure, loadGrounds, loadStats, showFlash]);

  useEffect(() => {
    if (isAdmin && activeTab === 'stats' && !statsLoading) {
      loadStats();
    }
  }, [isAdmin, activeTab, loadStats, statsLoading]);

  useEffect(() => {
    if (user) {
      setAuthError('');
      setAuthSuccessMessage('');
      setAuthBusy(false);
      setPhoneNumber('');
      setVerificationCode('');
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthDisplayName('');
      setAuthMode('signin');
    }
  }, [user]);

  const handleGoogleAuth = async () => {
    setAuthError('');
    setAuthSuccessMessage('');
    try {
      setAuthBusy(true);
      await loginWithGoogle();
      setAuthSuccessMessage('Signed in with Google.');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePhoneAuthStart = async () => {
    setAuthError('');
    setAuthSuccessMessage('');
    if (!phoneNumber.trim()) {
      setAuthError('Enter a phone number including country code (e.g., +92...).');
      return;
    }
    try {
      setAuthBusy(true);
      await startPhoneSignIn(phoneNumber.trim());
      setAuthSuccessMessage('Verification code sent. Check your phone.');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Failed to send verification code.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePhoneAuthVerify = async () => {
    setAuthError('');
    setAuthSuccessMessage('');
    if (!verificationCode.trim()) {
      setAuthError('Enter the verification code you received via SMS.');
      return;
    }
    try {
      setAuthBusy(true);
      await verifyPhoneCode(verificationCode.trim());
      setVerificationCode('');
      setPhoneNumber('');
      setAuthSuccessMessage('Phone number verified.');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Could not verify the code. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthSuccessMessage('');

    const email = authEmail.trim();
    const password = authPassword.trim();
    const confirmPassword = authConfirmPassword.trim();
    const displayName = authDisplayName.trim();

    if (!email || !password) {
      setAuthError('Email and password are required.');
      return;
    }

    if (authMode === 'signup' && password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    try {
      setAuthBusy(true);
      if (authMode === 'signup') {
        await registerWithEmail(email, password, displayName);
        setAuthSuccessMessage('Account created. If this email is approved, admin access will unlock automatically.');
      } else {
        await loginWithEmail(email, password);
        setAuthSuccessMessage('Signed in successfully.');
      }
      setAuthPassword('');
      setAuthConfirmPassword('');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAdminPasswordReset = async () => {
    setAuthError('');
    setAuthSuccessMessage('');
    if (!authEmail.trim()) {
      setAuthError('Enter your email to receive a password reset link.');
      return;
    }
    try {
      setAuthBusy(true);
      await sendPasswordReset(authEmail.trim());
      setAuthSuccessMessage('Password reset email sent. Check your inbox.');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Could not send reset email.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleFieldChange = (groundId, field, value) => {
    setGrounds((prev) =>
      prev.map((ground) => {
        if (ground.id !== groundId) {
          return ground;
        }
        return { ...ground, [field]: value };
      })
    );
  };

  const handleGroundImageSelect = (groundId, file) => {
    setGroundImageDrafts((prev) => {
      if (!file) {
        const { [groundId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [groundId]: file };
    });

    setGrounds((prev) =>
      prev.map((ground) => {
        if (ground.id !== groundId) {
          return ground;
        }
        return {
          ...ground,
          imagePreview: file ? URL.createObjectURL(file) : resolveImageUrl(ground.imageUrl),
        };
      })
    );
  };

  const handleNewGroundImageChange = (file) => {
    setNewGroundImage(file || null);
    setNewGround((current) => ({
      ...current,
      imagePreview: file ? URL.createObjectURL(file) : '',
    }));
  };

  const handleTabChange = useCallback(
    (tab) => {
      setActiveTab(tab);
      if (tab === 'stats') {
        loadStats();
      }
    },
    [loadStats]
  );

  const buildGroundFormData = (ground, file) => {
    const formData = new FormData();
    formData.append('name', ground.name.trim());
    formData.append('city', ground.city);
    formData.append('location', ground.location.trim());
    const sanitizedPrice = String(ground.pricePerHour ?? '').replace(/[^0-9.]/g, '');
    formData.append('pricePerHour', sanitizedPrice);
    formData.append('description', (ground.description || '').trim());

    if (file) {
      formData.append('image', file);
    } else if (ground.imageUrl) {
      formData.append('imageUrl', ground.imageUrl);
    }

    return formData;
  };

  async function handleSave(groundId) {
    const ground = grounds.find((item) => item.id === groundId);
    if (!ground) {
      return;
    }

    setBusyGroundId(groundId);
    try {
      const file = groundImageDrafts[groundId];
      const formData = buildGroundFormData(ground, file);
      const response = await authorizedFetch(`${API_BASE_URL}/api/admin/grounds/${groundId}`, {
        method: 'PUT',
        body: formData,
      });

      if (await handleAuthFailure(response)) {
        return;
      }

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Update failed.');
      }

      const updated = await response.json();
      setGrounds((prev) =>
        prev.map((item) =>
          item.id === groundId
            ? {
                id: updated.id,
                name: updated.name ?? '',
                city: updated.city ?? '',
                location: updated.location ?? '',
                pricePerHour:
                  updated.price_per_hour != null ? String(updated.price_per_hour) : '',
                description: updated.description ?? '',
                imageUrl: updated.image_url ?? '',
                imagePreview: resolveImageUrl(updated.image_url),
              }
            : item
        )
      );
      setGroundImageDrafts((prev) => {
        const { [groundId]: _removed, ...rest } = prev;
        return rest;
      });
      showFlash('success', 'Ground details saved.');
    } catch (err) {
      console.error(err);
      showFlash('error', err.message);
    } finally {
      setBusyGroundId(null);
    }
  }

  async function handleDelete(groundId) {
    if (!window.confirm('Delete this ground? This cannot be undone.')) {
      return;
    }

    setBusyGroundId(groundId);
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/api/admin/grounds/${groundId}`, {
        method: 'DELETE',
      });

      if (await handleAuthFailure(response)) {
        return;
      }

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Delete failed.');
      }

      setGrounds((prev) => prev.filter((ground) => ground.id !== groundId));
      setGroundImageDrafts((prev) => {
        const { [groundId]: _removed, ...rest } = prev;
        return rest;
      });
      showFlash('success', 'Ground removed.');
    } catch (err) {
      console.error(err);
      showFlash('error', err.message);
    } finally {
      setBusyGroundId(null);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (!newGroundImage) {
      showFlash('error', 'Upload a ground photo before saving.');
      return;
    }

    setIsCreating(true);
    try {
      const formData = buildGroundFormData(newGround, newGroundImage);
      const response = await authorizedFetch(`${API_BASE_URL}/api/admin/grounds`, {
        method: 'POST',
        body: formData,
      });

      if (await handleAuthFailure(response)) {
        return;
      }

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Create ground failed.');
      }

      const created = await response.json();
      setGrounds((prev) => [
        {
          id: created.id,
          name: created.name ?? '',
          city: created.city ?? '',
          location: created.location ?? '',
          pricePerHour: created.price_per_hour != null ? String(created.price_per_hour) : '',
          description: created.description ?? '',
          imageUrl: created.image_url ?? '',
          imagePreview: resolveImageUrl(created.image_url),
        },
        ...prev,
      ]);
      setNewGround(emptyGround());
      setNewGroundImage(null);
      showFlash('success', 'New ground added.');
    } catch (err) {
      console.error(err);
      showFlash('error', err.message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="admin">
      <header className="admin__hero">
        <div className="admin__hero-content">
          <p className="hero__eyebrow">Control Room</p>
          <h1>Ground inventory dashboard</h1>
          <p className="hero__tagline">
            Add new venues, refresh copy and keep pricing current. Public bookings update instantly.
          </p>
          <p className="admin__back">
            <Link to="/">← Back to customer site</Link>
          </p>
        </div>
        {user ? (
          <button className="ghost-button" type="button" onClick={() => logout()}>
            Log out
          </button>
        ) : null}
      </header>

      <main className="admin__body">
        {flash && (
          <div className={`flash-message flash-message--${flash.type}`} role="status">
            {flash.text}
          </div>
        )}

        {!user ? (
          <section className="admin-card admin-login">
            <h2>Admin sign in</h2>
            <p className="admin-login__intro">
              Sign in with an approved email address or phone number to manage the grounds catalogue.
            </p>
            {authError && <p className="form-error">{authError}</p>}
            {authSuccessMessage && <p className="auth-message">{authSuccessMessage}</p>}

            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === 'signin' ? 'auth-tab--active' : ''}`}
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                  setAuthSuccessMessage('');
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === 'signup' ? 'auth-tab--active' : ''}`}
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                  setAuthSuccessMessage('');
                }}
              >
                Create account
              </button>
            </div>

            <form className="admin-login__form" onSubmit={handleEmailAuthSubmit}>
              {authMode === 'signup' && (
                <label>
                  Full name
                  <input
                    type="text"
                    value={authDisplayName}
                    onChange={(event) => setAuthDisplayName(event.target.value)}
                    placeholder="Your name"
                    disabled={authBusy}
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={authBusy}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  disabled={authBusy}
                />
              </label>
              {authMode === 'signup' && (
                <label>
                  Confirm password
                  <input
                    type="password"
                    value={authConfirmPassword}
                    onChange={(event) => setAuthConfirmPassword(event.target.value)}
                    placeholder="Re-enter password"
                    required
                    disabled={authBusy}
                  />
                </label>
              )}
              <button type="submit" className="auth-button auth-button--primary" disabled={authBusy}>
                {authMode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            {authMode === 'signin' && (
              <button
                type="button"
                className="link-button"
                onClick={handleAdminPasswordReset}
                disabled={authBusy}
              >
                Send password reset email
              </button>
            )}

            <div className="auth-divider">
              <span>or continue with</span>
            </div>

            <button
              type="button"
              className="auth-button auth-button--google"
              onClick={handleGoogleAuth}
              disabled={authBusy || initializing}
            >
              <span className="auth-button__icon auth-button__icon--google" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M12 5c1.7 0 3.2.6 4.4 1.7l3.2-3.2C17.6 1.3 15 0 12 0 7.3 0 3.2 2.7 1.2 6.6l3.7 2.9C5.9 7.1 8.7 5 12 5z" fill="#EA4335"/>
                  <path d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.6-1.2 3-2.6 4l3.6 2.8c2.1-1.9 3.3-4.7 3.3-8.9z" fill="#4285F4"/>
                  <path d="M4.9 14.5C4.6 13.6 4.4 12.8 4.4 12s.2-1.6.5-2.4L1.2 6.6C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l3.7-2.9z" fill="#FBBC04"/>
                  <path d="M12 24c3 0 5.6-1 7.5-2.8l-3.6-2.8c-1 .7-2.3 1.2-3.9 1.2-3 0-5.6-2-6.5-4.8L1.2 17.4C3.2 21.3 7.3 24 12 24z" fill="#34A853"/>
                </svg>
              </span>
              <span className="auth-button__label">Google</span>
            </button>

            <div className="auth-phone">
              <label>
                Phone number
                <input
                  type="tel"
                  placeholder="+92 3XX XXXXXXX"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  disabled={authBusy || Boolean(phoneConfirmation)}
                />
              </label>
              {phoneConfirmation ? (
                <>
                  <label>
                    Verification code
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      disabled={authBusy}
                    />
                  </label>
                  <button
                    type="button"
                    className="auth-button auth-button--primary"
                    onClick={handlePhoneAuthVerify}
                    disabled={authBusy || !verificationCode.trim()}
                  >
                    Verify &amp; enter dashboard
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="auth-button auth-button--primary"
                  onClick={handlePhoneAuthStart}
                  disabled={authBusy || !phoneNumber.trim()}
                >
                  Send verification code
                </button>
              )}
            </div>

            <p className="auth-hint">
              Approved admin emails are configured in the server `ADMIN_EMAILS` list.
            </p>
          </section>
        ) : checkingAdmin ? (
          <section className="admin-card">
            <h2>Checking access…</h2>
            <p className="status status--muted">Verifying your admin permissions.</p>
          </section>
        ) : !isAdmin ? (
          <section className="admin-card admin-login">
            <h2>Admin access required</h2>
            <p className="auth-hint">
              This account is signed in but is not on the approved admin list.
            </p>
            <button
              type="button"
              className="auth-button auth-button--secondary"
              onClick={() => logout()}
            >
              Sign out
            </button>
          </section>        ) : (
          <>
            <div className="admin-tabs">
              <button
                type="button"
                className={`admin-tab ${activeTab === 'stats' ? 'admin-tab--active' : ''}`}
                onClick={() => handleTabChange('stats')}
              >
                Stats overview
              </button>
              <button
                type="button"
                className={`admin-tab ${activeTab === 'venues' ? 'admin-tab--active' : ''}`}
                onClick={() => handleTabChange('venues')}
              >
                Grounds & bookings
              </button>
            </div>

            {activeTab === 'stats' && (
              <section className="admin-card admin-stats">
                <h2>Dashboard</h2>
                {statsLoading ? (
                  <p className="status">Fetching latest metrics…</p>
                ) : statsError ? (
                  <p className="form-error">{statsError}</p>
                ) : stats ? (
                  <>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <p className="stat-label">Total bookings</p>
                        <p className="stat-value">{totalBookings}</p>
                      </div>
                      <div className="stat-card">
                        <p className="stat-label">Total revenue</p>
                        <p className="stat-value">{formatCurrency(totalRevenue)}</p>
                      </div>
                      <div className="stat-card">
                        <p className="stat-label">Active grounds</p>
                        <p className="stat-value">{grounds.length}</p>
                      </div>
                      <div className="stat-card">
                        <p className="stat-label">Cities covered</p>
                        <p className="stat-value">{new Set(grounds.map((g) => g.city)).size}</p>
                      </div>
                    </div>

                    <div className="stats-tables">
                      <div className="stats-table">
                        <div className="stats-table__header">
                          <h3>Performance by ground</h3>
                          <span className="stats-table__caption">Bookings · Revenue</span>
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th>Ground</th>
                              <th>City</th>
                              <th>Bookings</th>
                              <th>Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statsByGround.map((row) => (
                              <tr key={row.groundId}>
                                <td>{row.groundName}</td>
                                <td>{row.city}</td>
                                <td>{row.bookingCount}</td>
                                <td>{formatCurrency(row.revenue)}</td>
                              </tr>
                            ))}
                            {!statsByGround.length && (
                              <tr>
                                <td colSpan={4} className="status status--muted">No bookings yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="stats-table">
                        <div className="stats-table__header">
                          <h3>Bookings by city</h3>
                          <span className="stats-table__caption">Demand by location</span>
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th>City</th>
                              <th>Bookings</th>
                              <th>Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statsByCity.map((row) => (
                              <tr key={row.city}>
                                <td>{row.city}</td>
                                <td>{row.bookingCount}</td>
                                <td>{formatCurrency(row.revenue)}</td>
                              </tr>
                            ))}
                            {!statsByCity.length && (
                              <tr>
                                <td colSpan={3} className="status status--muted">No city data available.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="stats-table">
                      <div className="stats-table__header">
                        <h3>Upcoming bookings</h3>
                        <span className="stats-table__caption">Next confirmed sessions</span>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Slot</th>
                            <th>Ground</th>
                            <th>City</th>
                            <th>Customer</th>
                            <th>Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statsUpcoming.map((row) => (
                            <tr key={row.id}>
                              <td>{row.date}</td>
                              <td>{row.slot}</td>
                              <td>{row.groundName}</td>
                              <td>{row.city}</td>
                              <td>{row.customerName}</td>
                              <td>{row.customerPhone}</td>
                            </tr>
                          ))}
                          {!statsUpcoming.length && (
                            <tr>
                              <td colSpan={6} className="status status--muted">No upcoming bookings on the calendar.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="status status--muted">No stats available yet.</p>
                )}
              </section>
            )}

            {activeTab === 'venues' && (
              <>
                <section className="admin-card">
                  <h2>Create a new ground</h2>
                  <form className="admin-form" onSubmit={handleCreate}>
                    <div className="admin-form__row">
                      <label>
                        Name
                        <input
                          required
                          value={newGround.name}
                          onChange={(event) =>
                            setNewGround((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="Stadium name"
                        />
                      </label>
                      <label>
                        City
                        <select
                          value={newGround.city}
                          onChange={(event) =>
                            setNewGround((current) => ({ ...current, city: event.target.value }))
                          }
                        >
                          {cityOptions.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Location
                        <input
                          required
                          value={newGround.location}
                          onChange={(event) =>
                            setNewGround((current) => ({ ...current, location: event.target.value }))
                          }
                          placeholder="Area / neighborhood"
                        />
                      </label>
                    </div>
                    <div className="admin-form__row">
                      <label>
                        Price / hour (PKR)
                        <input
                          required
                          type="number"
                          min="0"
                          step="100"
                          value={newGround.pricePerHour}
                          onChange={(event) =>
                            setNewGround((current) => ({ ...current, pricePerHour: event.target.value }))
                          }
                          placeholder="12000"
                        />
                      </label>
                      <label className="file-upload">
                        Ground photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            handleNewGroundImageChange(file);
                          }}
                        />
                      </label>
                    </div>
                    {newGround.imagePreview ? (
                      <div className="admin-image-preview">
                        <img src={newGround.imagePreview} alt="New ground preview" />
                      </div>
                    ) : null}
                    <label>
                      Description
                      <textarea
                        rows={3}
                        value={newGround.description}
                        onChange={(event) =>
                          setNewGround((current) => ({ ...current, description: event.target.value }))
                        }
                        placeholder="Highlight surface, floodlights, parking, etc."
                      />
                    </label>
                    <button className="primary-button" type="submit" disabled={isCreating}>
                      {isCreating ? 'Adding…' : 'Add ground'}
                    </button>
                  </form>
                </section>

                <section className="admin-card">
                  <div className="admin-card__header">
                    <h2>Existing grounds</h2>
                    {isLoading ? <span className="status">Refreshing…</span> : null}
                  </div>

                  {grounds.length === 0 ? (
                    <p className="status status--muted">
                      No grounds yet. Add your first venue using the form above.
                    </p>
                  ) : (
                    <div className="admin-ground-list">
                      {grounds.map((ground) => (
                        <div className="admin-ground" key={ground.id}>
                          <div className="admin-ground__header">
                            <h3>#{ground.id}</h3>
                            <div className="admin-ground__actions">
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => handleSave(ground.id)}
                                disabled={busyGroundId === ground.id}
                              >
                                {busyGroundId === ground.id ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => handleDelete(ground.id)}
                                disabled={busyGroundId === ground.id}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="admin-form admin-ground__form">
                            <div className="admin-ground__media">
                              {ground.imagePreview ? (
                                <img
                                  src={ground.imagePreview}
                                  alt={`${ground.name} preview`}
                                  className="admin-ground__image"
                                />
                              ) : (
                                <div className="admin-ground__placeholder">No photo yet</div>
                              )}
                              <label className="file-upload">
                                Update photo
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    handleGroundImageSelect(ground.id, file);
                                  }}
                                />
                              </label>
                            </div>
                            <div className="admin-form__row">
                              <label>
                                Name
                                <input
                                  required
                                  value={ground.name}
                                  onChange={(event) =>
                                    handleFieldChange(ground.id, 'name', event.target.value)
                                  }
                                />
                              </label>
                              <label>
                                City
                                <select
                                  value={ground.city}
                                  onChange={(event) =>
                                    handleFieldChange(ground.id, 'city', event.target.value)
                                  }
                                >
                                  <option value="">Select city</option>
                                  {cityOptions.map((city) => (
                                    <option key={city} value={city}>
                                      {city}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Location
                                <input
                                  required
                                  value={ground.location}
                                  onChange={(event) =>
                                    handleFieldChange(ground.id, 'location', event.target.value)
                                  }
                                />
                              </label>
                            </div>
                            <label>
                              Price / hour (PKR)
                              <input
                                required
                                type="number"
                                min="0"
                                step="100"
                                value={ground.pricePerHour}
                                onChange={(event) =>
                                  handleFieldChange(ground.id, 'pricePerHour', event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Description
                              <textarea
                                rows={3}
                                value={ground.description}
                                onChange={(event) =>
                                  handleFieldChange(ground.id, 'description', event.target.value)
                                }
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )
          </>
        )}
      </main>
    </div>
  );
}

export default AdminPage;
