import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { API_BASE_URL } from '../../../config.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import '../../../App.css';

function AccountPage() {
  const { user, initializing, getIdToken, logout } = useAuth();
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('account');
  const [bookings, setBookings] = useState([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let active = true;
    const fetchProfile = async () => {
      setIsLoading(true);
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
            setProfile({ name: user.displayName || '', phone: user.phoneNumber || '' });
          }
          return;
        }
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Could not load your profile.');
        }
        const data = await response.json();
        if (active) {
          setProfile({ name: data.name || '', phone: data.phone || '' });
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setErrorMessage(error.message || 'Could not load your profile.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      active = false;
    };
  }, [user, getIdToken]);

  if (!initializing && !user) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const fetchBookingHistory = async () => {
    try {
      setIsLoadingBookings(true);
      const token = await getIdToken();
      if (!token) {
        throw new Error('Unable to verify authentication.');
      }
      const response = await fetch(`${API_BASE_URL}/api/bookings/user/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Could not load your bookings.');
      }

      const data = await response.json();
      setBookings(data || []);
    } catch (error) {
      console.error(error);
      setBookings([]);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'bookings' && bookings.length === 0) {
      fetchBookingHistory();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setStatusMessage(null);

    const name = profile.name.trim();
    const phone = profile.phone.trim();

    if (!name || !phone) {
      setErrorMessage('Name and phone number are required.');
      return;
    }

    try {
      setSaving(true);
      const token = await getIdToken();
      if (!token) {
        throw new Error('Unable to verify authentication.');
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
        throw new Error(error.error || 'Could not save your profile.');
      }

      const updated = await response.json();
      setProfile({ name: updated.name, phone: updated.phone });
      setStatusMessage('Profile updated successfully.');
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account">
      <div className="account__header">
        <div>
          <h1>My account</h1>
          <p>Manage your profile and booking history.</p>
        </div>
        <div className="account__actions">
          <Link to="/" className="link-button link-button--inline">Back to booking</Link>
          <button type="button" className="ghost-button" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </div>

      <div className="account-tabs">
        <button
          className={`account-tab ${activeTab === 'account' ? 'account-tab--active' : ''}`}
          onClick={() => handleTabChange('account')}
        >
          Account Information
        </button>
        <button
          className={`account-tab ${activeTab === 'bookings' ? 'account-tab--active' : ''}`}
          onClick={() => handleTabChange('bookings')}
        >
          Booking History
        </button>
      </div>

      <div className="account-card">
        {activeTab === 'account' && (
          isLoading ? (
            <p className="status">Loading profile…</p>
          ) : (
            <form className="account-form" onSubmit={handleSubmit}>
              <label>
                Email address
                <input type="email" value={user?.email || ''} disabled />
              </label>
              <label>
                Full name
                <input
                  type="text"
                  value={profile.name}
                  onChange={handleChange('name')}
                  placeholder="Ali Khan"
                  required
                  disabled={saving}
                />
              </label>
              <label>
                Phone number
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={handleChange('phone')}
                  placeholder="0300-1234567"
                  required
                  disabled={saving}
                />
              </label>
              {errorMessage && <p className="form-error">{errorMessage}</p>}
              {statusMessage && <p className="auth-message">{statusMessage}</p>}
              <button type="submit" className="auth-button auth-button--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          )
        )}

        {activeTab === 'bookings' && (
          isLoadingBookings ? (
            <p className="status">Loading bookings…</p>
          ) : bookings.length === 0 ? (
            <div className="bookings-empty">
              <p>No bookings yet. <Link to="/">Start booking a ground</Link></p>
            </div>
          ) : (
            <div className="bookings-list">
              <div className="bookings-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Bookings:</span>
                  <span className="summary-value">{bookings.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Spent:</span>
                  <span className="summary-value">Rs. {bookings.reduce((sum, b) => sum + (b.priceAtBooking || 0), 0).toLocaleString('en-PK')}</span>
                </div>
              </div>

              <div className="bookings-table">
                <div className="bookings-header">
                  <div className="col-ground">Ground</div>
                  <div className="col-date">Date & Time</div>
                  <div className="col-price">Price</div>
                  <div className="col-status">Status</div>
                </div>

                {bookings.map((booking) => (
                  <div key={booking.id} className="bookings-row">
                    <div className="col-ground">
                      <div className="ground-info">
                        <strong>{booking.groundName}</strong>
                        <small>{booking.location}, {booking.city}</small>
                      </div>
                    </div>
                    <div className="col-date">
                      <div className="date-info">
                        {new Date(booking.date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })}
                        <br />
                        <small>{booking.slot}</small>
                      </div>
                    </div>
                    <div className="col-price">Rs. {booking.priceAtBooking}</div>
                    <div className="col-status">
                      <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default AccountPage;
