import { Navigate } from "react-router-dom";
import AuthConsumer from "./AuthContext.jsx";
import PropTypes from "prop-types";

RequireAuth.propTypes = {
  children: PropTypes.node,
  redirectTo: PropTypes.string,
};

function RequireAuth({ children, redirectTo = "/login" }) {
  const { isAuthenticated, isLoading } = AuthConsumer();
  
  // Show loading while validating authentication
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-theme-blue"></div>
    </div>;
  }
  
  return isAuthenticated ? children : <Navigate replace={true} to={redirectTo} />;
}

export default RequireAuth;
