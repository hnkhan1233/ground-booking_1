import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config.js';
import '../App.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT_DURATIONS = [15, 30, 45, 60, 90, 120];

function OperatingHoursConfigurator({ groundId, getIdToken }) {
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => {
    fetchOperatingHours();
  }, [groundId]);

  const fetchOperatingHours = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const token = await getIdToken();

      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/api/operating-hours/ground/${groundId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load operating hours (${response.status})`);
      }

      const data = await response.json();
      setHours(data);
    } catch (error) {
      console.error('Operating hours fetch error:', error);
      setMessage({ type: 'error', text: error.message || 'Could not load operating hours' });
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = (dayOfWeek, field, value) => {
    setHours((prev) =>
      prev.map((h) =>
        h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h
      )
    );
  };

  const handleToggleClosed = (dayOfWeek) => {
    setHours((prev) =>
      prev.map((h) =>
        h.day_of_week === dayOfWeek ? { ...h, is_closed: h.is_closed ? 0 : 1 } : h
      )
    );
  };

  const handleSave = async (dayOfWeek) => {
    const dayHours = hours.find((h) => h.day_of_week === dayOfWeek);
    if (!dayHours) return;

    try {
      setSaving(true);
      const token = await getIdToken();

      const response = await fetch(
        `${API_BASE_URL}/api/operating-hours/ground/${groundId}/day/${dayOfWeek}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            startTime: dayHours.start_time,
            endTime: dayHours.end_time,
            slotDurationMinutes: dayHours.slot_duration_minutes,
            isClosed: dayHours.is_closed,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to save');

      setMessage({ type: 'success', text: `${DAYS[dayOfWeek]} saved successfully` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to save operating hours' });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToAll = async () => {
    if (!expandedDay && expandedDay !== 0) return;

    const sourceDay = hours[expandedDay];
    if (!sourceDay) return;

    try {
      setSaving(true);

      // Apply to all days
      for (let day = 0; day < 7; day++) {
        if (day === expandedDay) continue;

        const token = await getIdToken();
        await fetch(
          `${API_BASE_URL}/api/operating-hours/ground/${groundId}/day/${day}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              startTime: sourceDay.start_time,
              endTime: sourceDay.end_time,
              slotDurationMinutes: sourceDay.slot_duration_minutes,
              isClosed: sourceDay.is_closed,
            }),
          }
        );
      }

      // Update local state
      setHours((prev) =>
        prev.map((h) =>
          h.day_of_week === expandedDay
            ? h
            : {
                ...h,
                start_time: sourceDay.start_time,
                end_time: sourceDay.end_time,
                slot_duration_minutes: sourceDay.slot_duration_minutes,
                is_closed: sourceDay.is_closed,
              }
        )
      );

      setMessage({ type: 'success', text: 'Settings applied to all days' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to apply settings to all days' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="oh-loading">Loading operating hours...</div>;
  }

  return (
    <div className="operating-hours-configurator">
      {message && (
        <div className={`oh-message oh-message--${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="oh-header">
        <h3>Operating Hours by Day</h3>
        <p className="oh-subtitle">Set opening hours and slot duration for each day</p>
      </div>

      <div className="oh-days-grid">
        {hours.map((dayHours) => (
          <div key={dayHours.day_of_week} className="oh-day-card">
            <button
              className="oh-day-header"
              onClick={() =>
                setExpandedDay(
                  expandedDay === dayHours.day_of_week ? null : dayHours.day_of_week
                )
              }
            >
              <span className="oh-day-name">{DAYS[dayHours.day_of_week]}</span>
              <span className="oh-day-chevron">
                {expandedDay === dayHours.day_of_week ? '−' : '+'}
              </span>
            </button>

            {expandedDay === dayHours.day_of_week && (
              <div className="oh-day-content">
                <div className="oh-toggle-closed">
                  <input
                    type="checkbox"
                    id={`closed-${dayHours.day_of_week}`}
                    checked={dayHours.is_closed}
                    onChange={() => handleToggleClosed(dayHours.day_of_week)}
                  />
                  <label htmlFor={`closed-${dayHours.day_of_week}`}>Closed on this day</label>
                </div>

                {!dayHours.is_closed && (
                  <>
                    <div className="oh-time-inputs">
                      <div className="oh-input-group">
                        <label>Opening Time</label>
                        <input
                          type="time"
                          value={dayHours.start_time}
                          onChange={(e) =>
                            handleTimeChange(dayHours.day_of_week, 'start_time', e.target.value)
                          }
                        />
                      </div>

                      <div className="oh-input-group">
                        <label>Closing Time</label>
                        <input
                          type="time"
                          value={dayHours.end_time}
                          onChange={(e) =>
                            handleTimeChange(dayHours.day_of_week, 'end_time', e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="oh-slot-duration">
                      <label>Slot Duration</label>
                      <div className="oh-slot-options">
                        {SLOT_DURATIONS.map((duration) => (
                          <button
                            key={duration}
                            className={`oh-slot-btn ${
                              dayHours.slot_duration_minutes === duration ? 'oh-slot-btn--active' : ''
                            }`}
                            onClick={() =>
                              handleTimeChange(
                                dayHours.day_of_week,
                                'slot_duration_minutes',
                                duration
                              )
                            }
                          >
                            {duration < 60 ? `${duration}m` : `${duration / 60}h`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="oh-actions">
                  <button
                    className="oh-btn oh-btn--save"
                    onClick={() => handleSave(dayHours.day_of_week)}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    className="oh-btn oh-btn--apply-all"
                    onClick={handleApplyToAll}
                    disabled={saving}
                  >
                    Apply to All Days
                  </button>
                </div>
              </div>
            )}

            {/* Collapsed view showing current hours */}
            {expandedDay !== dayHours.day_of_week && (
              <div className="oh-day-summary">
                {dayHours.is_closed ? (
                  <span className="oh-closed-badge">Closed</span>
                ) : (
                  <span className="oh-hours-badge">
                    {dayHours.start_time} - {dayHours.end_time}
                    <br />
                    <small>{dayHours.slot_duration_minutes}m slots</small>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default OperatingHoursConfigurator;
