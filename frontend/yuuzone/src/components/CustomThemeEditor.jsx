import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import AuthConsumer from './AuthContext';

const CustomThemeEditor = ({ disableModal = false, onThemeCreated = null, themeSlotsData = null }) => {
  const { t } = useTranslation();
  const authContext = AuthConsumer();
  const { switchToCustomTheme, switchToSystemTheme } = authContext;
  

  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [themeSlots, setThemeSlots] = useState({ available: 0, used: 0, total: 0 });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFallbackForm, setShowFallbackForm] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);
  const [formData, setFormData] = useState({
    theme_name: '',
    theme_data: {}
  });
  
  // Preview state management
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewThemeData, setPreviewThemeData] = useState(null);
  const [originalTheme, setOriginalTheme] = useState(null);

  // Complete theme colors - ONLY LIGHT MODE COLORS organized by sections
  const defaultColors = {
    // Text Colors
    "theme-text-primary": "var(--theme-text-primary, #374151)",
    "theme-text-secondary": "var(--theme-text-secondary, #6b7280)",
    "theme-text-muted": "var(--theme-text-muted, #9ca3af)",

    // Page & Background Colors
    "theme-bg-primary": "var(--theme-bg-primary, #ffffff)",
    "theme-bg-secondary": "var(--theme-bg-secondary, #f9fafb)",
    "theme-bg-tertiary": "var(--theme-bg-tertiary, #f3f4f6)",
    "theme-less-white": "var(--theme-less-white, #f4f4f4)",

    // Card & Container Colors
    "theme-light-gray2": "var(--theme-light-gray2, #dfdfdf)",
    "theme-light-gray3": "var(--theme-light-gray3, #e7e5e5)",
    "theme-pale-gray": "var(--theme-pale-gray, #eaeaea)",

    // Border Colors
    "theme-border-light": "var(--theme-border-light, #e5e7eb)",
    "theme-border-medium": "var(--theme-border-medium, #d1d5db)",
    "theme-light-gray": "var(--theme-light-gray, #d9d9d9)",

    // Button & Interactive Colors
    "theme-blue": "var(--theme-blue, #37affe)",
    "theme-blue-coral": "var(--theme-blue-coral, #3172ff)",
    "theme-button-primary": "var(--theme-button-primary, #2563eb)",
    "theme-button-primary-hover": "var(--theme-button-primary-hover, #1d4ed8)",
    "theme-button-active": "var(--theme-button-active, #1e40af)",
    "theme-button-disabled": "var(--theme-button-disabled, #9ca3af)",

    // Link Colors
    "theme-link": "var(--theme-link, #2563eb)",
    "theme-link-hover": "var(--theme-link-hover, #1d4ed8)",

    // Status Colors
    "theme-success": "var(--theme-success, #059669)",
    "theme-success-light": "var(--theme-success-light, #d1fae5)",
    "theme-error": "var(--theme-error, #dc2626)",
    "theme-error-light": "var(--theme-error-light, #fef2f2)",
    "theme-warning": "var(--theme-warning, #d97706)",
    "theme-warning-light": "var(--theme-warning-light, #fef3c7)",
    "theme-info": "var(--theme-info, #2563eb)",

    // Navigation & Brand Colors
    "theme-gray-blue": "var(--theme-gray-blue, #22638f)",
    "theme-cultured": "var(--theme-cultured, #004b96)",
    "theme-light-blue": "var(--theme-light-blue, #69bcff)",
    "theme-pale-blue": "var(--theme-pale-blue, #93ceff)",

    // Note: Tier badges (Support/VIP) and special role colors (Admin/Moderator) 
    // are NOT customizable to maintain brand identity and role recognition

    // Chat Colors
    "theme-received": "var(--theme-received, #43b751)",
    "theme-sender": "var(--theme-sender, #47acde)",
    "theme-online": "var(--theme-online, #10b981)",

    // Comment Thread Colors
    "theme-comment-border-1": "var(--theme-comment-border-1, #fbbf24)",
    "theme-comment-border-2": "var(--theme-comment-border-2, #60a5fa)",
    "theme-comment-border-3": "var(--theme-comment-border-3, #a78bfa)",
    "theme-comment-border-4": "var(--theme-comment-border-4, #34d399)",
    "theme-comment-border-5": "var(--theme-comment-border-5, #38bdf8)",
    "theme-comment-border-6": "var(--theme-comment-border-6, #f472b6)",
  };

  // Color sections for organization
  const colorSections = {
    "Text Colors": [
      "theme-text-primary",
      "theme-text-secondary", 
      "theme-text-muted"
    ],
    "Page & Background": [
      "theme-bg-primary",
      "theme-bg-secondary",
      "theme-bg-tertiary",
      "theme-less-white"
    ],
    "Cards & Containers": [
      "theme-light-gray2",
      "theme-light-gray3",
      "theme-pale-gray"
    ],
    "Borders & Dividers": [
      "theme-border-light",
      "theme-border-medium",
      "theme-light-gray"
    ],
    "Buttons & Interactive": [
      "theme-blue",
      "theme-blue-coral",
      "theme-button-primary",
      "theme-button-primary-hover",
      "theme-button-active",
      "theme-button-disabled"
    ],
    "Links": [
      "theme-link",
      "theme-link-hover"
    ],
    "Status & Messages": [
      "theme-success",
      "theme-success-light",
      "theme-error",
      "theme-error-light",
      "theme-warning",
      "theme-warning-light",
      "theme-info"
    ],
    "Navigation & Brand": [
      "theme-gray-blue",
      "theme-cultured",
      "theme-light-blue",
      "theme-pale-blue"
    ],

    "Chat & Messaging": [
      "theme-received",
      "theme-sender",
      "theme-online"
    ],
    "Comment Threads": [
      "theme-comment-border-1",
      "theme-comment-border-2",
      "theme-comment-border-3",
      "theme-comment-border-4",
      "theme-comment-border-5",
      "theme-comment-border-6"
    ]
  };

  useEffect(() => {
    // Use passed theme slots data if available, otherwise fetch it
    if (themeSlotsData) {
      setThemeSlots({
        available: themeSlotsData.available_slots,
        used: themeSlotsData.used_slots,
        total: themeSlotsData.total_slots
      });
      setLoading(false);
    } else {
      fetchThemeSlots();
    }
    fetchThemes();
  }, [themeSlotsData]);

  const fetchThemeSlots = async () => {
    try {
      const response = await axios.get('/api/subscriptions/themes/slots');
      setThemeSlots(response.data);
    } catch (error) {
      console.error('Error fetching theme slots:', error);
    }
  };

  const fetchThemes = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/subscriptions/themes');
      setThemes(response.data.themes);
    } catch (error) {
      console.error('Error fetching themes:', error);
      toast.error(t('themes.errorLoadingThemes'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTheme = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/subscriptions/themes', {
        theme_name: formData.theme_name,
        theme_data: formData.theme_data
      });
      
      toast.success(t('themes.themeCreated'));
      
      // Stop preview if active
      if (isPreviewMode) {
        stopPreview();
      }
      
      setShowCreateForm(false);
      setShowFallbackForm(false);
      setFormData({ theme_name: '', theme_data: {} });
      fetchThemes();
      fetchThemeSlots();
      
      // Call the callback to close the outer modal if provided
      if (onThemeCreated) {
        onThemeCreated();
      }
    } catch (error) {
      console.error('Error creating theme:', error);
      toast.error(t('themes.errorCreatingTheme'));
    }
  };

  const handleUpdateTheme = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put(`/api/subscriptions/themes/${editingTheme.id}`, {
        theme_name: formData.theme_name,
        theme_data: formData.theme_data
      });
      
      toast.success(t('themes.themeUpdated'));
      
      // Stop preview if active
      if (isPreviewMode) {
        stopPreview();
      }
      
      setShowCreateForm(false);
      setEditingTheme(null);
      setFormData({ theme_name: '', theme_data: {} });
      fetchThemes();
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error(t('themes.errorUpdatingTheme'));
    }
  };

  const handleDeleteTheme = async (themeId) => {
    if (window.confirm(t('themes.confirmDeleteTheme'))) {
      try {
        await axios.delete(`/api/subscriptions/themes/${themeId}`);
        toast.success(t('themes.themeDeleted'));
        fetchThemes();
        fetchThemeSlots();
      } catch (error) {
        console.error('Error deleting theme:', error);
        toast.error(t('themes.errorDeletingTheme'));
      }
    }
  };

  const handleActivateTheme = async (themeId) => {
    try {
      const response = await axios.post(`/api/subscriptions/themes/${themeId}/activate`);
      const themeData = response.data.theme;
      if (switchToCustomTheme && typeof switchToCustomTheme === 'function') {
        switchToCustomTheme(themeData);
      } else {
        console.error('switchToCustomTheme function not available');
      }
      toast.success(t('themes.themeActivated'));
      fetchThemes();
    } catch (error) {
      console.error('Error activating theme:', error);
      toast.error(t('themes.errorActivatingTheme'));
    }
  };

  const handleDeactivateThemes = async () => {
    try {
      await axios.post('/api/subscriptions/themes/deactivate');
      if (switchToSystemTheme && typeof switchToSystemTheme === 'function') {
        switchToSystemTheme();
      } else {
        console.error('switchToSystemTheme function not available');
      }
      toast.success(t('themes.themesDeactivated'));
      fetchThemes();
    } catch (error) {
      console.error('Error deactivating themes:', error);
      toast.error(t('themes.errorDeactivatingThemes'));
    }
  };

  const openEditForm = (theme) => {
    setEditingTheme(theme);
    setFormData({
      theme_name: theme.theme_name,
      theme_data: { ...theme.theme_data }
    });
  };

  const closeForm = () => {
    // Stop preview if active
    if (isPreviewMode) {
      stopPreview();
    }
    
    setShowCreateForm(false);
    setShowFallbackForm(false);
    setEditingTheme(null);
    setFormData({ theme_name: '', theme_data: {} });
  };

  const updateColor = (colorKey, value) => {
    setFormData(prev => ({
      ...prev,
      theme_data: {
        ...prev.theme_data,
        [colorKey]: value
      }
    }));
    
    // If in preview mode, update the preview immediately
    if (isPreviewMode) {
      setPreviewThemeData(prev => ({
        ...prev,
        [colorKey]: value
      }));
    }
  };

  // Start preview mode
  const startPreview = () => {
    // Store current theme state
    setOriginalTheme(authContext.customTheme);
    
    // Create preview theme data
    const previewData = {
      ...formData.theme_data
    };
    setPreviewThemeData(previewData);
    
    // Apply preview theme
    if (switchToCustomTheme && typeof switchToCustomTheme === 'function') {
      switchToCustomTheme({
        id: 'preview',
        theme_name: formData.theme_name || 'Preview Theme',
        theme_data: previewData
      });
    }
    
    setIsPreviewMode(true);
    toast.success(t('themes.previewStarted'));
  };

  // Stop preview mode
  const stopPreview = () => {
    // Restore original theme
    if (originalTheme) {
      if (switchToCustomTheme && typeof switchToCustomTheme === 'function') {
        switchToCustomTheme(originalTheme);
      }
    } else {
      if (switchToSystemTheme && typeof switchToSystemTheme === 'function') {
        switchToSystemTheme();
      }
    }
    
    setIsPreviewMode(false);
    setPreviewThemeData(null);
    setOriginalTheme(null);
    toast.success(t('themes.previewStopped'));
  };

  // Clean up preview on unmount
  useEffect(() => {
    return () => {
      if (isPreviewMode) {
        stopPreview();
      }
    };
  }, [isPreviewMode]);

  const getColorDisplayName = (key) => {
    const colorNames = {
      // Text Colors
      'theme-text-primary': 'Main Text & Headings',
      'theme-text-secondary': 'Secondary Text & Captions',
      'theme-text-muted': 'Muted Text & Placeholders',

      // Page & Background Colors
      'theme-bg-primary': 'Primary Background',
      'theme-bg-secondary': 'Secondary Background',
      'theme-bg-tertiary': 'Tertiary Background',
      'theme-less-white': 'Page Background',

      // Card & Container Colors
      'theme-light-gray2': 'Background Cards',
      'theme-light-gray3': 'Secondary Borders',
      'theme-pale-gray': 'Button Hover Backgrounds',

      // Border Colors
      'theme-border-light': 'Light Borders',
      'theme-border-medium': 'Medium Borders',
      'theme-light-gray': 'Light Borders & Dividers',

      // Button & Interactive Colors
      'theme-blue': 'Main Buttons & Links',
      'theme-blue-coral': 'Button Hover States',
      'theme-button-primary': 'Primary Buttons',
      'theme-button-primary-hover': 'Primary Button Hover',
      'theme-button-active': 'Active Button States',
      'theme-button-disabled': 'Disabled Buttons',

      // Link Colors
      'theme-link': 'Links',
      'theme-link-hover': 'Link Hover States',

      // Status Colors
      'theme-success': 'Success Messages & Confirmations',
      'theme-success-light': 'Success Backgrounds',
      'theme-error': 'Error Messages & Delete Buttons',
      'theme-error-light': 'Error Backgrounds',
      'theme-warning': 'Warning Messages & Alerts',
      'theme-warning-light': 'Warning Backgrounds',
      'theme-info': 'Info Messages',

      // Navigation & Brand Colors
      'theme-gray-blue': 'Navigation & Sidebar',
      'theme-cultured': 'Deep Blue Accents',
      'theme-light-blue': 'Light Blue Elements',
      'theme-pale-blue': 'Pale Blue Backgrounds',



      // Chat Colors
      'theme-received': 'Received Message Background',
      'theme-sender': 'Sent Message Background',
      'theme-online': 'Online Status Indicator',

      // Comment Thread Colors
      'theme-comment-border-1': 'Comment Thread Border 1',
      'theme-comment-border-2': 'Comment Thread Border 2',
      'theme-comment-border-3': 'Comment Thread Border 3',
      'theme-comment-border-4': 'Comment Thread Border 4',
      'theme-comment-border-5': 'Comment Thread Border 5',
      'theme-comment-border-6': 'Comment Thread Border 6',
    };
    
    return colorNames[key] || key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-blue"></div>
      </div>
    );
  }

  // Check if user has any theme slots (tier user)
  // Only determine tier status after data has been loaded
  const isTierUser = !loading && themeSlots.total > 0;
  
  // Check if we should show the fallback form
  const shouldShowFallbackForm = showFallbackForm || (themeSlots.available > 0 && (!themes || !Array.isArray(themes) || themes.length === 0));
  
  if (shouldShowFallbackForm) {
    return (
      <div className="space-y-6">
        {/* Create New Theme Form */}
        <div className="bg-white dark:bg-theme-dark-bg p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center space-x-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              🎨 {t('themes.createNewTheme')}
            </h3>
            {isPreviewMode && (
              <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-medium">
                {t('themes.previewMode')}
              </span>
            )}
                      </div>
            
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('themes.previewDescription')}
              </p>
            </div>
            
            <form onSubmit={handleCreateTheme}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                {t('themes.themeName')}
              </label>
              <input
                type="text"
                value={formData.theme_name}
                onChange={(e) => setFormData(prev => ({ ...prev, theme_name: e.target.value }))}
                className="w-full p-2 border border-gray-300 dark:border-theme-dark-border rounded-md bg-white dark:bg-theme-dark-bg text-gray-900 dark:text-gray-100"
                placeholder="Enter theme name"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                {t('themes.colorPalette')} - {t('themes.allColorsAvailable')}
              </label>
              <div className="max-h-96 overflow-y-auto space-y-6">
                {Object.entries(colorSections).map(([sectionName, colorKeys]) => (
                  <div key={sectionName} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 text-sm uppercase tracking-wide">
                      {sectionName}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {colorKeys.map((key) => (
                        <div key={key} className="flex items-center space-x-2">
                          <div className="relative">
                            <input
                              type="color"
                              value={formData.theme_data[key] || defaultColors[key]}
                              onChange={(e) => updateColor(key, e.target.value)}
                              className="w-8 h-8 border border-gray-300 rounded"
                            />
                            {isPreviewMode && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{getColorDisplayName(key)}</span>
                            <div 
                              className="w-full h-2 rounded mt-1 border border-gray-200"
                              style={{ backgroundColor: formData.theme_data[key] || defaultColors[key] }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex space-x-3">
              {!isPreviewMode ? (
                <button
                  type="button"
                  onClick={startPreview}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                >
                  {t('themes.previewTheme')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopPreview}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md transition-colors"
                >
                  {t('themes.stopPreview')}
                </button>
              )}
              <button
                type="submit"
                className="bg-theme-blue hover:bg-theme-blue-coral text-white px-4 py-2 rounded-md transition-colors"
              >
                {t('themes.createTheme')}
              </button>
              <button
                type="button"
                onClick={() => setShowFallbackForm(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // If we're showing the create/edit form and we're inside a modal, show it inline
  if ((showCreateForm || editingTheme) && disableModal) {
    return (
      <div className="space-y-6">
        
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold">
              {editingTheme ? t('themes.editTheme') : t('themes.createNewTheme')}
            </h3>
            {isPreviewMode && (
              <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-medium">
                {t('themes.previewMode')}
              </span>
            )}
          </div>
          <button
            onClick={closeForm}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={editingTheme ? handleUpdateTheme : handleCreateTheme}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t('themes.themeName')}
            </label>
            <input
              type="text"
              value={formData.theme_name}
              onChange={(e) => setFormData(prev => ({ ...prev, theme_name: e.target.value }))}
              className="w-full p-2 border border-gray-300 dark:border-theme-dark-border rounded-md bg-white dark:bg-theme-dark-bg text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t('themes.colorPalette')} - {t('themes.allColorsAvailable')}
            </label>
            <div className="max-h-96 overflow-y-auto space-y-6">
              {Object.entries(colorSections).map(([sectionName, colorKeys]) => (
                <div key={sectionName} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 text-sm uppercase tracking-wide">
                    {sectionName}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {colorKeys.map((key) => (
                      <div key={key} className="flex items-center space-x-2">
                        <div className="relative">
                          <input
                            type="color"
                            value={formData.theme_data[key] || defaultColors[key]}
                            onChange={(e) => updateColor(key, e.target.value)}
                            className="w-8 h-8 border border-gray-300 rounded"
                          />
                          {isPreviewMode && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">{getColorDisplayName(key)}</span>
                          <div 
                            className="w-full h-2 rounded mt-1 border border-gray-200"
                            style={{ backgroundColor: formData.theme_data[key] || defaultColors[key] }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex space-x-3">
            {!isPreviewMode ? (
              <button
                type="button"
                onClick={startPreview}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                {t('themes.previewTheme')}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopPreview}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                {t('themes.stopPreview')}
              </button>
            )}
            <button
              type="submit"
              className="bg-theme-blue hover:bg-theme-blue-coral text-white px-4 py-2 rounded-md transition-colors"
            >
              {editingTheme ? t('themes.updateTheme') : t('themes.createTheme')}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // For non-tier users (free accounts), show grayed out section
  if (!loading && !isTierUser) {
    return (
      <div className="space-y-6 opacity-50 pointer-events-none">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
            {t('themes.customThemes')}
          </h4>
        </div>
        
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-gray-400 text-4xl mb-4">🎨</div>
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
            {t('themes.customThemesLocked')}
          </h3>
          <p className="text-gray-500 dark:text-gray-500 mb-4">
            {t('themes.upgradeRequiredForThemes')}
          </p>
          <button
            onClick={() => window.location.href = '/subscriptions'}
            className="bg-theme-blue hover:bg-theme-blue-coral text-white px-6 py-2 rounded-md transition-colors pointer-events-auto"
          >
            {t('themes.upgradeToCreateThemes')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Theme Slots Info */}
      <div className="bg-theme-light-gray2 dark:bg-theme-dark-bg rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">{t('themes.themeSlots')}</h3>
        <div className="flex items-center space-x-4 text-sm">
          {themeSlots.used > 0 ? (
            <span>{t('themes.slotsLeft', { count: themeSlots.available })}</span>
          ) : (
            <span>{t('themes.availableSlots', { count: themeSlots.available })}</span>
          )}
          <span>{t('themes.usedSlots', { count: themeSlots.used })}</span>
          <span>{t('themes.totalSlots', { count: themeSlots.total })}</span>
        </div>
        {themes.some(theme => theme.is_active) && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {t('themes.customThemeModeDescription')}
          </p>
        )}
      </div>

      {/* All Theme Slots Used Message */}
      {themeSlots.available === 0 && themeSlots.total > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 text-center">
          <div className="text-orange-600 dark:text-orange-400 text-4xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-2">
            {t('themes.allSlotsUsedTitle')}
          </h3>
          <p className="text-orange-700 dark:text-orange-300 mb-4">
            {t('themes.allSlotsUsedMessage')}
          </p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={() => window.location.href = '/subscriptions'}
              className="bg-theme-blue hover:bg-theme-blue-coral text-white px-4 py-2 rounded-md transition-colors"
            >
              {t('themes.upgradeForMoreSlots')}
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              {t('themes.manageExistingThemes')}
            </button>
          </div>
        </div>
      )}

      {/* Create New Theme Button */}
      {themeSlots.available > 0 && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{t('themes.yourThemes')}</h3>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setShowFallbackForm(true);
            }}
            className="bg-theme-blue hover:bg-theme-blue-coral text-white px-4 py-2 rounded-md transition-colors"
          >
            {t('themes.createNewTheme')}
          </button>
        </div>
      )}

      {/* Theme List */}
      {themes && Array.isArray(themes) && themes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(themes || []).map((theme) => (
            <div key={theme.id} className="bg-white dark:bg-theme-dark-card rounded-lg p-4 border border-gray-200 dark:border-theme-dark-border">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">{theme.theme_name}</h4>
                {theme.is_active && (
                  <span className="bg-theme-success text-white text-xs px-2 py-1 rounded-full">
                    {t('themes.active')}
                  </span>
                )}
              </div>
              
              {/* Color Preview */}
              <div className="grid grid-cols-4 gap-1 mb-3">
                {Object.entries(theme.theme_data).slice(0, 8).map(([key, value]) => (
                  <div
                    key={key}
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: value }}
                    title={getColorDisplayName(key)}
                  />
                ))}
              </div>
              
              <div className="flex space-x-2">
                {!theme.is_active && (
                  <button
                    onClick={() => handleActivateTheme(theme.id)}
                    className="bg-theme-success hover:bg-theme-success-light text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    {t('themes.activate')}
                  </button>
                )}
                <button
                  onClick={() => openEditForm(theme)}
                  className="bg-theme-blue hover:bg-theme-blue-coral text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  {t('themes.edit')}
                </button>
                <button
                  onClick={() => handleDeleteTheme(theme.id)}
                  className="bg-theme-error hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  {t('themes.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Themes Message */}
      {(!themes || !Array.isArray(themes) || themes.length === 0) && themeSlots.available > 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-3">🎨</div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('themes.noThemesYet')}
          </p>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setShowFallbackForm(true);
            }}
            className="bg-theme-blue hover:bg-theme-blue-coral text-white px-6 py-2 rounded-md transition-colors"
          >
            {t('themes.createFirstTheme')}
          </button>
        </div>
      )}

      {/* Create/Edit Theme Form - Only show modal if not disabled */}
      {(showCreateForm || editingTheme) && !disableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-theme-dark-card rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold">
                  {editingTheme ? t('themes.editTheme') : t('themes.createNewTheme')}
                </h3>
                {isPreviewMode && (
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-medium">
                    {t('themes.previewMode')}
                  </span>
                )}
              </div>
            </div>
            
            <form onSubmit={editingTheme ? handleUpdateTheme : handleCreateTheme}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('themes.themeName')}
                </label>
                <input
                  type="text"
                  value={formData.theme_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, theme_name: e.target.value }))}
                  className="w-full p-2 border border-gray-300 dark:border-theme-dark-border rounded-md bg-white dark:bg-theme-dark-bg text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('themes.colorPalette')} - {t('themes.allColorsAvailable')}
                </label>
                <div className="max-h-96 overflow-y-auto space-y-6">
                  {Object.entries(colorSections).map(([sectionName, colorKeys]) => (
                    <div key={sectionName} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 text-sm uppercase tracking-wide">
                        {sectionName}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {colorKeys.map((key) => (
                          <div key={key} className="flex items-center space-x-2">
                            <div className="relative">
                              <input
                                type="color"
                                value={formData.theme_data[key] || defaultColors[key]}
                                onChange={(e) => updateColor(key, e.target.value)}
                                className="w-8 h-8 border border-gray-300 rounded"
                              />
                              {isPreviewMode && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                              )}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{getColorDisplayName(key)}</span>
                              <div 
                                className="w-full h-2 rounded mt-1 border border-gray-200"
                                style={{ backgroundColor: formData.theme_data[key] || defaultColors[key] }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-3">
                {!isPreviewMode ? (
                  <button
                    type="button"
                    onClick={startPreview}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    {t('themes.previewTheme')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopPreview}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    {t('themes.stopPreview')}
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-theme-blue hover:bg-theme-blue-coral text-white px-4 py-2 rounded-md transition-colors"
                >
                  {editingTheme ? t('themes.updateTheme') : t('themes.createTheme')}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate All Themes Button */}
      {themes.some(theme => theme.is_active) && (
        <div className="text-center">
          <button
            onClick={handleDeactivateThemes}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            {t('themes.deactivateAllThemes')}
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomThemeEditor; 