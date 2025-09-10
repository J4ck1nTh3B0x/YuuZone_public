import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthConsumer from "../../components/AuthContext.jsx";
import Loader from "../../components/Loader.jsx";
import LoadingDots from "../../components/LoadingDots.jsx";
import { AppLogo } from "../../components/Navbar.jsx";
import Svg from "../../components/Svg.jsx";
import logo from "../../assets/logo.png";
import errorImage from "../../assets/error.png";
import { toast } from "react-toastify";
import { handleRateLimitError } from "../../utils/formProtection";

export function Login() {
  const { t } = useTranslation();
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [isAttemptingDifferentAccount, setIsAttemptingDifferentAccount] = useState(false);
  const { isAuthenticated, login, logout, user } = AuthConsumer();
  const navigate = useNavigate();
  const { mutate, status, error, reset } = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      setProgressStep(1);
      
      // Simulate progress steps for better UX
      setTimeout(() => setProgressStep(2), 300);
      setTimeout(() => setProgressStep(3), 600);
      
      return await axios
        .post("/api/user/login", { email: email.toLowerCase(), password })
        .then((res) => login(res.data));
    },
    onSuccess: (data) => {
      setProgressStep(4);
      setHasExistingSession(true); // Update session state after successful login
      
      // Check if this is a different account than the currently logged in user
      if (isAuthenticated && user && data && data.email !== user.email) {
        setIsAttemptingDifferentAccount(true);
      } else {
        // Same account or new login - process silently
        toast.success(t('auth.loginSuccessful'));
        setTimeout(() => {
          navigate("/all");
        }, 1000);
      }
    },
    onError: (error) => {
      setIsSubmitting(false);
      setProgressStep(0);
      
      // Handle rate limiting and duplicate submission errors
      if (handleRateLimitError(error, 'login')) {
        return;
      }
      
      let errorMessage = t('auth.invalidCredentials');
      
      if (error.response?.data?.user_message) {
        errorMessage = error.response.data.user_message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      // Show specific error messages for different error codes
      if (error.response?.data?.error_code === "EMAIL_NOT_VERIFIED") {
        toast.error(t('auth.email_not_verified'));
      } else if (error.response?.data?.error_code === "INVALID_CREDENTIALS") {
        toast.error(t('auth.invalidCredentials'));
      } else {
        toast.error(errorMessage);
      }
    },
  });
  useEffect(() => {
    document.title = "yuuzone | Login";
    return () => {
      document.title = "yuuzone";
    };
  });

  // Check if there's an existing session cookie
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        // Check if there's a session cookie
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find(cookie => 
          cookie.trim().startsWith('yuuzone_session=')
        );
        
        // Only show "Already Logged In" if there's both authentication state AND a session cookie
        // Also check if the session cookie has a valid value (not empty)
        const hasValidSession = sessionCookie && sessionCookie.includes('=') && 
          sessionCookie.split('=')[1] && sessionCookie.split('=')[1].trim() !== '';
        
        setHasExistingSession(!!(isAuthenticated && hasValidSession));
      } catch (error) {
        // If there's any error checking cookies, assume no existing session
        setHasExistingSession(false);
      }
    };

    checkExistingSession();
  }, [isAuthenticated]);

  // Remove automatic redirect - allow authenticated users to access login page
  // if (isAuthenticated) {
  //   return navigate("/home");
  // }

  // Extract user and developer messages from error response if available
  // const userMessage = error?.response?.data?.user_message || null;
  // const developerMessage = error?.response?.data?.developer_message || null;

  return (
    <div className="flex justify-center items-center min-h-screen md:space-x-10 bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      <AppLogo forBanner={true} />
      <div className="flex flex-col p-5 py-10 space-y-10 bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text rounded-md shadow-xl md:p-5">
        <div className="flex justify-center md:hidden">
          <AppLogo>
            <h1 className="font-mono text-3xl font-bold tracking-tight md:block text-theme-text-primary dark:text-theme-dark-text-secondary">yuuzone</h1>
          </AppLogo>
        </div>
        <h1
          className={`font-semibold ${
            !isSubmitting && "text-2xl "
          } tracking-wide ${error ? "font-bold uppercase text-theme-blue" : ""}`}
        >
          <div className="flex justify-center">
            <img 
              src={logo} 
              className="object-cover w-92 h-32 mb-5" 
              alt="YuuZone-logo" 
              width="368"
              height="128"
            />
          </div>
          {isAttemptingDifferentAccount ? (
            <div className="text-center font-bold uppercase text-theme-blue text-2xl">
              {t('auth.alreadyLoggedIn')}
            </div>
          ) : (
            t('auth.welcomeBack')
          )}
        </h1>
        
        {/* Switch Account Section - Only shows when attempting to login to a different account */}
        {isAttemptingDifferentAccount && (
          <div className="text-center space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-blue-800 dark:text-blue-200 font-medium">
              Currently logged in as: <span className="font-bold">{user?.username || user?.email}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => navigate("/all")}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
              >
                Continue as {user?.username || user?.email}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Logout and clear form
                  logout({ redirect: false });
                  setEmail("");
                  setPassword("");
                  reset();
                  setHasExistingSession(false);
                  setIsAttemptingDifferentAccount(false);
                  // Force a small delay to ensure logout completes
                  setTimeout(() => {
                    // The logout function will clear the auth state
                  }, 100);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
              >
                Switch Account
              </button>
            </div>
          </div>
        )}
        
        <form
          className="flex flex-col items-center space-y-5 bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text"
          onSubmit={(e) => {
            e?.preventDefault();
            if (!isSubmitting) {
              mutate();
            }
          }}
        >
          <label htmlFor="email" className="flex flex-col space-y-1">
            <span className="pl-2 text-sm font-light">{t('auth.email')}</span>
            <input
              type="email"
              name="email"
              id="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                reset();
                setIsAttemptingDifferentAccount(false);
              }}
              className="px-2 py-2 pr-24 border-b focus:outline-none focus:border-black bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:placeholder-theme-dark-placeholder-80 w-full"
            />
          </label>
          <div className="flex flex-col space-y-1">
            <span className="pl-2 text-sm font-light">{t('auth.password')}</span>
            <div className="flex items-center border-b">
              <input
                type={showPass ? "text" : "password"}
                name="password"
                id="password"
                className="px-2 py-2 pr-20 focus:outline-none bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:placeholder-theme-dark-placeholder-80 w-full"
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  reset();
                  setIsAttemptingDifferentAccount(false);
                }}
                aria-describedby="password-toggle"
              />
              <button 
                type="button" 
                id="password-toggle"
                className="bg-transparent border-none p-0 m-0 cursor-pointer" 
                tabIndex={-1} 
                style={{boxShadow: 'none'}} 
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                <Svg type={showPass ? "eye-open" : "eye-close"} className="w-6 h-6" />
              </button>
            </div>
          </div>
          {error?.response?.data?.error_code === "INVALID_CREDENTIALS" && (
            <div className="flex items-center space-x-2 p-2 bg-theme-error-light border border-theme-error-border rounded-md w-full dark:bg-theme-dark-bg dark:text-theme-dark-text">
              <img
                src={errorImage}
                alt="Error"
                className="w-5 h-5 flex-shrink-0"
              />
              <p className="text-sm text-theme-error">
                {t('auth.invalidCredentials')}
              </p>
            </div>
          )}
          {/* Show error for unverified email */}
          {(error?.response?.data?.error_code === "EMAIL_NOT_VERIFIED" || error?.response?.data?.error_code === "email_not_verified") && (
            <div className="flex items-center space-x-2 p-2 bg-theme-error-light border border-theme-error-border rounded-md w-full dark:bg-theme-dark-bg dark:text-theme-dark-text">
              <img
                src={errorImage}
                alt="Error"
                className="w-5 h-5 flex-shrink-0"
              />
              <p className="text-sm text-theme-error break-words whitespace-pre-line w-full" style={{wordBreak: 'break-word', overflowWrap: 'break-word'}}>
                {t('auth.email_not_verified')}
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="py-2 w-full font-semibold text-white rounded-md bg-theme-blue active:scale-95 dark:bg-theme-blue disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t('auth.loggingIn')}</span>
              </div>
            ) : (
              t('auth.signIn')
            )}
          </button>
        </form>
        <div className="flex justify-between">
          <Link to="/forgot-password" className="flex font-semibold cursor-pointer group hover:text-theme-blue">
            {t('auth.forgotPassword')}
            <Svg
              type="arrow-right"
              className="invisible w-6 h-6 duration-200 group-hover:visible text-theme-blue group-hover:translate-x-1"
            ></Svg>
          </Link>
          <Link to="/register" className="flex font-semibold cursor-pointer hover:text-theme-blue group">
            {t('auth.signUp')}
            <Svg
              type="arrow-right"
              className="invisible w-6 h-6 duration-200 group-hover:visible text-theme-blue group-hover:translate-x-1"
            ></Svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
