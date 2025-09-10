import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { AppLogo } from "../../components/Navbar.jsx";

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await axiosInstance.post('/user/forgot-password', { email });
      setMessage(t('forgotPassword.resetEmailSent'));
    } catch (err) {
      setError(err.response?.data?.message || t('forgotPassword.requestError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError(t('forgotPassword.passwordsDoNotMatch'));
      setLoading(false);
      return;
    }

    try {
      await axiosInstance.post(`/user/reset-password/${token}`, { password });
      setMessage(t('forgotPassword.passwordResetSuccess'));
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      if (err.response?.data?.message?.includes('expired') || err.response?.data?.message?.includes('invalid')) {
        // Redirect to expired page
        navigate('/password-reset-expired');
      } else {
        setError(err.response?.data?.message || t('forgotPassword.resetError'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    // Reset password form
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
        <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-theme-dark-card rounded-lg shadow-md">
          <div className="text-center">
            <AppLogo />
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
              {t('forgotPassword.resetPassword')}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t('forgotPassword.enterNewPassword')}
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('forgotPassword.newPassword')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('forgotPassword.newPasswordPlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('forgotPassword.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
              />
            </div>

            {message && (
              <div className="text-green-600 dark:text-green-400 text-sm text-center">
                {message}
              </div>
            )}

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('common.loading') : t('forgotPassword.resetPassword')}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-sm"
              >
                {t('forgotPassword.backToLogin')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Request reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-theme-dark-card rounded-lg shadow-md">
        <div className="text-center">
          <AppLogo />
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            {t('forgotPassword.forgotPassword')}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('forgotPassword.enterEmailToReset')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleRequestReset}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('forgotPassword.email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('forgotPassword.emailPlaceholder')}
            />
          </div>

          {message && (
            <div className="text-green-600 dark:text-green-400 text-sm text-center">
              {message}
            </div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('forgotPassword.sendResetLink')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-sm"
            >
              {t('forgotPassword.backToLogin')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
