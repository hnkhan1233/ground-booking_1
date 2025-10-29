import { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { API_BASE_URL } from '../../../config.js';
import '../../../App.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT_DURATIONS = [15, 30, 45, 60, 90, 120];

// Convert 24-hour time to 12-hour AM/PM format
function formatTime12Hour(time24) {
  if (!time24) return '';
  const [hour, minute] = time24.split(':').map(Number);
  let displayHour = hour % 12;
  if (displayHour === 0) displayHour = 12;
  const period = hour < 12 ? 'AM' : 'PM';
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

// Generate time options in AM/PM format
function generateTimeOptions() {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const time12 = formatTime12Hour(time24);
      options.push({ value: time24, label: time12 });
    }
  }
  return options;
}

const OperatingHoursConfigurator = forwardRef(function OperatingHoursConfigurator({ groundId, getIdToken }, ref) {
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => {
    fetchOperatingHours();
  }, [groundId]);

  const fetchOperatingHours = async () => {
    try {
      setLoading(true);
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

  // Apply settings from one day to all other days
  const applyToAllDays = (dayOfWeek) => {
    const sourceDay = hours.find((h) => h.day_of_week === dayOfWeek);
    if (!sourceDay) return;

    setHours((prev) =>
      prev.map((h) =>
        h.day_of_week === dayOfWeek
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
  };

  // Expose getOperatingHoursData through ref
  useImperativeHandle(ref, () => ({
    getOperatingHoursData: () => hours,
  }));

  if (loading) {
    return <div className="oh-loading">Loading operating hours...</div>;
  }

  return (
    <div className="operating-hours-configurator">
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
                        <select
                          value={dayHours.start_time}
                          onChange={(e) =>
                            handleTimeChange(dayHours.day_of_week, 'start_time', e.target.value)
                          }
                          className="oh-time-select"
                        >
                          {generateTimeOptions().map((time) => (
                            <option key={time.value} value={time.value}>
                              {time.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="oh-input-group">
                        <label>Closing Time</label>
                        <select
                          value={dayHours.end_time}
                          onChange={(e) =>
                            handleTimeChange(dayHours.day_of_week, 'end_time', e.target.value)
                          }
                          className="oh-time-select"
                        >
                          {generateTimeOptions().map((time) => (
                            <option key={time.value} value={time.value}>
                              {time.label}
                            </option>
                          ))}
                        </select>
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
                    className="oh-btn oh-btn--apply-all"
                    onClick={() => applyToAllDays(dayHours.day_of_week)}
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
                    {formatTime12Hour(dayHours.start_time)} - {formatTime12Hour(dayHours.end_time)}
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
});

export default OperatingHoursConfigurator;
