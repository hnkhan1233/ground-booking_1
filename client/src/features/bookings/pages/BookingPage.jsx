import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../../config.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import '../../../App.css';

const API_ROOT = API_BASE_URL.replace(/\/$/, '');

const initialDate = () => {
  // Get current date in Pakistani timezone (PKT = UTC+5)
  const now = new Date();
  const pktOffset = 5 * 60; // PKT is UTC+5
  const pktTime = new Date(now.getTime() + (pktOffset + now.getTimezoneOffset()) * 60000);
  const year = pktTime.getFullYear();
  const month = String(pktTime.getMonth() + 1).padStart(2, '0');
  const day = String(pktTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

function BookingPage() {
  const [grounds, setGrounds] = useState([]);
  const [isLoadingGrounds, setIsLoadingGrounds] = useState(true);
  const [cityButtons, setCityButtons] = useState([]);
  const [cityFilter, setCityFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [selectedGroundId, setSelectedGroundId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [availability, setAvailability] = useState([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [serverMessage, setServerMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [profile, setProfile] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: '', phone: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [dropdownCity, setDropdownCity] = useState(null);

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

  const filteredGrounds = useMemo(() => {
    let filtered = grounds;

    if (cityFilter) {
      filtered = filtered.filter((ground) => ground.city === cityFilter);
    }

    if (categoryFilter) {
      filtered = filtered.filter((ground) => ground.category === categoryFilter);
    }

    return filtered;
  }, [grounds, cityFilter, categoryFilter]);

  const selectedGround = useMemo(
    () => filteredGrounds.find((ground) => ground.id === selectedGroundId) ?? null,
    [filteredGrounds, selectedGroundId]
  );

  const summary = useMemo(() => {
    const citySet = new Set(grounds.map((ground) => ground.city));
    const averagePrice =
      grounds.length > 0
        ? Math.round(
            grounds.reduce((total, ground) => total + (ground.pricePerHour || 0), 0) /
              grounds.length
          )
        : 0;

    return {
      totalGrounds: grounds.length,
      cityCount: citySet.size,
      averagePrice,
    };
  }, [grounds]);

  useEffect(() => {
    if (user) {
      if (authModalOpen) {
        setAuthModalOpen(false);
        setAuthBusy(false);
      }
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthDisplayName('');
      setAuthMessage('');
      setAuthError('');
      setServerMessage((current) => (current?.type === 'info' ? null : current));
    }
  }, [user, authModalOpen]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileModalOpen(false);
      setPendingBooking(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    let active = true;
    const fetchProfile = async () => {
      setIsProfileLoading(true);
      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error('Unable to verify authentication.');
        }
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.status === 404) {
          if (active) {
            setProfile(null);
          }
          return;
        }
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Could not load your profile.');
        }
        const data = await response.json();
        if (active) {
          setProfile(data);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setProfile(null);
        }
      } finally {
        if (active) {
          setIsProfileLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      active = false;
    };
  }, [user, getIdToken]);

  useEffect(() => {
    async function loadGrounds() {
      try {
        setIsLoadingGrounds(true);
        const response = await fetch(`${API_BASE_URL}/api/grounds`);
        if (!response.ok) {
          throw new Error('Unable to load grounds.');
        }
        const data = await response.json();
        const normalized = data.map((ground) => ({
          id: ground.id,
          name: ground.name,
          city: ground.city,
          location: ground.location,
          pricePerHour: Number(ground.price_per_hour),
          description: ground.description || '',
          imageUrl: resolveImageUrl(ground.image_url),
        }));
        setGrounds(normalized);

        const counts = normalized.reduce((acc, ground) => {
          acc[ground.city] = (acc[ground.city] || 0) + 1;
          return acc;
        }, {});

        const sortedCityEntries = Object.entries(counts)
          .sort((a, b) => {
            if (b[1] !== a[1]) {
              return b[1] - a[1];
            }
            return a[0].localeCompare(b[0]);
          });

        const cityData = sortedCityEntries.map(([city, count]) => ({ city, count }));

        setCityButtons(cityData);

        if (cityData.length > 0) {
          setCityFilter(cityData[0].city);
          const initialGround = normalized.find((ground) => ground.city === cityData[0].city) || normalized[0];
          setSelectedGroundId(initialGround?.id ?? null);
          setSelectedSlot('');
        } else if (normalized.length > 0) {
          setSelectedGroundId(normalized[0].id);
          setSelectedSlot('');
        }
      } catch (error) {
        console.error(error);
        setServerMessage({
          type: 'error',
          text: 'Failed to load grounds. Please refresh the page.',
        });
      } finally {
        setIsLoadingGrounds(false);
      }
    }

    loadGrounds();
  }, []);

  useEffect(() => {
    if (!filteredGrounds.length) {
      setSelectedGroundId(null);
      setSelectedSlot('');
      return;
    }

    if (!filteredGrounds.some((ground) => ground.id === selectedGroundId)) {
      setSelectedGroundId(filteredGrounds[0].id);
      setSelectedSlot('');
    }
  }, [filteredGrounds, selectedGroundId]);

  useEffect(() => {
    if (!selectedGroundId || !selectedDate) {
      return;
    }

    async function loadAvailability() {
      try {
        setIsLoadingAvailability(true);
        const response = await fetch(
          `${API_BASE_URL}/api/grounds/${selectedGroundId}/availability?date=${selectedDate}`
        );
        if (!response.ok) {
          throw new Error('Unable to load availability.');
        }
        const data = await response.json();

        // Additional client-side filtering for past times (Pakistani timezone - PKT = UTC+5)
        const now = new Date();
        const pktOffset = 5 * 60; // PKT is UTC+5
        const pktTime = new Date(now.getTime() + (pktOffset + now.getTimezoneOffset()) * 60000);
        const pktHours = pktTime.getHours();
        const pktMinutes = pktTime.getMinutes();

        const pktYear = pktTime.getFullYear();
        const pktMonth = String(pktTime.getMonth() + 1).padStart(2, '0');
        const pktDay = String(pktTime.getDate()).padStart(2, '0');
        const todayPKT = `${pktYear}-${pktMonth}-${pktDay}`;

        const isToday = selectedDate === todayPKT;

        const filteredAvailability = (data.availability || []).map((item) => {
          let available = item.available;

          // If it's today, double-check if the slot time has passed
          if (isToday && available) {
            const [slotHour, slotMinute] = item.slot.split(':').map(Number);

            // Slot is unavailable if it has already started or passed
            if (slotHour < pktHours || (slotHour === pktHours && slotMinute <= pktMinutes)) {
              available = false;
            }
          }

          return { ...item, available };
        });

        setAvailability(filteredAvailability);
      } catch (error) {
        console.error(error);
        setServerMessage({
          type: 'error',
          text: 'Could not fetch availability for the selected day.',
        });
      } finally {
        setIsLoadingAvailability(false);
      }
    }

    loadAvailability();
  }, [selectedGroundId, selectedDate]);

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setSlotError('');
  };

  const openAuthModal = (mode = 'signin') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
    setAuthError('');
    setAuthMessage('');
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthBusy(false);
    setAuthError('');
    setAuthMessage('');
    setAuthMode('signin');
    setAuthEmail('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setAuthDisplayName('');
    setPhoneNumber('');
    setVerificationCode('');
  };

  const handleEmailAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');

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
        setAuthMessage('Account created. You are now signed in.');
      } else {
        await loginWithEmail(email, password);
      }
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setAuthDisplayName('');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    setAuthError('');
    setAuthMessage('');

    if (!authEmail.trim()) {
      setAuthError('Enter your email to receive a password reset link.');
      return;
    }

    try {
      setAuthBusy(true);
      await sendPasswordReset(authEmail.trim());
      setAuthMessage('Password reset link sent. Check your inbox.');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Could not send reset email.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      setAuthBusy(true);
      await loginWithGoogle();
      setAuthMessage('Signed in with Google.');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePhoneStart = async () => {
    setAuthError('');
    if (!phoneNumber.trim()) {
      setAuthError('Enter a phone number including country code (e.g., +92...).');
      return;
    }
    try {
      setAuthBusy(true);
      await startPhoneSignIn(phoneNumber.trim());
      setAuthMessage('Verification code sent. Check your phone.');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Failed to send verification code.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePhoneVerify = async () => {
    setAuthError('');
    if (!verificationCode.trim()) {
      setAuthError('Enter the verification code you received via SMS.');
      return;
    }

    try {
      setAuthBusy(true);
      await verifyPhoneCode(verificationCode.trim());
      setVerificationCode('');
      setPhoneNumber('');
      setAuthMessage('Phone number verified.');
    } catch (error) {
      console.error(error);
      setAuthError(error.message || 'Could not verify the code. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setProfileError('');
    setProfileSaving(false);
    setProfileDraft({ name: '', phone: '' });
    if (pendingBooking) {
      setPendingBooking(false);
    }
  };

  const handleProfileDraftChange = (field) => (event) => {
    const value = event.target.value;
    setProfileDraft((current) => ({ ...current, [field]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileError('');

    const name = profileDraft.name.trim();
    const phone = profileDraft.phone.trim();

    if (!name || !phone) {
      setProfileError('Name and phone number are required.');
      return;
    }

    try {
      setProfileSaving(true);
      const token = await getIdToken();
      if (!token) {
        throw new Error('Unable to verify your session. Please sign in again.');
      }
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, phone }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Could not save your details.');
      }

      const updated = await response.json();
      setProfile(updated);
      setProfileModalOpen(false);
      setProfileSaving(false);
      setProfileError('');
      setProfileDraft({ name: '', phone: '' });

      if (pendingBooking && selectedSlot) {
        await performBooking();
      }
    } catch (error) {
      console.error(error);
      setProfileError(error.message || 'Could not save your details.');
    } finally {
      setProfileSaving(false);
    }
  };

  const displayName = user?.displayName || user?.email || user?.phoneNumber || 'Player';
  const isAdminAccount =
    user?.email?.toLowerCase() === 'hnkhan123.hk@gmail.com';
  const effectiveName = profile?.name || displayName;

  useEffect(() => {
    if (user) {
      setAuthError('');
      setPhoneNumber('');
      setVerificationCode('');
    }
  }, [user]);

  const performBooking = async () => {
    if (!selectedSlot) {
      setSlotError('Please choose a time slot before booking.');
      setPendingBooking(false);
      return;
    }
    try {
      setIsSubmitting(true);
      setServerMessage(null);
      const token = await getIdToken();
      if (!token) {
        throw new Error('Unable to verify your session. Please sign in again.');
      }
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          groundId: selectedGroundId,
          date: selectedDate,
          slot: selectedSlot,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Booking failed. Please try again.');
      }

      const booking = await response.json();
      setServerMessage({
        type: 'success',
        text: `Great! Your booking #${booking.id} is confirmed for ${booking.date} at ${booking.slot}.`,
      });
      setSelectedSlot('');
      setPendingBooking(false);
      setAvailability((current) =>
        current.map((slot) =>
          slot.slot === booking.slot ? { ...slot, available: false } : slot
        )
      );
    } catch (error) {
      console.error(error);
      setServerMessage({
        type: 'error',
        text: error.message,
      });
      if (error.message && error.message.toLowerCase().includes('profile')) {
        setProfileDraft({
          name: profile?.name || user?.displayName || user?.email || '',
          phone: profile?.phone || user?.phoneNumber || '',
        });
        setProfileError('');
        setProfileModalOpen(true);
        setPendingBooking(true);
      } else {
        setPendingBooking(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedGroundId) {
      setServerMessage({
        type: 'info',
        text: 'Select a ground before booking.',
      });
      return;
    }

    if (!selectedSlot) {
      setSlotError('Please choose a time slot before booking.');
      return;
    }

    if (!user) {
      setServerMessage({
        type: 'info',
        text: 'Sign in to reserve this slot.',
      });
      openAuthModal('signin');
      return;
    }

    if (isProfileLoading) {
      setServerMessage({
        type: 'info',
        text: 'Loading your profile. Please try again in a moment.',
      });
      return;
    }

    if (!profile || !profile.name || !profile.phone) {
      setProfileDraft({
        name: profile?.name || user?.displayName || user?.email || '',
        phone: profile?.phone || user?.phoneNumber || '',
      });
      setProfileError('');
      setProfileModalOpen(true);
      setPendingBooking(true);
      return;
    }

    await performBooking();
  };

  return (
    <div className="app app--sporty">
      <header className="hero hero--sporty">
        <div className="hero__overlay">
          <div className="hero__header">
            <span className="hero__eyebrow">Pakistan Grounds Network</span>
            <div className="hero__actions">
              {initializing ? null : user ? (
                <>
                  <Link to="/account" className="hero__action-link">
                    Account
                  </Link>
                  {isAdminAccount ? (
                    <Link to="/admin" className="hero__action-link hero__action-link--accent">
                      Admin Console
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="hero__action-link hero__action-link--ghost"
                    onClick={logout}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="hero__action-link hero__action-link--primary"
                  onClick={() => openAuthModal('signin')}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>

          <div className="hero__body">
            <div className="hero__content">
              <h1>Book now</h1>
              <p className="hero__tagline">
                Real-time turf availability across Karachi, Lahore, Islamabad, and Rawalpindi
              </p>
            </div>

            <div className="hero__stats">
              <div className="hero-stat">
                <span className="hero-stat__label">Active Grounds</span>
                <span className="hero-stat__value">{summary.totalGrounds}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat__label">Cities Covered</span>
                <span className="hero-stat__value">{summary.cityCount}</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat__label">Average Rate</span>
                <span className="hero-stat__value">
                  PKR {summary.averagePrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="layout layout--sporty">
        <section className="ground-list">
          <div className="ground-list__header">
            <div className="city-buttons">
              {cityButtons.map(({ city, count }) => {
                const isActive = city === cityFilter;
                return (
                  <button
                    key={city}
                    type="button"
                    className={`city-button ${isActive ? 'city-button--active' : ''}`}
                    onClick={() => {
                      setCityFilter(city);
                      const firstGround = grounds.find((ground) => ground.city === city);
                      setSelectedGroundId(firstGround?.id ?? null);
                      setSelectedSlot('');
                    }}
                  >
                    {city}
                    <span className="city-button__count">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ground-list__header" style={{ marginTop: '1.5rem' }}>
            <div className="category-filters">
              <button
                type="button"
                className={`category-filter ${!categoryFilter ? 'category-filter--active' : ''}`}
                onClick={() => setCategoryFilter(null)}
              >
                All Sports
              </button>
              {['Football', 'Cricket', 'Padel', 'Futsal', 'Basketball', 'Tennis'].map((cat) => {
                const isActive = cat === categoryFilter;
                const count = grounds.filter(g => g.category === cat).length;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`category-filter ${isActive ? 'category-filter--active' : ''}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                    <span className="category-filter__count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isLoadingGrounds ? (
            <p className="status">Loading grounds...</p>
          ) : filteredGrounds.length === 0 ? (
            <p className="status status--muted">
              No venues yet for this city. Check back soon or explore another location.
            </p>
          ) : (
            <div className="ground-grid ground-grid--sporty">
              {filteredGrounds.map((ground) => {
                const isActive = ground.id === selectedGroundId;
                return (
                  <button
                    type="button"
                    key={ground.id}
                    className={`ground-card ${isActive ? 'ground-card--active' : ''}`}
                    onClick={() => setSelectedGroundId(ground.id)}
                  >
                    {ground.imageUrl ? (
                      <img src={ground.imageUrl} alt={ground.name} className="ground-card__image" />
                    ) : (
                      <div className="ground-card__placeholder">Venue</div>
                    )}
                    <div className="ground-card__body">
                      <div className="ground-card__pill">{ground.city}</div>
                      <h3>{ground.name}</h3>
                      <p className="ground-card__meta">{ground.location}</p>
                      <p className="ground-card__description">{ground.description}</p>
                      <p className="ground-card__price">
                        PKR {ground.pricePerHour.toLocaleString()}
                        <span> / hour</span>
                      </p>
                      <Link
                        to={`/ground/${ground.id}`}
                        className="ground-card__details-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View details →
                      </Link>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="booking-panel booking-panel--sporty">
          <div className="booking-panel__header">
            <h2>Reserve your slot</h2>
          </div>

          {selectedGround ? (
            <>
              <div className="booking-panel__section booking-panel__section--submit">
                <form className="booking-form booking-form--sporty" onSubmit={handleSubmit}>
                  <div className="button-with-tooltip">
                    <button
                      className="primary-button primary-button--sporty"
                      type="submit"
                      disabled={isSubmitting || !selectedSlot}
                    >
                      {isSubmitting ? 'Booking...' : 'Book Now'}
                    </button>
                    {!selectedSlot && (
                      <span className="custom-tooltip">Select a slot</span>
                    )}
                  </div>
                </form>
              </div>

              <div className="booking-panel__section booking-panel__section--card">
                <button
                  type="button"
                  className="booking-panel__ground booking-panel__ground--sporty booking-panel__ground--clickable"
                  onClick={() => { setDropdownCity(selectedGround.city); setCityDropdownOpen(true); }}
                  title="Click to view other grounds in this city"
                >
                  {selectedGround.imageUrl && (
                    <img
                      src={selectedGround.imageUrl}
                      alt={selectedGround.name}
                      className="booking-panel__ground-image"
                    />
                  )}
                  <div className="booking-panel__ground-info">
                    <h3>{selectedGround.name}</h3>
                    <p>{selectedGround.city} · {selectedGround.location}</p>
                  </div>
                </button>
              </div>

              <div className="booking-panel__section booking-panel__section--card">
                <label className="form-field">
                  <span>Date</span>
                  <input
                    type="date"
                    min={initialDate()}
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setSelectedSlot('');
                    }}
                  />
                </label>
              </div>

              <div className="booking-panel__section booking-panel__section--slots booking-panel__section--card">
                <div className="availability availability--sporty">
                  <div className="availability__header">
                    <h3>Available slots</h3>
                    {isLoadingAvailability && <span className="status">Loading...</span>}
                  </div>

                  <div className="availability__grid availability__grid--sporty">
                    {availability.map((item) => {
                      const isSelected = selectedSlot === item.slot;
                      return (
                        <button
                          type="button"
                          key={item.slot}
                          className={`slot slot--sporty ${isSelected ? 'slot--selected' : ''}`}
                          disabled={!item.available || isLoadingAvailability}
                          onClick={() => handleSlotSelect(item.slot)}
                        >
                          <span>{item.slot}</span>
                          <span className="slot__status">
                            {item.available ? 'Open' : 'Booked'}
                          </span>
                        </button>
                      );
                    })}

                    {!availability.length && !isLoadingAvailability ? (
                      <p className="status status--muted availability__empty">
                        Select a date to view available slots.
                      </p>
                    ) : null}
                  </div>
                  {slotError && <p className="form-error">{slotError}</p>}
                </div>
              </div>

              {!user && (
                <div className="booking-panel__section booking-panel__section--auth">
                  <p className="auth-hint">
                    You can explore availability first; we only ask you to sign in when you confirm your booking.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="status status--muted">Select a ground to view booking options.</p>
          )}

          {serverMessage && (
            <div className="booking-panel__section">
              <div className={`flash-message flash-message--${serverMessage.type}`} role="status">
                {serverMessage.text}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="footer footer--sporty">
        <div>
          <p>Need to cancel? Share your booking ID with the facility manager for a quick release.</p>
          <p className="footer__credit">Built for competitive squads and weekend warriors across Pakistan.</p>
        </div>
      </footer>

      {authModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <button type="button" className="modal-close" onClick={closeAuthModal} aria-label="Close">
              ×
            </button>
            <h3 className="modal-title">{authMode === 'signup' ? 'Create your account' : 'Sign in to continue'}</h3>

            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === 'signin' ? 'auth-tab--active' : ''}`}
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                  setAuthMessage('');
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
                  setAuthMessage('');
                }}
              >
                Create account
              </button>
            </div>

            {authError && <p className="form-error">{authError}</p>}
            {authMessage && <p className="auth-message">{authMessage}</p>}

            <form className="auth-form" onSubmit={handleEmailAuthSubmit}>
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
                  disabled={authBusy}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Minimum 6 characters"
                  disabled={authBusy}
                  required
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
                    disabled={authBusy}
                    required
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
                onClick={handlePasswordReset}
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
              onClick={handleGoogleSignIn}
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

            <div className="auth-phone auth-phone--modal">
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
                    onClick={handlePhoneVerify}
                    disabled={authBusy || !verificationCode.trim()}
                  >
                    Verify &amp; sign in
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="auth-button auth-button--primary"
                  onClick={handlePhoneStart}
                  disabled={authBusy || !phoneNumber.trim()}
                >
                  Send verification code
                </button>
              )}
            </div>

            <p className="auth-hint">
              Signing in lets you manage your bookings and receive updates.
            </p>
          </div>
        </div>
      )}

      {profileModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <button type="button" className="modal-close" onClick={closeProfileModal} aria-label="Close">
              ×
            </button>
            <h3 className="modal-title">Add your contact details</h3>
            <p className="auth-hint">
              We need a name and phone number to confirm your reservation with the facility manager.
            </p>
            {profileError && <p className="form-error">{profileError}</p>}
            <form className="auth-form" onSubmit={handleProfileSubmit}>
              <label>
                Full name
                <input
                  type="text"
                  value={profileDraft.name}
                  onChange={handleProfileDraftChange('name')}
                  placeholder="Ali Khan"
                  disabled={profileSaving}
                  required
                />
              </label>
              <label>
                Phone number
                <input
                  type="tel"
                  value={profileDraft.phone}
                  onChange={handleProfileDraftChange('phone')}
                  placeholder="0300-1234567"
                  disabled={profileSaving}
                  required
                />
              </label>
              <button type="submit" className="auth-button auth-button--primary" disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}

      {cityDropdownOpen && dropdownCity && (
        <>
          <div className="city-dropdown-overlay" onClick={() => setCityDropdownOpen(false)} />
          <div className="city-dropdown">
            <div className="city-dropdown__header">
              <h3>Grounds in {dropdownCity}</h3>
              <button
                type="button"
                className="city-dropdown__close"
                onClick={() => setCityDropdownOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="city-dropdown__list">
              {grounds
                .filter((ground) => ground.city === dropdownCity)
                .map((ground) => (
                  <button
                    key={ground.id}
                    type="button"
                    className="city-dropdown__item"
                    onClick={() => {
                      setSelectedGroundId(ground.id);
                      setCityDropdownOpen(false);
                    }}
                  >
                    {ground.imageUrl && (
                      <img src={ground.imageUrl} alt={ground.name} className="city-dropdown__item-image" />
                    )}
                    <div className="city-dropdown__item-content">
                      <h4>{ground.name}</h4>
                      <p className="city-dropdown__item-location">{ground.location}</p>
                      <p className="city-dropdown__item-price">PKR {ground.pricePerHour.toLocaleString()} / hour</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BookingPage;
