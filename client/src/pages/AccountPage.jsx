import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { API_BASE_URL } from '../config.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import '../App.css';

function AccountPage() {
  const { user, initializing, getIdToken, logout } = useAuth();
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

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
          <p>Update the contact details used for your ground bookings.</p>
        </div>
        <div className="account__actions">
          <Link to="/" className="link-button link-button--inline">Back to booking</Link>
          <button type="button" className="ghost-button" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </div>

      <div className="account-card">
        {isLoading ? (
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
        )}
      </div>
    </div>
  );
}

export default AccountPage;
