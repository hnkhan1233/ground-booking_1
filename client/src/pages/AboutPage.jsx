import { Link } from 'react-router-dom';

function AboutPage() {
  return (
    <div className="about-page">
      <header className="about-header">
        <div className="about-header__content">
          <h1>About Us</h1>
          <p className="about-header__subtitle">Making sports venue booking simple and accessible</p>
        </div>
      </header>

      <main className="layout layout--sporty">
        <section className="about-intro">
          <p>
            We believe that booking a sports ground shouldn't be complicated. Our mission is to provide a simple, transparent, and reliable platform for athletes, teams, and fitness enthusiasts across Pakistan to find and book the perfect venue.
          </p>
        </section>

        <div className="about-grid">
          <section className="about-card">
            <h3>What We Do</h3>
            <ul className="about-list--compact">
              <li>Real-time slot availability</li>
              <li>Book multiple slots instantly</li>
              <li>Detailed facility information</li>
              <li>Easy booking management</li>
            </ul>
          </section>

          <section className="about-card">
            <h3>Coverage</h3>
            <div className="about-cities">
              <span className="about-city">Karachi</span>
              <span className="about-city">Lahore</span>
              <span className="about-city">Islamabad</span>
              <span className="about-city">Rawalpindi</span>
            </div>
            <p className="about-card__note">More cities coming soon!</p>
          </section>
        </div>

        <section className="about-why">
          <h2>Why Choose Us?</h2>
          <div className="about-features">
            <div className="about-feature">
              <div className="about-feature__icon">✓</div>
              <h4>Real-time Availability</h4>
              <p>Check actual slot availability before booking</p>
            </div>
            <div className="about-feature">
              <div className="about-feature__icon">✓</div>
              <h4>Transparent Pricing</h4>
              <p>No hidden charges, what you see is what you pay</p>
            </div>
            <div className="about-feature">
              <div className="about-feature__icon">✓</div>
              <h4>Multiple Slots</h4>
              <p>Book consecutive time slots for extended play</p>
            </div>
            <div className="about-feature">
              <div className="about-feature__icon">✓</div>
              <h4>Easy Management</h4>
              <p>Cancel bookings or view history anytime</p>
            </div>
          </div>
        </section>

        <section className="about-cta-section">
          <h2>Ready to Book?</h2>
          <p>Find the perfect ground for your next game</p>
          <Link to="/" className="about-cta">
            Browse Grounds
          </Link>
        </section>
      </main>

      <footer className="footer footer--sporty">
        <div>
          <p>Need to cancel? Share your booking ID with the facility manager for a quick release.</p>
          <p className="footer__credit">Built for competitive squads and weekend warriors across Pakistan.</p>
        </div>
      </footer>
    </div>
  );
}

export default AboutPage;
