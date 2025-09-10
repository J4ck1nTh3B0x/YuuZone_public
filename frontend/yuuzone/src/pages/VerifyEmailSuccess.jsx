import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppLogo } from '../components/Navbar.jsx';

export default function VerifyEmailSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      <AppLogo />
      <div className="bg-theme-less-white dark:bg-theme-dark-card p-8 rounded-md shadow-md flex flex-col items-center">
        <h1 className="text-2xl font-bold text-theme-blue dark:text-theme-blue mb-4 text-center">
          {t('auth.emailVerifiedTitle', 'Email Verified!')}
        </h1>
        <p className="mb-4 text-center text-theme-text-primary dark:text-theme-dark-text">
          {t('auth.emailVerifiedMessage', 'Your email has been successfully verified. You can now log in to your account.')}
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2 bg-theme-blue text-white rounded-md hover:bg-blue-600 mt-2"
        >
          {t('auth.login')}
        </button>
      </div>
    </div>
  );
} 