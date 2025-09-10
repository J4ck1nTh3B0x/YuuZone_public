import PropTypes from "prop-types";
import "./loader.css";

LoadingDots.propTypes = {
  text: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Animated loading dots component for buttons and inline loading states
 * Shows text followed by three animated dots that move in a wave pattern
 */
export function LoadingDots({ text = "", className = "" }) {
  return (
    <span className={`flex items-center gap-1 ${className}`}>
      {text && <span>{text}</span>}
      <span className="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </span>
  );
}

export default LoadingDots;
