import "./loader.css";
import PropTypes from "prop-types";
import loadingGif from "../assets/loading.gif";

export function Loader({ children = null }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen min-w-screen bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      {children ? (
        children
      ) : (
        <img 
          src={loadingGif} 
          alt="Loading..." 
          style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)' 
          }} 
        />
      )}
    </div>
  );
}

Loader.propTypes = {
  children: PropTypes.node,
};

export default Loader;
