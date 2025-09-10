import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { toast } from "react-toastify";
import { AppLogo } from "../components/Navbar.jsx";
import AuthConsumer from "../components/AuthContext.jsx";

export default function AccountDeletionVerification() {
  const { t } = useTranslation();
  const { token } = useParams();
  const navigate = useNavigate();
  const { logout } = AuthConsumer();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [searchParams] = useSearchParams();
  const noAutoRedirect = searchParams.get('no_auto_redirect');

  useEffect(() => {
    document.title = "Account Deletion Verification - YuuZone";
    
    // Check if this is a success/error redirect from backend
    const reason = searchParams.get('reason');
    
    if (reason) {
      // This is a redirect from backend
      if (reason === 'success') {
        setVerificationStatus('success');
        toast.success(t('settings.deletionVerificationSuccess'));
        
        // Use the proper logout function to clear all authentication data
        logout({ redirect: false }).then(() => {
          // Only redirect to login if no_auto_redirect is not set
          if (!noAutoRedirect) {
            setTimeout(() => {
              navigate("/login");
            }, 3000);
          }
        }).catch(() => {
          // If logout fails, only redirect if no_auto_redirect is not set
          if (!noAutoRedirect) {
            setTimeout(() => {
              navigate("/login");
            }, 3000);
          }
        });
      } else {
        setVerificationStatus('error');
        let errorMessage = t('settings.deletionVerificationInvalid');
        
        if (reason === 'expired') {
          errorMessage = t('settings.deletionVerificationExpired');
        } else if (reason === 'server_error') {
          errorMessage = t('settings.failedToDeleteAccount');
        }
        
        toast.error(errorMessage);
        
        // Redirect to settings after 3 seconds
        setTimeout(() => {
          navigate("/settings");
        }, 3000);
      }
      setIsVerifying(false);
      return;
    }
    
    // Handle direct API call (legacy flow)
    const verifyDeletion = async () => {
      try {
        await axios.get(`/api/user/verify-deletion/${token}`);
        setVerificationStatus('success');
        toast.success(t('settings.deletionVerificationSuccess'));
        
        // Use the proper logout function to clear all authentication data
        logout({ redirect: false }).then(() => {
          // Only redirect to login if no_auto_redirect is not set
          if (!noAutoRedirect) {
            setTimeout(() => {
              navigate("/login");
            }, 3000);
          }
        }).catch(() => {
          // If logout fails, only redirect if no_auto_redirect is not set
          if (!noAutoRedirect) {
            setTimeout(() => {
              navigate("/login");
            }, 3000);
          }
        });
        
      } catch (error) {
        setVerificationStatus('error');
        const errorMessage = error.response?.data?.user_message || t('settings.deletionVerificationInvalid');
        toast.error(errorMessage);
        
        // Redirect to settings after 3 seconds
        setTimeout(() => {
          navigate("/settings");
        }, 3000);
      } finally {
        setIsVerifying(false);
      }
    };

    if (token) {
      verifyDeletion();
    } else {
      setVerificationStatus('error');
      setIsVerifying(false);
    }
  }, [token, navigate, t, searchParams]);

  useEffect(() => {
    if (noAutoRedirect) {
      return;
    }

    const timer = setTimeout(() => {
      logout();
    }, 3000);

    return () => clearTimeout(timer);
  }, [logout, noAutoRedirect]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <AppLogo forBanner={true} />
            </div>
            
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Verifying Account Deletion
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Please wait while we process your request...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <AppLogo forBanner={true} />
          </div>
          
          {verificationStatus === 'success' ? (
            <div className="space-y-6">
              {/* Success Icon */}
              <div className="relative">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              
              {/* Success Content */}
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Account Deleted Successfully
                </h1>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  Your account has been successfully deleted and all your data has been anonymized. 
                  You will receive a confirmation email shortly.
                  {noAutoRedirect && ' You can now safely close this page or go to login if you wish to create a new account.'}
                </p>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {noAutoRedirect ? 'Account deletion completed successfully.' : 'Redirecting to login page...'}
              </p>
              
              {/* Manual Login Button for no_auto_redirect case */}
              {noAutoRedirect && (
                <button
                  onClick={() => navigate("/login")}
                  className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                >
                  Go to Login
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Error Icon */}
              <div className="relative">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              
              {/* Error Content */}
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Verification Failed
                </h1>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  The account deletion verification link is invalid or has expired. 
                  Please try requesting deletion again from your settings page.
                </p>
              </div>
              
              {/* Action Button */}
              <button
                onClick={() => navigate("/settings")}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
              >
                Go to Settings
              </button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Redirecting automatically in a few seconds...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 