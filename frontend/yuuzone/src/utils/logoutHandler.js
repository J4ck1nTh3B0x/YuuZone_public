import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthConsumer from '../components/AuthContext.jsx';
import { useConfirmContext } from '../components/useConfirm.jsx';

export const useLogoutHandler = () => {
  const navigate = useNavigate();
  const { logout } = AuthConsumer();
  const { t } = useTranslation();
  const confirm = useConfirmContext();

  const handleLogout = useCallback(async () => {
    try {
      // Show confirmation popup first
      const confirmed = await confirm(t('auth.logoutConfirm'));
      if (!confirmed) {
        return; // User cancelled the logout
      }
      
      // Proceed with logout if confirmed
      await logout();
      navigate("/login");
    } catch {
      // console.error('Logout failed:', error);
      // Still navigate to login even if logout fails
      navigate("/login");
    }
  }, [logout, navigate, t, confirm]);

  return handleLogout;
};
