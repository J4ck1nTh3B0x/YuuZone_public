import PropTypes from "prop-types";
import { useLocation, useNavigate, NavLink, Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Svg from "./Svg";
import Modal from "./Modal";
import { NewThread } from "./NewThread";
import ManagedSubthreadsModal from "./ManagedSubthreadsModal";
import avatar from "../assets/avatar.png";
import threads from "../assets/threads.png";
import useClickOutside from "../hooks/useClickOutside";
import AuthConsumer from "./AuthContext";
import { useLogoutHandler } from "../utils/logoutHandler";
import { ThreadSearch } from "./ThreadSearch";
import { toast } from "react-toastify";
import axios from "axios";


export { ThreadSearch };

// Language Switcher Component for non-authenticated users
function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [language, setLanguage] = useState(() => {
    // Map i18n language codes to display codes
    const langMap = { 'en': 'ENG', 'ja': 'JAP', 'vi': 'VIE' };
    return langMap[i18n.language] || 'ENG';
  });
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  // Ref for language dropdown to handle click outside
  const languageDropdownRef = useRef(null);
  useClickOutside(languageDropdownRef, () => setShowLanguageDropdown(false));

  const handleLanguageChange = async (newLanguage) => {
    try {
      await i18n.changeLanguage(newLanguage);
    setLanguage(newLanguage);
      localStorage.setItem("language", newLanguage);
      toast.success(t('translation.languageChanged'));
    } catch (error) {
      toast.error(t('translation.languageChangeFailed'));
    }
  };

  const languages = [
    { code: 'ENG', name: 'English' },
    { code: 'JAP', name: '日本語' },
    { code: 'VIE', name: 'Tiếng Việt' }
  ];

  return (
    <div className="relative" ref={languageDropdownRef}>
      <button
        onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
        className="duration-500 flex items-center cursor-pointer text-theme-text-primary dark:text-theme-dark-text"
        title={t('translation.translate')}
      >
        <Svg type="translate" className="w-6 h-6" />
      </button>

      {showLanguageDropdown && (
        <div className="absolute right-0 mt-2 w-40 bg-theme-bg-primary rounded-md shadow-lg border border-theme-border-light z-50">
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-theme-bg-hover ${
                  language === lang.code
                    ? "bg-theme-blue text-white hover:bg-theme-blue"
                    : "text-theme-text-primary"
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar({ navbarWidth }) {
  const { isAuthenticated, user, theme, setTheme } = AuthConsumer();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPlusModal, setShowPlusModal] = useState(false);
  const [showManagedModal, setShowManagedModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  const handleLogout = useLogoutHandler();
  const isDarkMode = theme === 'dark';
  
  // Debug logging
  useEffect(() => {
    // Authentication state monitoring (debug removed)
  }, [isAuthenticated, user]);
  
  const handleThemeToggle = () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  };

  // Initialize real-time coin updates
  // useRealtimeCoins(); // This line is removed as per the edit hint.



  // Fetch user roles
  useEffect(() => {
    if (isAuthenticated) {
      const fetchUserRoles = async () => {
        try {
          const response = await axios.get('/api/user/roles');
          if (response.data.success) {
            setUserRoles(response.data.roles);
          }
            } catch (error) {
      // Error fetching user roles
    }
      };
      
      fetchUserRoles();
    }
  }, [isAuthenticated]);



  // Check if user is SuperManager
  const isSuperManager = userRoles.some(role => role.slug === 'SM');

  // Navigation callback for search results
  const handleSearchNavigation = (path) => {
    navigate(path);
  };

  // Ref for user dropdown to handle click outside
  const userDropdownRef = useRef(null);
  useClickOutside(userDropdownRef, () => setShowUserDropdown(false));

  // Show the 'Create New Post' button whenever user is authenticated and navbar is available
  const showCreatePostButton = isAuthenticated;


  return (
    <nav 
      className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center h-16 md:p-5 bg-white dark:bg-theme-dark-bg border-b border-theme-border-light dark:border-theme-dark-border"
      style={{ width: navbarWidth ? navbarWidth : '100%' }}
    >
      {/* Shade overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: isDarkMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.012)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Navbar content (zIndex: 2 to be above the shade) */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%' }} className="flex justify-between items-center w-full">
      <AppLogo />
      <div className="flex items-center md:space-x-10">
        <div
          className={`list-none hidden md:flex space-x-10 text-theme-text-secondary fill-current
                    ${!isAuthenticated && "flex-1 space-x-20"}`}>
          <NavLink
            to={`${isAuthenticated ? "/home" : "/login"}`}
            className={({ isActive }) =>
              `duration-500 group flex space-x-1 group cursor-pointer ${isActive && "text-theme-blue"}`
            }>
            <Svg type="home" className="w-6 h-6" />
            <h2 className="font-semibold group-hover:text-theme-blue">{t('navigation.home')}</h2>
          </NavLink>
          <NavLink
            to="/popular"
            className={({ isActive }) =>
              `group flex space-x-1 group cursor-pointer ${isActive && "text-theme-blue"}`
            }>
            <Svg type="popular" className="w-6 h-6" />
            <h2 className="font-semibold group-hover:text-theme-blue">{t('navigation.popular')}</h2>
          </NavLink>
          <NavLink
            to="/all"
            className={({ isActive }) =>
              `group flex space-x-1 group cursor-pointer ${isActive && "text-theme-blue"}`
            }>
            <Svg type="all" className="w-6 h-6" />
            <h2 className="font-semibold group-hover:text-theme-blue">{t('navigation.all')}</h2>
          </NavLink>
          {showCreatePostButton && (
            <button
              onClick={() => setShowPlusModal(true)}
              className="duration-500 group flex space-x-1 group cursor-pointer"
              title="Create New Subthread"
            >
              <Svg type="add" className="w-6 h-6" />
              <h2 className="font-semibold group-hover:text-theme-blue">{t('common.new')}</h2>
            </button>
          )}
        </div>
          <ThreadSearch callBackFunc={handleSearchNavigation} />
      </div>
      <div className="flex items-center md:space-x-6 dark:text-theme-dark-text">
        {isAuthenticated && (
          <>
            <button
              onClick={handleThemeToggle}
                className="duration-500 flex items-center cursor-pointer text-theme-text-primary dark:text-theme-dark-text"
              title={t('navigation.toggleTheme')}
              aria-label={t('navigation.toggleTheme')}
              style={{ background: 'none', boxShadow: 'none' }}
            >
              <Svg type={isDarkMode ? "sun" : "moon"} className="w-6 h-6" />
            </button>
            <button
              onClick={() => setShowManagedModal(true)}
              title={t('subthreads.managedSubthreads')}
              className="duration-500 flex items-center cursor-pointer"
            >
              <Svg type="check_managed_subthread" external={true} alt="Managed Subthread" className="w-6 h-6" />
            </button>
            <NavLink
              to="/saved"
              className={({ isActive }) => `duration-500 flex items-center cursor-pointer ${isActive ? "text-theme-blue" : ""}`}
              title={t('navigation.saved')}
            >
              <Svg type="save" className="w-6 h-6" />
            </NavLink>
            <NavLink
              to="/inbox"
              className={({ isActive }) => `duration-500 flex items-center cursor-pointer ${isActive ? "text-theme-blue" : ""}`}
              title={t('navigation.inbox')}
            >
              <Svg type="message" className="w-6 h-6" />
            </NavLink>

            <div className="relative hidden md:block" ref={userDropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 bg-theme-light-gray2 dark:bg-theme-dark-card rounded-lg pr-3 py-0.5 hover:bg-theme-bg-hover dark:hover:bg-theme-dark-bg transition-colors dark:text-theme-dark-text">
                <img loading="lazy" width="auto" height="100%"
                  src={user.avatar || avatar}
                  className="object-cover w-10 h-10 rounded-md duration-500 cursor-pointer hover:scale-125"
                />
                <div className="text-sm font-semibold text-left">
                  <p className="text-theme-text-primary dark:text-theme-dark-text-secondary">{user.username}</p>
                  <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary truncate">{t('user.karma').toLowerCase()}: {user.karma.user_karma}</p>
                </div>
                <Svg type="down-arrow" className={`w-4 h-4 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-theme-bg-primary dark:bg-theme-dark-card rounded-md shadow-lg border border-theme-border-light dark:border-theme-dark-border z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        navigate(`/u/${user.username}`);
                        setShowUserDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary dark:text-theme-dark-text-secondary hover:bg-theme-bg-hover dark:hover:bg-transparent"
                    >
                      {t('user.myProfile')}
                    </button>
                    {/* Coin Balance Section */}
                    <div className="px-4 py-2 text-sm text-theme-text-primary dark:text-theme-dark-text-secondary border-b border-theme-border-light dark:border-theme-dark-border">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Svg type="coin" className="w-4 h-4" />
                          {t('coins.yourBalance')}
                        </span>
                        <span className="font-semibold text-theme-blue dark:text-theme-blue">
                          {(user?.wallet?.coin_balance || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        navigate('/coin-shop');
                        setShowUserDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary dark:text-theme-dark-text-secondary hover:bg-theme-bg-hover dark:hover:bg-transparent"
                    >
                      {t('coins.coinShop')}
                    </button>

                    <button
                      onClick={() => {
                        navigate('/settings');
                        setShowUserDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary dark:text-theme-dark-text-secondary hover:bg-theme-bg-hover dark:hover:bg-transparent"
                    >
                      {t('navigation.settings')}
                    </button>
                    {isSuperManager && (
                      <button
                        onClick={() => {
                          navigate('/super-manager');
                          setShowUserDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-theme-bg-hover dark:hover:bg-transparent font-medium"
                      >
                        {t('coins.superManager.dashboard')}
                      </button>
                    )}
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-theme-text-primary dark:text-theme-dark-text-secondary hover:bg-theme-bg-hover dark:hover:bg-transparent font-bold"
                    >
                      {t('navigation.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        <select
          name="page"
          id="page"
          className="px-1 py-3 mr-1 text-center rounded-md md:hidden bg-theme-light-gray2"
          onChange={(e) => {
            if (e.target.value !== "logout") {
              navigate(e.target.value);
            } else {
              handleLogout();
              e.target.value = location.pathname;
            }
          }}
          value={location.pathname}>
          <optgroup label="Feeds">
            {isAuthenticated && <option value="/home">{t('navigation.home')}</option>}
            <option value="/popular">{t('navigation.popular')}</option>
            <option value="/all">{t('navigation.all')}</option>
          </optgroup>
          <optgroup label="Other">
            {isAuthenticated ? (
              <>
                <option value="/inbox">{t('navigation.inbox')}</option>
                <option value="/saved">{t('navigation.saved')}</option>
                <option value={`/u/${user.username}`}>{t('navigation.profile')}</option>
                <option value="logout">{t('navigation.logout')}</option>
              </>
            ) : (
              <>
                <option value="/register">{t('navigation.register')}</option>
                <option value="/login">{t('navigation.login')}</option>
              </>
            )}
          </optgroup>
        </select>
        {!isAuthenticated && (
          <div className="md:hidden ml-2">
            <LanguageSwitcher />
          </div>
        )}
        </div>
      </div>
      {!isAuthenticated && (
        <div className="hidden md:flex items-center space-x-4">
          <LanguageSwitcher />
          <button
            onClick={handleThemeToggle}
            className="duration-500 flex items-center cursor-pointer text-theme-text-primary dark:text-theme-dark-text"
            title={t('navigation.toggleTheme')}
            aria-label={t('navigation.toggleTheme')}
            style={{ background: 'none', boxShadow: 'none' }}
          >
            <Svg type={isDarkMode ? "sun" : "moon"} className="w-6 h-6" />
          </button>
          <Link
            to="/login"
            className="ml-2 font-semibold text-theme-text-primary dark:text-theme-dark-text hover:text-theme-blue dark:hover:text-theme-blue"
          >
            {t('auth.login')}
          </Link>
        </div>
      )}
      {showPlusModal && (
        <Modal setShowModal={setShowPlusModal} showModal={showPlusModal}>
          <NewThread setShowModal={setShowPlusModal} />
        </Modal>
      )}
      {showManagedModal && (
        <ManagedSubthreadsModal showModal={showManagedModal} setShowModal={setShowManagedModal} />
      )}
    </nav>
  );
}

Navbar.propTypes = {
  navbarWidth: PropTypes.string,
};

export function AppLogo({ forBanner = false, children }) {
  const { t } = useTranslation();

  if (forBanner) {
    return (
      <div className="hidden relative flex-col justify-center items-center space-y-5 rounded-md cursor-pointer md:flex group">
        <img src={threads} alt="YuuZone-logo" className="object-cover" />
        <h1 className="font-mono text-6xl font-bold tracking-tight text-theme-blue dark:text-white">YuuZone</h1>
        <p className="text-lg font-semibold text-theme-text-primary dark:text-white">{t('auth.tagline')}</p>
        {children}
      </div>
    );
  }
  return (
    <Link to="/" className="flex relative items-center space-x-3 cursor-pointer group">
      <img src={threads} className="object-contain w-auto h-10" alt="YuuZone-logo" />
      <span className=""></span>
      <h1 className="hidden font-mono text-3xl font-bold tracking-tight md:block text-black dark:text-white">YuuZone</h1>
      {children}
    </Link>
  );
}

AppLogo.propTypes = {
  forBanner: PropTypes.bool,
  children: PropTypes.node,
};
