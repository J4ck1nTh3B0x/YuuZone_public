import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthConsumer from "../../components/AuthContext.jsx";
import { AppLogo } from "../../components/Navbar.jsx";
import Svg from "../../components/Svg.jsx";
import Loader from "../../components/Loader.jsx";
import LoadingDots from "../../components/LoadingDots.jsx";
import logo from "../../assets/logo.png";
import errorImage from "../../assets/error.png";
import { toast } from 'react-toastify';
import { handleRateLimitError } from "../../utils/formProtection";

export function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, login } = AuthConsumer();
  const [showPass, setShowPass] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  
  const { mutate, error, status } = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      setProgressStep(1);
      
      // Simulate progress steps for better UX
      setTimeout(() => setProgressStep(2), 500);
      setTimeout(() => setProgressStep(3), 1000);
      
      return await axios.post("/api/user/register", { username, email: email.toLowerCase(), password });
    },
    onSuccess: (response) => {
      setProgressStep(4);
      toast.success(t('auth.verifyEmailBeforeLogin'));
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    },
    onError: (error) => {
      setIsSubmitting(false);
      setProgressStep(0);
      
      // Handle rate limiting and duplicate submission errors
      if (handleRateLimitError(error, 'register')) {
        return;
      }
      
      let errorMessage = t('auth.registrationFailed');
      let errorDetails = [];

      if (error.response?.data?.user_message) {
        errorMessage = error.response.data.user_message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      // Extract specific field errors for better feedback
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (errors.username) {
          errorDetails.push(...errors.username);
        }
        if (errors.email) {
          errorDetails.push(...errors.email);
        }
        if (errors.password) {
          errorDetails.push(...errors.password);
        }
      }

      // Show detailed error message
      if (errorDetails && Array.isArray(errorDetails) && errorDetails.length > 0) {
        errorDetails.forEach(detail => {
          toast.error(detail);
        });
      } else {
        toast.error(errorMessage);
      }
    },
  });
  useEffect(() => {
    document.title = "yuuzone | Signup";
    return () => {
      document.title = "yuuzone";
    };
  });
  if (isAuthenticated) {
    return navigate("/home");
  }
  const {
    username: usernameError,
    email: emailError,
    password: passwordError,
  } = error?.response?.data?.errors || {};
  return (
    <div
      className="flex justify-center items-center w-screen h-screen md:space-x-10 bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isSubmitting) {
          mutate();
        }
      }}>
      <AppLogo forBanner={true} />
      <div className="flex flex-col p-5 py-10 space-y-10 bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text rounded-md shadow-xl md:p-5">
        <div className="flex justify-center md:hidden">
          <AppLogo>
            <h1 className="font-mono text-3xl font-bold tracking-tight md:block text-theme-text-primary dark:text-theme-dark-text-secondary">yuuzone</h1>
          </AppLogo>
        </div>
        <h1 className={`${!isSubmitting && "text-2xl"} font-semibold tracking-wide`}>
          <div className="flex justify-center">
            <img 
              src={logo} 
              className="object-cover w-92 h-32 mb-5" 
              alt="YuuZone-logo" 
              width="368"
              height="128"
            />
          </div>
          {t('auth.welcome')}
        </h1>
        <form className="flex flex-col items-center space-y-5 bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text">
          <label htmlFor="username" className="flex flex-col space-y-1">
            <span className="pl-2 text-sm font-light">{t('auth.username')}</span>
            <input
              type="text"
              name="username"
              id="username"
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
              }}
              maxLength={15}
              minLength={4}
              className="px-2 py-2 pr-24 border-b focus:outline-none focus:border-black bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:placeholder-theme-dark-placeholder-80 w-full"
            />
            {usernameError?.map((e) => (
              <div key={e} className="flex items-center space-x-2 mt-1 p-2 bg-red-50 border border-red-200 rounded-md dark:bg-theme-dark-bg dark:text-theme-dark-text">
                <img
                  src={errorImage}
                  alt="Error"
                  className="w-4 h-4 flex-shrink-0"
                />
                <span title={e} className="text-sm font-semibold text-red-600 truncate break-words whitespace-pre-line w-full" style={{wordBreak: 'break-word', overflowWrap: 'break-word'}}>
                  {e}
                </span>
              </div>
            ))}
          </label>
          <label htmlFor="email" className="flex flex-col space-y-1">
            <span className="pl-2 text-sm font-light">{t('auth.email')}</span>
            <input
              type="email"
              name="email"
              id="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              className="px-2 py-2 pr-24 border-b focus:outline-none focus:border-black bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text dark:placeholder-theme-dark-placeholder-80 w-full"
            />
            {emailError?.map((e) => (
              <div key={e} className="flex items-center space-x-2 mt-1 p-2 bg-red-50 border border-red-200 rounded-md dark:bg-theme-dark-bg dark:text-theme-dark-text">
                <img
                  src={errorImage}
                  alt="Error"
                  className="w-4 h-4 flex-shrink-0"
                />
                <span title={e} className="text-sm font-semibold text-red-600 truncate break-words whitespace-pre-line w-full" style={{wordBreak: 'break-word', overflowWrap: 'break-word'}}>
                  {e}
                </span>
              </div>
            ))}
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
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                minLength={8}
                aria-describedby="password-toggle"
              />
              {passwordError?.map((e) => (
                <div key={e} className="flex items-center space-x-2 mt-1 p-2 bg-red-50 border border-red-200 rounded-md dark:bg-theme-dark-bg dark:text-theme-dark-text">
                  <img
                    src={errorImage}
                    alt="Error"
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <span title={e} className="text-sm font-semibold text-red-600 truncate break-words whitespace-pre-line w-full" style={{wordBreak: 'break-word', overflowWrap: 'break-word'}}>
                    {e}
                  </span>
                </div>
              ))}
              <button 
                type="button" 
                id="password-toggle"
                className="bg-transparent border-none p-0 m-0 cursor-pointer" 
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
              >
              {showPass ? (
                  <Svg type="eye-open" className="w-6 h-6" />
              ) : (
                  <Svg type="eye-close" className="w-6 h-6" />
              )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="py-2 w-full font-semibold text-white rounded-md bg-theme-blue active:scale-95 dark:bg-theme-blue disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t('auth.signingUp')}</span>
              </div>
            ) : (
              t('auth.signUp')
            )}
          </button>
        </form>
        <div className="flex justify-between">
          <Link to="/login" className="flex font-semibold cursor-pointer hover:text-theme-blue group">
            {t('auth.signIn')}
            <Svg
              type="arrow-right"
              className="invisible w-6 h-6 duration-200 group-hover:visible text-theme-blue group-hover:translate-x-1"></Svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
