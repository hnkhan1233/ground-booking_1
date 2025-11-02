import { useEffect } from 'react';
import './Lightbox.css';

function Lightbox({ images, currentIndex, onClose, onNavigate }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight') {
        onNavigate(1);
      } else if (event.key === 'ArrowLeft') {
        onNavigate(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate]);

  if (currentIndex === null || !images[currentIndex]) {
    return null;
  }

  const currentImage = images[currentIndex];
  const showNavigation = images.length > 1;

  return (
    <>
      {/* Main overlay with image */}
      <div className="lightbox-overlay" onClick={onClose}>
        <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
          <img
            src={currentImage.url}
            alt={currentImage.alt || `Image ${currentIndex + 1}`}
            className="lightbox-image"
          />
        </div>
      </div>

      {/* Top bar */}
      <div className="lightbox-topbar">
        {/* Close button (left) */}
        <button
          type="button"
          className="lightbox-close"
          onClick={onClose}
          aria-label="Close gallery"
        >
          <span className="lightbox-close-icon">✕</span>
          <span className="lightbox-close-text">Close</span>
        </button>

        {/* Counter (center) */}
        <div className="lightbox-counter">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Navigation buttons (only if multiple images) */}
      {showNavigation && (
        <>
          <button
            type="button"
            className="lightbox-nav lightbox-nav--prev"
            onClick={() => onNavigate(-1)}
            aria-label="Previous image"
          >
            &lt;
          </button>
          <button
            type="button"
            className="lightbox-nav lightbox-nav--next"
            onClick={() => onNavigate(1)}
            aria-label="Next image"
          >
            &gt;
          </button>
        </>
      )}
    </>
  );
}

export default Lightbox;
