import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { API_BASE_URL } from '../../../config.js';
import { getFeatureIcon, getCategoryColor } from '../../../utils/featureIcons.js';
import '../../../App.css';

const API_ROOT = API_BASE_URL.replace(/\/$/, '');

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value || 0);
};

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

function GroundDetailPage() {
  const { id } = useParams();
  const { user, effectiveName, profile, logout, isAdmin: isAdminAccount, showAuthModal } = useAuth();

  const [ground, setGround] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Booking state
  const [selectedDate, setSelectedDate] = useState(initialDate());
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availability, setAvailability] = useState([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadGroundDetails();
  }, [id]);

  useEffect(() => {
    if (ground && selectedDate) {
      loadAvailability();
    }
  }, [ground, selectedDate]);

  const loadGroundDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_ROOT}/api/grounds/${id}`);

      if (!response.ok) {
        throw new Error('Ground not found');
      }

      const data = await response.json();
      setGround(data);
    } catch (err) {
      setError(err.message || 'Failed to load ground details');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async () => {
    if (!ground?.id || !selectedDate) return;

    try {
      setIsLoadingAvailability(true);
      const response = await fetch(
        `${API_ROOT}/api/grounds/${ground.id}/availability?date=${selectedDate}`
      );

      if (!response.ok) {
        throw new Error('Failed to load availability');
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
    } catch (err) {
      console.error(err);
      setAvailability([]);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const handleBooking = async () => {
    if (!user) {
      showAuthModal();
      return;
    }

    if (!selectedSlot) {
      setBookingError('Please select a time slot');
      return;
    }

    try {
      setIsSubmitting(true);
      setBookingError('');

      const token = await user.getIdToken();
      const response = await fetch(`${API_ROOT}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          groundId: ground.id,
          date: selectedDate,
          slot: selectedSlot,
        }),
      });

      const data = await response.json();

      if (response.status === 428) {
        setBookingError(data.error + ' Please complete your profile first.');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Booking failed');
      }

      setBookingSuccess(true);
      setSelectedSlot('');
      loadAvailability();

      setTimeout(() => setBookingSuccess(false), 5000);
    } catch (err) {
      setBookingError(err.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const media = useMemo(() => {
    if (!ground) {
      return [];
    }

    const entries = [];
    const seen = new Set();

    const pushImage = (image, keyPrefix) => {
      const path = image?.image_url || image?.imageUrl;
      if (!path || seen.has(path)) {
        return;
      }
      seen.add(path);
      entries.push({
        id: image.id ?? `${keyPrefix}-${entries.length}`,
        raw: path,
        url: resolveImageUrl(path),
      });
    };

    if (ground.image_url) {
      pushImage({ image_url: ground.image_url }, 'cover');
    }

    if (Array.isArray(ground.images)) {
      ground.images.forEach((image) => pushImage(image, 'gallery'));
    }

    return entries;
  }, [ground]);

  const HERO_VISIBLE_MAX = 5;
  const [heroOffset, setHeroOffset] = useState(0);
  const heroVisibleCount = Math.min(media.length, HERO_VISIBLE_MAX);

  const getAreaSlots = (count) => {
    if (count <= 1) {
      return ['lead'];
    }
    if (count === 2) {
      return ['lead', 's1'];
    }
    if (count === 3) {
      return ['lead', 's1', 's2'];
    }
    if (count === 4) {
      return ['lead', 's1', 's2', 's3'];
    }
    return ['lead', 's1', 's2', 's3', 's4'];
  };

  useEffect(() => {
    if (media.length <= heroVisibleCount) {
      setHeroOffset(0);
    }
  }, [media.length, heroVisibleCount]);

  const heroImages = useMemo(() => {
    if (!media.length) {
      return [];
    }
    if (media.length <= heroVisibleCount) {
      return media.slice(0, heroVisibleCount);
    }
    const items = [];
    for (let index = 0; index < heroVisibleCount; index += 1) {
      const pointer = (heroOffset + index) % media.length;
      items.push(media[pointer]);
    }
    return items;
  }, [heroOffset, heroVisibleCount, media]);

  const heroIndices = useMemo(
    () => heroImages.map((_, index) => (heroOffset + index) % media.length),
    [heroImages, heroOffset, media.length]
  );

  const collageCount = heroImages.length;
  const collageLayout = collageCount <= 1
    ? (collageCount === 0 ? 'single' : 'single')
    : collageCount === 2
      ? 'double'
      : collageCount === 3
        ? 'triple'
        : collageCount === 4
          ? 'quad'
          : 'quint';

  const heroAreas = getAreaSlots(collageCount);
  const showHeroNav = media.length > heroVisibleCount;
  const heroExtraImages = Math.max(media.length - heroVisibleCount, 0);

  const remainingEntries = useMemo(
    () =>
      media
        .map((image, index) => ({ image, index }))
        .filter(({ index }) => !heroIndices.includes(index)),
    [media, heroIndices]
  );

  const secondaryEntries = useMemo(
    () => remainingEntries.slice(0, Math.min(remainingEntries.length, HERO_VISIBLE_MAX)),
    [remainingEntries]
  );

  const secondaryCount = secondaryEntries.length;
  const secondaryLayout = secondaryCount <= 1
    ? (secondaryCount === 0 ? 'single' : 'single')
    : secondaryCount === 2
      ? 'double'
      : secondaryCount === 3
        ? 'triple'
        : secondaryCount === 4
          ? 'quad'
          : 'quint';

  const secondaryAreas = getAreaSlots(secondaryCount);
  const secondaryExtra = Math.max(remainingEntries.length - secondaryEntries.length, 0);

  const stepHeroCollage = (direction) => {
    if (!showHeroNav || media.length === 0) {
      return;
    }
    setHeroOffset((current) => (current + direction + media.length) % media.length);
  };

  const openLightbox = (index) => {
    if (media.length === 0) {
      return;
    }
    setLightboxIndex(Math.max(0, Math.min(index, media.length - 1)));
  };

  const closeLightbox = () => setLightboxIndex(null);

  const stepLightbox = (direction) => {
    setLightboxIndex((prev) => {
      if (prev === null || media.length === 0) {
        return prev;
      }
      const next = (prev + direction + media.length) % media.length;
      return next;
    });
  };

  useEffect(() => {
    if (lightboxIndex === null) {
      return undefined;
    }

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowRight') {
        stepLightbox(1);
      } else if (event.key === 'ArrowLeft') {
        stepLightbox(-1);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, media.length]);

  const getFeaturesByCategory = (features) => {
    if (!Array.isArray(features)) {
      return {};
    }
    const grouped = {};
    features.forEach((feature) => {
      const category = feature.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(feature);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="app app--sporty">
        <div className="container" style={{ padding: '4rem 6vw', textAlign: 'center' }}>
          <p className="status">Loading ground details...</p>
        </div>
      </div>
    );
  }

  if (error || !ground) {
    return (
      <div className="app app--sporty">
        <div className="container" style={{ padding: '4rem 6vw', textAlign: 'center' }}>
          <h2 style={{ color: '#f8fafc', marginBottom: '1rem' }}>Ground not found</h2>
          <p className="status status--muted" style={{ marginBottom: '2rem' }}>{error}</p>
          <Link to="/" className="primary-button">
            Back to grounds
          </Link>
        </div>
      </div>
    );
  }

  const featuresByCategory = getFeaturesByCategory(ground.features || []);

  return (
    <div className="app app--sporty">
      {/* Top Navigation Bar */}
      <nav className="detail-nav">
        <div className="detail-nav__content">
          <Link to="/" className="detail-nav__back">
            ← All grounds
          </Link>
          <div className="detail-nav__actions">
            {user ? (
              <>
                <span className="detail-nav__user">{effectiveName}</span>
                <Link to="/account" className="link-button">
                  My bookings
                </Link>
                {isAdminAccount && (
                  <Link to="/admin" className="link-button">
                    Admin
                  </Link>
                )}
                <button type="button" className="link-button" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <button type="button" className="primary-button" onClick={showAuthModal}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      <header className="detail-hero">
        {collageCount ? (
          <div className={`detail-hero__collage detail-hero__collage--${collageLayout}`}>
            {heroImages.map((image, index) => {
              const area = heroAreas[index] ?? 's4';
              const mediaIndex = (heroOffset + index) % media.length;
              return (
                <button
                  type="button"
                  key={`${image.id}-hero-${index}`}
                  className="detail-hero__tile"
                  style={{ gridArea: area }}
                  onClick={() => openLightbox(mediaIndex)}
                  aria-label={`View photo ${mediaIndex + 1} of ${media.length}`}
                >
                  <img src={image.url} alt={`${ground.name} hero ${index + 1}`} />
                </button>
              );
            })}
            {showHeroNav ? (
              <>
                <button
                  type="button"
                  className="detail-hero__nav detail-hero__nav--prev"
                  onClick={() => stepHeroCollage(-1)}
                  aria-label="Previous photos"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="detail-hero__nav detail-hero__nav--next"
                  onClick={() => stepHeroCollage(1)}
                  aria-label="Next photos"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="detail-hero__overlay">
          <div className="detail-hero__content container">
            <div className="detail-hero__info">
              {ground.category && <span className="detail-hero__pill">{ground.category}</span>}
              <h1>{ground.name}</h1>
              <p className="detail-hero__location">
                <span className="location-icon" aria-hidden="true">📍</span>
                {ground.location}, {ground.city}
              </p>
            </div>
            <div className="detail-hero__stats">
              <div className="detail-hero__stat">
                <span>Hourly rate</span>
                <strong>{formatCurrency(ground.price_per_hour)}</strong>
              </div>
              {ground.surface_type && (
                <div className="detail-hero__stat">
                  <span>Surface</span>
                  <strong>{ground.surface_type}</strong>
                </div>
              )}
              {ground.capacity && (
                <div className="detail-hero__stat">
                  <span>Players</span>
                  <strong>{ground.capacity}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="detail-media">
        <div className="container">
          {secondaryCount ? (
            <div className={`detail-collage detail-collage--${secondaryLayout}`}>
              {secondaryEntries.map(({ image, index: mediaIndex }, position) => {
                const area = secondaryAreas[position] ?? 's4';
                const isOverflowTrigger = secondaryExtra > 0 && position === secondaryCount - 1;
                const label = isOverflowTrigger
                  ? `View all ${media.length} photos`
                  : `View photo ${mediaIndex + 1} of ${media.length}`;

                return (
                  <button
                    type="button"
                    key={`${image.id}-secondary-${mediaIndex}`}
                    className={`detail-collage__tile detail-collage__tile--grid detail-collage__tile--area-${area}`}
                    style={{ gridArea: area }}
                    onClick={() => openLightbox(mediaIndex)}
                    aria-label={label}
                  >
                    <img src={image.url} alt={`${ground.name} gallery ${mediaIndex + 1}`} />
                    {isOverflowTrigger ? (
                      <span className="detail-collage__more">
                        <span className="detail-collage__more-count">+{secondaryExtra}</span>
                        <span className="detail-collage__more-text">View all photos</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <div className="container">
        <div className="ground-detail__content">
          <div className="ground-detail__main">

            {ground.description && (
              <div className="ground-detail__section">
                <h2>About this ground</h2>
                <p className="ground-detail__description">{ground.description}</p>
              </div>
            )}

            {(ground.surface_type || ground.capacity || ground.dimensions) && (
              <div className="ground-detail__section">
                <h2>Specifications</h2>
                <div className="specs-grid">
                  {ground.surface_type && (
                    <div className="spec-card">
                      <div className="spec-card__icon">🏟️</div>
                      <div className="spec-card__label">Surface</div>
                      <div className="spec-card__value">{ground.surface_type}</div>
                    </div>
                  )}
                  {ground.capacity && (
                    <div className="spec-card">
                      <div className="spec-card__icon">👥</div>
                      <div className="spec-card__label">Capacity</div>
                      <div className="spec-card__value">{ground.capacity} players</div>
                    </div>
                  )}
                  {ground.dimensions && (
                    <div className="spec-card">
                      <div className="spec-card__icon">📏</div>
                      <div className="spec-card__label">Dimensions</div>
                      <div className="spec-card__value">{ground.dimensions}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {Object.keys(featuresByCategory).length > 0 && (
              <div className="ground-detail__section">
                <h2>Amenities</h2>
                <div className="features-section">
                  {Object.entries(featuresByCategory).map(([category, features]) => (
                    <div key={category} className="feature-category" style={{ backgroundColor: getCategoryColor(category) }}>
                      <h3 className="feature-category__title">{category}</h3>
                      <ul className="feature-list">
                        {features.map((feature) => (
                          <li key={feature.id} className="feature-item">
                            <span className="feature-item__icon">{getFeatureIcon(feature.feature_name)}</span>
                            <span className="feature-item__name">{feature.feature_name}</span>
                            {feature.feature_value && (
                              <span className="feature-item__value">: {feature.feature_value}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="ground-detail__sidebar">
            <div className="sticky-sidebar">
              <div className="booking-card">
                <div className="booking-card__price">
                  <span className="booking-card__amount">{formatCurrency(ground.price_per_hour)}</span>
                  <span className="booking-card__unit">per hour</span>
                </div>

                {bookingSuccess && (
                  <div className="booking-success">
                    ✓ Booking confirmed! View in <Link to="/account">My bookings</Link>
                  </div>
                )}

                {bookingError && (
                  <div className="booking-error">{bookingError}</div>
                )}

                <div className="booking-card__form">
                  <label className="booking-label">
                    <span className="booking-label__text">Select date</span>
                    <input
                      type="date"
                      min={initialDate()}
                      value={selectedDate}
                      onChange={(event) => {
                        setSelectedDate(event.target.value);
                        setSelectedSlot('');
                        setBookingError('');
                      }}
                      className="booking-input"
                    />
                  </label>

                  <div className="booking-slots">
                    <div className="booking-slots__header">
                      <span className="booking-label__text">Available times</span>
                      {isLoadingAvailability && <span className="booking-slots__loading">Loading...</span>}
                    </div>

                    <div className="booking-slots__grid">
                      {availability.map((item) => {
                        const isSelected = selectedSlot === item.slot;
                        return (
                          <button
                            type="button"
                            key={item.slot}
                            disabled={!item.available}
                            className={`booking-slot ${
                              isSelected ? 'booking-slot--selected' : ''
                            } ${!item.available ? 'booking-slot--disabled' : ''}`}
                            onClick={() => {
                              setSelectedSlot(item.slot);
                              setBookingError('');
                            }}
                          >
                            {item.slot}
                          </button>
                        );
                      })}
                    </div>

                    {!availability.length && !isLoadingAvailability && (
                      <p className="booking-slots__empty">No slots available</p>
                    )}
                  </div>

                  {user ? (
                    <button
                      type="button"
                      className="booking-button"
                      onClick={handleBooking}
                      disabled={!selectedSlot || isSubmitting}
                    >
                      {isSubmitting ? 'Confirming...' : 'Confirm booking'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="booking-button"
                      onClick={showAuthModal}
                    >
                      Sign in to book
                    </button>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {lightboxIndex !== null && media[lightboxIndex] && (
        <div className="detail-lightbox" role="dialog" aria-modal="true" onClick={closeLightbox}>
          <button
            type="button"
            className="detail-lightbox__close"
            onClick={closeLightbox}
            aria-label="Close gallery"
          >
            ✕
          </button>
          {media.length > 1 && (
            <>
              <button
                type="button"
                className="detail-lightbox__nav detail-lightbox__nav--prev"
                onClick={() => stepLightbox(-1)}
                aria-label="Previous image"
              >
                &lt;
              </button>
              <button
                type="button"
                className="detail-lightbox__nav detail-lightbox__nav--next"
                onClick={() => stepLightbox(1)}
                aria-label="Next image"
              >
                &gt;
              </button>
            </>
          )}
          <div className="detail-lightbox__inner" onClick={(e) => e.stopPropagation()}>
            <img
              src={media[lightboxIndex].url}
              alt={`${ground.name} gallery ${lightboxIndex + 1}`}
            />
          </div>
          <div className="detail-lightbox__counter">
            {lightboxIndex + 1} / {media.length}
          </div>
        </div>
      )}
    </div>
  );
}

export default GroundDetailPage;
