import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../../config.js';
import { PAKISTAN_CITIES } from '../../../constants/cities.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import OperatingHoursConfigurator from '../components/OperatingHoursConfigurator.jsx';
import '../../../App.css';

const API_ROOT = API_BASE_URL.replace(/\/$/, '');

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const SPORT_CATEGORIES = [
  'Football',
  'Cricket',
  'Padel',
  'Futsal',
  'Hockey',
  'Basketball',
  'Tennis',
  'Badminton',
];

const GROUND_FEATURES = {
  'Surface': ['Artificial Turf', 'Natural Grass', 'Concrete', 'Astroturf', 'Wooden'],
  'Venue Type': ['Covered', 'Partially Covered', 'Open'],
  'Amenities': [
    'Flood Lights',
    'Parking',
    'Changing Rooms',
    'Washrooms',
    'Drinking Water',
    'Cafeteria',
    'Drinks Shop',
    'Seating Area',
    'First Aid',
    'Equipment Rental',
  ],
};

const emptyGround = () => ({
  name: '',
  city: PAKISTAN_CITIES[0] ?? '',
  location: '',
  pricePerHour: '',
  description: '',
  imageUrl: '',
  imagePreview: '',
  category: '',
  features: {},
  gallery: [],
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
  const [galleryBusy, setGalleryBusy] = useState({});
  const [busyGroundId, setBusyGroundId] = useState(null);
  const operatingHoursRefs = useRef({});
  const [expandedGroundId, setExpandedGroundId] = useState(null);
  const [expandedSubsections, setExpandedSubsections] = useState({});
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

  const isGalleryBusy = (groundId) => Boolean(galleryBusy[groundId]);

  const setGalleryBusyState = useCallback((groundId, value) => {
    setGalleryBusy((prev) => {
      if (value) {
        return { ...prev, [groundId]: true };
      }
      const { [groundId]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const mapFeaturesFromDetail = useCallback((featuresArray = []) => {
    if (!Array.isArray(featuresArray)) {
      return {};
    }

    const features = {};
    featuresArray.forEach((feature) => {
      if (!feature) {
        return;
      }
      const category = feature.category || 'General';
      if (!features[category]) {
        features[category] = [];
      }
      if (Array.isArray(features[category])) {
        features[category].push(feature.feature_name);
      }
    });

    ['Surface', 'Venue Type'].forEach((category) => {
      if (Array.isArray(features[category]) && features[category].length > 0) {
        features[category] = features[category][0];
      }
    });

    return features;
  }, []);

  const normalizeGallery = useCallback((images = []) => {
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .map((image) => {
        if (!image) {
          return null;
        }
        const path = image.imageUrl ?? image.image_url ?? '';
        if (!path) {
          return null;
        }
        return {
          id: image.id,
          imageUrl: path,
          displayOrder: image.displayOrder ?? image.display_order ?? 0,
          preview: resolveImageUrl(path),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return a.id - b.id;
      });
  }, []);

  const refreshGroundFromDetail = useCallback(
    async (groundId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/grounds/${groundId}`);
        if (!response.ok) {
          return;
        }
        const details = await response.json();
        setGrounds((prev) =>
          prev.map((ground) => {
            if (ground.id !== groundId) {
              return ground;
            }
            return {
              ...ground,
              name: details.name ?? ground.name,
              city: details.city ?? ground.city,
              location: details.location ?? ground.location,
              pricePerHour:
                details.price_per_hour != null
                  ? String(details.price_per_hour)
                  : ground.pricePerHour,
              description: details.description ?? ground.description,
              imageUrl: details.image_url ?? '',
              imagePreview: details.image_url ? resolveImageUrl(details.image_url) : '',
              category: details.category ?? ground.category,
              features: mapFeaturesFromDetail(details.features),
              gallery: normalizeGallery(details.images),
            };
          })
        );
      } catch (error) {
        console.error(error);
      }
    },
    [mapFeaturesFromDetail, normalizeGallery]
  );

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

  const toggleSubsection = (groundId, subsection) => {
    const key = `${groundId}-${subsection}`;
    setExpandedSubsections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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

      // Load features for each ground
      const groundsWithDetails = await Promise.all(
        data.map(async (ground) => {
          try {
            const detailRes = await fetch(`${API_BASE_URL}/api/grounds/${ground.id}`);
            if (detailRes.ok) {
              const details = await detailRes.json();
              return {
                ...ground,
                category: details.category ?? ground.category ?? '',
                features: mapFeaturesFromDetail(details.features),
                image_url: details.image_url ?? ground.image_url ?? '',
                price_per_hour: details.price_per_hour ?? ground.price_per_hour,
                description: details.description ?? ground.description,
                gallery: details.images,
              };
            }
          } catch (e) {
            console.error(e);
          }
          return ground;
        })
      );

      setGrounds(
        groundsWithDetails.map((ground) => ({
          id: ground.id,
          name: ground.name ?? '',
          city: ground.city ?? '',
          location: ground.location ?? '',
          pricePerHour: ground.price_per_hour != null ? String(ground.price_per_hour) : '',
          description: ground.description ?? '',
          imageUrl: ground.image_url ?? '',
          imagePreview: ground.image_url ? resolveImageUrl(ground.image_url) : '',
          category: ground.category ?? '',
          features:
            ground.features && !Array.isArray(ground.features)
              ? ground.features
              : mapFeaturesFromDetail(ground.features),
          gallery: normalizeGallery(ground.gallery ?? ground.images ?? []),
        }))
      );
    } catch (err) {
      console.error(err);
      showFlash('error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [authorizedFetch, handleAuthFailure, mapFeaturesFromDetail, normalizeGallery, showFlash]);

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

    if (ground.category) {
      formData.append('category', ground.category);
    }

    // Convert features object to array format for the API
    if (ground.features && Object.keys(ground.features).length > 0) {
      const featuresArray = [];
      Object.entries(ground.features).forEach(([category, values]) => {
        if (Array.isArray(values)) {
          values.forEach((value) => {
            featuresArray.push({ name: value, category });
          });
        } else if (values) {
          featuresArray.push({ name: values, category });
        }
      });
      formData.append('features', JSON.stringify(featuresArray));
    }

    if (file) {
      formData.append('image', file);
    } else if (ground.imageUrl) {
      formData.append('imageUrl', ground.imageUrl);
    }

    return formData;
  };

  const saveOperatingHours = async (groundId) => {
    const ohRef = operatingHoursRefs.current[groundId];
    if (!ohRef || !ohRef.getOperatingHoursData) {
      return; // No changes to save
    }

    const hoursData = ohRef.getOperatingHoursData();
    if (!hoursData || hoursData.length === 0) {
      return;
    }

    try {
      const response = await authorizedFetch(
        `${API_BASE_URL}/api/operating-hours/ground/${groundId}/batch`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ hours: hoursData }),
        }
      );

      if (await handleAuthFailure(response)) {
        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save operating hours.');
      }

      return true;
    } catch (err) {
      console.error('Operating hours save error:', err);
      throw err;
    }
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
                ...item,
                name: updated.name ?? '',
                city: updated.city ?? '',
                location: updated.location ?? '',
                pricePerHour:
                  updated.price_per_hour != null ? String(updated.price_per_hour) : '',
                description: updated.description ?? '',
                imageUrl: updated.image_url ?? '',
                imagePreview: updated.image_url ? resolveImageUrl(updated.image_url) : '',
                category: updated.category ?? item.category ?? '',
                gallery: normalizeGallery(updated.images),
              }
            : item
        )
      );
      setGroundImageDrafts((prev) => {
        const { [groundId]: _removed, ...rest } = prev;
        return rest;
      });

      // Save operating hours if any changes were made
      try {
        await saveOperatingHours(groundId);
      } catch (ohErr) {
        console.error('Could not save operating hours:', ohErr);
        showFlash('warning', 'Ground saved, but operating hours failed. Please retry operating hours.');
        return;
      }

      showFlash('success', 'Ground details and operating hours saved.');
    } catch (err) {
      console.error(err);
      showFlash('error', err.message);
    } finally {
      setBusyGroundId(null);
    }
  }

  const handleGalleryUpload = async (groundId, fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) {
      return;
    }

    setGalleryBusyState(groundId, true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        const response = await authorizedFetch(`${API_BASE_URL}/api/admin/grounds/${groundId}/images`, {
          method: 'POST',
          body: formData,
        });

        if (await handleAuthFailure(response)) {
          return;
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Image upload failed.');
        }

        const data = await response.json();
        uploaded.push(data);
      }

      await refreshGroundFromDetail(groundId);

      if (uploaded.length > 0) {
        showFlash('success', `Added ${uploaded.length} new photo${uploaded.length === 1 ? '' : 's'}.`);
      }
    } catch (error) {
      console.error(error);
      showFlash('error', error.message || 'Could not upload image.');
    } finally {
      setGalleryBusyState(groundId, false);
    }
  };

  const handleGalleryDelete = async (groundId, imageId) => {
    if (!window.confirm('Remove this photo from the gallery?')) {
      return;
    }

    setGalleryBusyState(groundId, true);
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/api/admin/grounds/${groundId}/images/${imageId}`, {
        method: 'DELETE',
      });

      if (await handleAuthFailure(response)) {
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Delete failed.');
      }

      await refreshGroundFromDetail(groundId);
      showFlash('success', 'Photo removed.');
    } catch (error) {
      console.error(error);
      showFlash('error', error.message || 'Could not remove photo.');
    } finally {
      setGalleryBusyState(groundId, false);
    }
  };

  const handleGalleryMove = async (groundId, imageId, direction) => {
    const ground = grounds.find((item) => item.id === groundId);
    if (!ground || !ground.gallery || ground.gallery.length < 2) {
      return;
    }

    const currentIndex = ground.gallery.findIndex((image) => image.id === imageId);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= ground.gallery.length) {
      return;
    }

    const reordered = [...ground.gallery];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const order = reordered.map((image) => image.id);

    setGalleryBusyState(groundId, true);
    try {
      const response = await authorizedFetch(`${API_BASE_URL}/api/admin/grounds/${groundId}/images/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order }),
      });

      if (await handleAuthFailure(response)) {
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Reorder failed.');
      }

      const result = await response.json();
      setGrounds((prev) =>
        prev.map((item) =>
          item.id === groundId
            ? { ...item, gallery: normalizeGallery(result.images) }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      showFlash('error', error.message || 'Could not reorder images.');
      await refreshGroundFromDetail(groundId);
    } finally {
      setGalleryBusyState(groundId, false);
    }
  };

  const handleSetCover = async (groundId, imageUrl) => {
    const ground = grounds.find((item) => item.id === groundId);
    if (!ground) {
      return;
    }

    setGalleryBusyState(groundId, true);
    try {
      const formData = buildGroundFormData({ ...ground, imageUrl }, null);
      const response = await authorizedFetch(`${API_BASE_URL}/api/admin/grounds/${groundId}`, {
        method: 'PUT',
        body: formData,
      });

      if (await handleAuthFailure(response)) {
        return;
      }

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Unable to set cover photo.');
      }

      const updated = await response.json();
      setGrounds((prev) =>
        prev.map((item) =>
          item.id === groundId
            ? {
                ...item,
                imageUrl: updated.image_url ?? '',
                imagePreview: updated.image_url ? resolveImageUrl(updated.image_url) : '',
                gallery: normalizeGallery(updated.images),
              }
            : item
        )
      );
      showFlash('success', 'Cover photo updated.');
    } catch (error) {
      console.error(error);
      showFlash('error', error.message || 'Could not set cover photo.');
    } finally {
      setGalleryBusyState(groundId, false);
    }
  };

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
          imagePreview: created.image_url ? resolveImageUrl(created.image_url) : '',
          category: created.category ?? '',
          features: mapFeaturesFromDetail(created.features),
          gallery: normalizeGallery(created.images),
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
          </section>
        ) : (
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
                <div className="admin-card__header">
                  <h2>Dashboard overview</h2>
                  {statsLoading ? (
                    <span className="status">Refreshing…</span>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={loadStats}
                      disabled={statsLoading}
                    >
                      Refresh stats
                    </button>
                  )}
                </div>
                {statsLoading ? (
                  <p className="status">Fetching latest metrics…</p>
                ) : statsError ? (
                  <p className="form-error">{statsError}</p>
                ) : stats ? (
                  <>
                    <div className="stats-grid">
                      <div className="stat-card stat-card--primary">
                        <div className="stat-card__icon">📊</div>
                        <div className="stat-card__content">
                          <p className="stat-label">Total bookings</p>
                          <p className="stat-value">{totalBookings}</p>
                        </div>
                      </div>
                      <div className="stat-card stat-card--success">
                        <div className="stat-card__icon">💰</div>
                        <div className="stat-card__content">
                          <p className="stat-label">Total revenue</p>
                          <p className="stat-value">{formatCurrency(totalRevenue)}</p>
                          {totalBookings > 0 && (
                            <p className="stat-meta">
                              Avg: {formatCurrency(totalRevenue / totalBookings)}/booking
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="stat-card stat-card--info">
                        <div className="stat-card__icon">🏟️</div>
                        <div className="stat-card__content">
                          <p className="stat-label">Active grounds</p>
                          <p className="stat-value">{grounds.length}</p>
                        </div>
                      </div>
                      <div className="stat-card stat-card--warning">
                        <div className="stat-card__icon">📍</div>
                        <div className="stat-card__content">
                          <p className="stat-label">Cities covered</p>
                          <p className="stat-value">{new Set(grounds.map((g) => g.city)).size}</p>
                        </div>
                      </div>
                    </div>

                    <div className="stats-tables">
                      <div className="stats-table">
                        <div className="stats-table__header">
                          <h3>Performance by ground</h3>
                          <span className="stats-table__caption">Sorted by total bookings</span>
                        </div>
                        <div className="stats-table__scroll">
                          <table>
                            <thead>
                              <tr>
                                <th align="left">Ground</th>
                                <th align="left">City</th>
                                <th align="right">Bookings</th>
                                <th align="right">Revenue</th>
                                <th align="right">Avg/Booking</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statsByGround.map((row, index) => (
                                <tr key={row.groundId}>
                                  <td>
                                    {index === 0 && row.bookingCount > 0 && (
                                      <>
                                        <span className="badge badge--success">Top</span>{' '}
                                      </>
                                    )}
                                    {row.groundName}
                                  </td>
                                  <td>{row.city}</td>
                                  <td align="right"><strong>{row.bookingCount}</strong></td>
                                  <td align="right">{formatCurrency(row.revenue)}</td>
                                  <td align="right" className="muted">
                                    {row.bookingCount > 0
                                      ? formatCurrency(row.revenue / row.bookingCount)
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                              {!statsByGround.length && (
                                <tr>
                                  <td colSpan={5} className="status status--muted">No bookings yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="stats-table">
                        <div className="stats-table__header">
                          <h3>Bookings by city</h3>
                          <span className="stats-table__caption">Regional demand analysis</span>
                        </div>
                        <div className="stats-table__scroll">
                          <table>
                            <thead>
                              <tr>
                                <th align="left">City</th>
                                <th align="right">Bookings</th>
                                <th align="right">Revenue</th>
                                <th align="right">Share</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statsByCity.map((row, index) => (
                                <tr key={row.city}>
                                  <td>
                                    {index === 0 && row.bookingCount > 0 && (
                                      <>
                                        <span className="badge badge--info">Lead</span>{' '}
                                      </>
                                    )}
                                    {row.city}
                                  </td>
                                  <td align="right"><strong>{row.bookingCount}</strong></td>
                                  <td align="right">{formatCurrency(row.revenue)}</td>
                                  <td align="right" className="muted">
                                    {totalRevenue > 0
                                      ? `${Math.round((row.revenue / totalRevenue) * 100)}%`
                                      : '0%'}
                                  </td>
                                </tr>
                              ))}
                              {!statsByCity.length && (
                                <tr>
                                  <td colSpan={4} className="status status--muted">No city data available.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="stats-table stats-table--full">
                      <div className="stats-table__header">
                        <h3>Upcoming bookings</h3>
                        <span className="stats-table__caption">Next 20 confirmed sessions</span>
                      </div>
                      <div className="stats-table__scroll">
                        <table>
                          <thead>
                            <tr>
                              <th align="left">Date</th>
                              <th align="left">Time</th>
                              <th align="left">Ground</th>
                              <th align="left">City</th>
                              <th align="left">Customer</th>
                              <th align="left">Phone</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statsUpcoming.map((row) => {
                              const isToday = row.date === new Date().toISOString().split('T')[0];
                              return (
                                <tr key={row.id} className={isToday ? 'highlight' : ''}>
                                  <td>
                                    {isToday && (
                                      <>
                                        <span className="badge badge--warning">Today</span>{' '}
                                      </>
                                    )}
                                    {new Date(row.date).toLocaleDateString('en-PK', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </td>
                                  <td><strong>{row.slot}</strong></td>
                                  <td>{row.groundName}</td>
                                  <td className="muted">{row.city}</td>
                                  <td>{row.customerName}</td>
                                  <td className="muted">{row.customerPhone}</td>
                                </tr>
                              );
                            })}
                            {!statsUpcoming.length && (
                              <tr>
                                <td colSpan={6} className="status status--muted">No upcoming bookings on the calendar.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
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

                    <div className="admin-form__row">
                      <label>
                        Sport Category
                        <select
                          required
                          value={newGround.category}
                          onChange={(event) =>
                            setNewGround((current) => ({ ...current, category: event.target.value }))
                          }
                        >
                          <option value="">Select sport...</option>
                          {SPORT_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="features-section" style={{
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '0.75rem',
                      padding: '10px',
                      marginBottom: '16px',
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.5))',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <h3 style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</h3>
                      {Object.entries(GROUND_FEATURES).map(([category, options]) => (
                        <div key={category} style={{ marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '11px', marginBottom: '4px', color: 'rgba(226, 232, 240, 0.6)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {category}
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '4px' }}>
                            {options.map((feature) => {
                              const isSelected = newGround.features?.[category]?.includes?.(feature) ||
                                                newGround.features?.[category] === feature;
                              return (
                                <label
                                  key={feature}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '5px 7px',
                                    border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.2)'}`,
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.4)',
                                    fontSize: '11px',
                                    color: isSelected ? '#60a5fa' : 'rgba(226, 232, 240, 0.7)',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      setNewGround((current) => {
                                        const features = { ...current.features };
                                        if (category === 'Surface' || category === 'Venue Type') {
                                          // Single choice
                                          features[category] = e.target.checked ? feature : '';
                                        } else {
                                          // Multiple choice
                                          if (!features[category]) features[category] = [];
                                          if (e.target.checked) {
                                            features[category] = [...features[category], feature];
                                          } else {
                                            features[category] = features[category].filter(f => f !== feature);
                                          }
                                        }
                                        return { ...current, features };
                                      });
                                    }}
                                    style={{ margin: 0, cursor: 'pointer' }}
                                  />
                                  <span>{feature}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

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
                      {grounds.map((ground) => {
                        const isExpanded = expandedGroundId === ground.id;
                        return (
                          <div key={ground.id} style={{ marginBottom: '8px' }}>
                            {/* Dropdown Header */}
                            <button
                              type="button"
                              onClick={() => setExpandedGroundId(isExpanded ? null : ground.id)}
                              style={{
                                width: '100%',
                                padding: '14px 16px',
                                background: isExpanded ? 'radial-gradient(circle at 20% 20%, #1e3a8a, #0f1729 65%)' : 'radial-gradient(circle at 20% 20%, #11193a, #05060f 65%)',
                                border: `1px solid ${isExpanded ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.3)'}`,
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                color: '#f8fafc',
                              }}
                            >
                              <div style={{ textAlign: 'left', flex: 1 }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#f8fafc' }}>
                                  {ground.name || `Ground #${ground.id}`}
                                </h3>
                                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(226, 232, 240, 0.7)' }}>
                                  {ground.location}, {ground.city} • ₨{ground.pricePerHour}/hr
                                </p>
                              </div>
                              <span style={{
                                fontSize: '18px',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                                marginLeft: '16px',
                                color: 'rgba(226, 232, 240, 0.8)',
                              }}>
                                ▼
                              </span>
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                              <div style={{
                                padding: '12px',
                                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.7), rgba(30, 41, 59, 0.6))',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderTop: 'none',
                                borderRadius: '0 0 12px 12px',
                                color: '#f8fafc',
                                maxHeight: '70vh',
                                overflowY: 'auto',
                              }}>
                                <div className="admin-ground" style={{ background: 'transparent', borderRadius: 0, border: 'none' }}>
                                  <div className="admin-ground__header" style={{ marginBottom: '16px' }}>
                                    <div></div>
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
                            {/* Media Section */}
                            <button
                              type="button"
                              onClick={() => toggleSubsection(ground.id, 'media')}
                              style={{
                                width: '100%',
                                padding: '11px 13px',
                                background: expandedSubsections[`${ground.id}-media`] ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.07)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                fontWeight: '600',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                marginBottom: expandedSubsections[`${ground.id}-media`] ? '10px' : '8px',
                              }}
                            >
                              <span>📸 Media & Photos</span>
                              <span style={{ fontSize: '11px', transform: expandedSubsections[`${ground.id}-media`] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▼</span>
                            </button>
                            {expandedSubsections[`${ground.id}-media`] && (
                            <div className="admin-ground__media">
                              <div className="admin-media-card admin-media-card--cover">
                                <div className="admin-media-card__header">
                                  <span>Cover photo</span>
                                  {groundImageDrafts[ground.id] ? (
                                    <span className="admin-media-card__status">Pending save</span>
                                  ) : null}
                                </div>
                                <div className="admin-media-card__body">
                                  {ground.imagePreview ? (
                                    <img
                                      src={ground.imagePreview}
                                      alt={`${ground.name} cover`}
                                      className="admin-media-card__image"
                                    />
                                  ) : (
                                    <div className="admin-ground__placeholder">No photo yet</div>
                                  )}
                                </div>
                                <label className="media-upload-button">
                                  Replace cover
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={isGalleryBusy(ground.id) || busyGroundId === ground.id}
                                    onChange={(event) => {
                                      const file = event.target.files?.[0] ?? null;
                                      handleGroundImageSelect(ground.id, file);
                                      event.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                              <div className="admin-media-card admin-media-card--gallery">
                                <div className="admin-media-card__header">
                                  <span>Gallery</span>
                                  <label className="media-upload-button media-upload-button--inline">
                                    Add photos
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      disabled={isGalleryBusy(ground.id)}
                                      onChange={(event) => {
                                        const files = event.target.files;
                                        if (files && files.length) {
                                          handleGalleryUpload(ground.id, files);
                                        }
                                        event.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                                <p className="admin-media-card__hint">
                                  Inspire players with action shots and facility angles.
                                </p>
                                <div className="admin-media-grid">
                                  {ground.gallery && ground.gallery.length ? (
                                    ground.gallery.map((image, index) => {
                                      const isCover = ground.imageUrl === image.imageUrl;
                                      return (
                                        <div
                                          key={image.id}
                                          className={`admin-media-thumb${isCover ? ' admin-media-thumb--active' : ''}`}
                                        >
                                          <img src={image.preview} alt={`Gallery ${index + 1}`} />
                                          <div className="admin-media-thumb__overlay">
                                            <span className="admin-media-thumb__order">{index + 1}</span>
                                            <div className="admin-media-thumb__actions">
                                              <button
                                                type="button"
                                                className="chip-button"
                                                onClick={() => handleSetCover(ground.id, image.imageUrl)}
                                                disabled={isGalleryBusy(ground.id) || isCover}
                                              >
                                                {isCover ? 'Current cover' : 'Make cover'}
                                              </button>
                                              <div className="admin-media-thumb__reorder">
                                                <button
                                                  type="button"
                                                  className="icon-button"
                                                  onClick={() => handleGalleryMove(ground.id, image.id, 'left')}
                                                  disabled={isGalleryBusy(ground.id) || index === 0}
                                                  aria-label="Move earlier"
                                                >
                                                  &lt;
                                                </button>
                                                <button
                                                  type="button"
                                                  className="icon-button"
                                                  onClick={() => handleGalleryMove(ground.id, image.id, 'right')}
                                                  disabled={
                                                    isGalleryBusy(ground.id) ||
                                                    index === (ground.gallery?.length || 0) - 1
                                                  }
                                                  aria-label="Move later"
                                                >
                                                  &gt;
                                                </button>
                                              </div>
                                              <button
                                                type="button"
                                                className="chip-button chip-button--danger"
                                                onClick={() => handleGalleryDelete(ground.id, image.id)}
                                                disabled={isGalleryBusy(ground.id)}
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="admin-media-empty">
                                      <p>No gallery photos yet. Add a few to show the vibe.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            )}

                            {/* Details Section */}
                            <button
                              type="button"
                              onClick={() => toggleSubsection(ground.id, 'details')}
                              style={{
                                width: '100%',
                                padding: '11px 13px',
                                background: expandedSubsections[`${ground.id}-details`] ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.07)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                fontWeight: '600',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                marginBottom: expandedSubsections[`${ground.id}-details`] ? '10px' : '8px',
                                marginTop: '8px',
                              }}
                            >
                              <span>ℹ️ Ground Details</span>
                              <span style={{ fontSize: '11px', transform: expandedSubsections[`${ground.id}-details`] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▼</span>
                            </button>
                            {expandedSubsections[`${ground.id}-details`] && (
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
                            )}

                            {/* Sport & Features Section */}
                            <button
                              type="button"
                              onClick={() => toggleSubsection(ground.id, 'features')}
                              style={{
                                width: '100%',
                                padding: '11px 13px',
                                background: expandedSubsections[`${ground.id}-features`] ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.07)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                fontWeight: '600',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                marginBottom: expandedSubsections[`${ground.id}-features`] ? '10px' : '8px',
                                marginTop: '8px',
                              }}
                            >
                              <span>⚽ Sport & Features</span>
                              <span style={{ fontSize: '11px', transform: expandedSubsections[`${ground.id}-features`] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▼</span>
                            </button>
                            {expandedSubsections[`${ground.id}-features`] && (
                            <div className="admin-form__row">
                              <label>
                                Sport Category
                                <select
                                  value={ground.category || ''}
                                  onChange={(event) =>
                                    handleFieldChange(ground.id, 'category', event.target.value)
                                  }
                                >
                                  <option value="">Select sport...</option>
                                  {SPORT_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="features-section" style={{
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '0.75rem',
                              padding: '10px',
                              marginBottom: '16px',
                              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.5))',
                              backdropFilter: 'blur(10px)'
                            }}>
                              <h4 style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</h4>
                              {Object.entries(GROUND_FEATURES).map(([category, options]) => (
                                <div key={category} style={{ marginBottom: '8px' }}>
                                  <h5 style={{ fontSize: '11px', marginBottom: '4px', color: 'rgba(226, 232, 240, 0.6)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                    {category}
                                  </h5>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))', gap: '4px' }}>
                                    {options.map((feature) => {
                                      const isSelected = ground.features?.[category]?.includes?.(feature) ||
                                                        ground.features?.[category] === feature;
                                      return (
                                        <label
                                          key={feature}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '5px 7px',
                                            border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.2)'}`,
                                            borderRadius: '0.5rem',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.4)',
                                            fontSize: '11px',
                                            color: isSelected ? '#60a5fa' : 'rgba(226, 232, 240, 0.7)',
                                            transition: 'all 0.2s ease',
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              setGrounds((prev) =>
                                                prev.map((g) => {
                                                  if (g.id !== ground.id) return g;
                                                  const features = { ...g.features };
                                                  if (category === 'Surface' || category === 'Venue Type') {
                                                    // Single choice
                                                    features[category] = e.target.checked ? feature : '';
                                                  } else {
                                                    // Multiple choice
                                                    if (!features[category]) features[category] = [];
                                                    if (e.target.checked) {
                                                      features[category] = [...features[category], feature];
                                                    } else {
                                                      features[category] = features[category].filter(f => f !== feature);
                                                    }
                                                  }
                                                  return { ...g, features };
                                                })
                                              );
                                            }}
                                            style={{ margin: 0, cursor: 'pointer' }}
                                          />
                                          <span>{feature}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                            )}

                            {/* Operating Hours Section */}
                            <button
                              type="button"
                              onClick={() => toggleSubsection(ground.id, 'hours')}
                              style={{
                                width: '100%',
                                padding: '11px 13px',
                                background: expandedSubsections[`${ground.id}-hours`] ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.07)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                fontWeight: '600',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                marginBottom: expandedSubsections[`${ground.id}-hours`] ? '10px' : '8px',
                                marginTop: '8px',
                              }}
                            >
                              <span>🕒 Operating Hours</span>
                              <span style={{ fontSize: '11px', transform: expandedSubsections[`${ground.id}-hours`] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▼</span>
                            </button>
                            {expandedSubsections[`${ground.id}-hours`] && (
                            <div style={{ marginTop: '0', paddingTop: '0' }}>
                              <OperatingHoursConfigurator
                                ref={(ref) => {
                                  operatingHoursRefs.current[ground.id] = ref;
                                }}
                                groundId={ground.id}
                                getIdToken={getIdToken}
                              />
                            </div>
                            )}

                            {/* Description Section */}
                            <button
                              type="button"
                              onClick={() => toggleSubsection(ground.id, 'description')}
                              style={{
                                width: '100%',
                                padding: '11px 13px',
                                background: expandedSubsections[`${ground.id}-description`] ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.07)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                fontWeight: '600',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                marginBottom: expandedSubsections[`${ground.id}-description`] ? '10px' : '8px',
                                marginTop: '8px',
                              }}
                            >
                              <span>📝 Description</span>
                              <span style={{ fontSize: '11px', transform: expandedSubsections[`${ground.id}-description`] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▼</span>
                            </button>
                            {expandedSubsections[`${ground.id}-description`] && (
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
                            )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default AdminPage;
