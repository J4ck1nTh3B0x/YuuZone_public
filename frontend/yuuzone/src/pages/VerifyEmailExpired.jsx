import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppLogo } from '../components/Navbar.jsx';
import Svg from '../components/Svg.jsx';

export default function VerifyEmailExpired() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      <AppLogo />
      <div className="bg-theme-less-white dark:bg-theme-dark-card p-8 rounded-md shadow-md flex flex-col items-center max-w-md w-full mx-4">
        {/* Error Icon */}
        <div className="w-16 h-16 bg-theme-error-light dark:bg-theme-dark-bg rounded-full flex items-center justify-center mb-4">
          <Svg type="alert" className="w-8 h-8 text-theme-error" />
        </div>
        
        <h1 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4 text-center">
          {t('auth.emailVerificationExpiredTitle', 'Email Verification Expired')}
        </h1>
        
        <div className="text-center space-y-4 mb-6">
          <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary">
            {t('auth.emailVerificationExpiredMessage', 'Your email verification link has expired. This can happen if:')}
          </p>
          
          <ul className="text-left text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary space-y-2">
            <li className="flex items-start space-x-2">
              <span className="text-theme-error">•</span>
              <span>{t('auth.emailVerificationExpiredReason1', 'You waited more than 10 minutes to click the link')}</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-theme-error">•</span>
              <span>{t('auth.emailVerificationExpiredReason2', 'The link was already used to verify your email')}</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-theme-error">•</span>
              <span>{t('auth.emailVerificationExpiredReason3', 'Your account was already verified')}</span>
            </li>
          </ul>
        </div>
        
        <div className="flex flex-col space-y-3 w-full">
          <button
            onClick={() => navigate('/register')}
            className="w-full px-6 py-3 bg-theme-blue text-white rounded-md hover:bg-theme-blue-dark transition-colors font-semibold"
          >
            {t('auth.createNewAccount', 'Create New Account')}
          </button>
          
          <button
            onClick={() => navigate('/login')}
            className="w-full px-6 py-3 bg-theme-bg-secondary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text rounded-md hover:bg-theme-bg-hover dark:hover:bg-theme-dark-hover transition-colors font-semibold border border-theme-border-light dark:border-theme-dark-border"
          >
            {t('auth.backToLogin', 'Back to Login')}
          </button>
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-theme-text-muted dark:text-theme-dark-text-secondary">
            {t('auth.needHelp', 'Need help?')} 
            <button 
              onClick={() => navigate('/contact')}
              className="text-theme-blue hover:underline ml-1"
            >
              {t('auth.contactSupport', 'Contact Support')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
} 