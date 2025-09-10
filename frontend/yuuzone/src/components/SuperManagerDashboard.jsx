import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import AuthConsumer from './AuthContext';
import Modal from './Modal';
import Svg from './Svg';

export default function SuperManagerDashboard() {
  const { t } = useTranslation();
  const { user } = AuthConsumer();
  const [activeTab, setActiveTab] = useState('avatars');
  const [avatarCategories, setAvatarCategories] = useState([]);
  const [coinPackages, setCoinPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryAvatars, setCategoryAvatars] = useState([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isValidatingImage, setIsValidatingImage] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, packagesRes] = await Promise.all([
        axios.get('/api/coins/admin/avatar-categories'),
        axios.get('/api/coins/admin/coin-packages')
      ]);

      if (categoriesRes.data.success) {
        setAvatarCategories(categoriesRes.data.categories);
      }

      if (packagesRes.data.success) {
        setCoinPackages(packagesRes.data.packages);
      }
    } catch (error) {
      toast.error(t('coins.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const response = await axios.post('/api/coins/admin/avatar-categories', formData);
      
      if (response.data.success) {
        toast.success(t('coins.categoryCreated'));
        setShowCreateModal(false);
        setFormData({});
        setValidationErrors([]);
        setShowValidationModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Category creation error:', error);
      toast.error(error.response?.data?.error || t('coins.createError'));
    }
  };

  const handleCreatePackage = async () => {
    try {
      const response = await axios.post('/api/coins/admin/coin-packages', formData);
      
      if (response.data.success) {
        toast.success(t('coins.packageCreated'));
        setShowCreateModal(false);
        setFormData({});
        setValidationErrors([]);
        setShowValidationModal(false);
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.createError'));
    }
  };

  const validateImageUrl = async (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      // Set a timeout to prevent hanging
      setTimeout(() => resolve(false), 5000);
    });
  };

  const validateForm = async () => {
    const errors = [];
    const data = editingItem ? editFormData : formData;
    
    if (modalType === 'category') {
      if (!data.name || data.name.trim() === '') {
        errors.push(t('coins.superManager.validation.categoryNameRequired'));
      }
      // Description is now optional, so no validation needed
    } else if (modalType === 'package') {
      if (!data.name || data.name.trim() === '') {
        errors.push(t('coins.superManager.validation.packageNameRequired'));
      }
      if (!data.coin_amount || data.coin_amount <= 0) {
        errors.push(t('coins.superManager.validation.coinAmountRequired'));
      }
      if (!data.price_vnd || data.price_vnd <= 0) {
        errors.push(t('coins.superManager.validation.priceVNDRequired'));
      }
    } else if (modalType === 'avatar') {
      if (!data.name || data.name.trim() === '') {
        errors.push(t('coins.superManager.validation.avatarNameRequired'));
      }
      if (!data.price_coins || data.price_coins <= 0) {
        errors.push(t('coins.superManager.validation.priceCoinsRequired'));
      }
      
      if (!editingItem) { // Only validate image for new avatars
        if (data.uploadMethod === 'file') {
          if (!data.imageFile) {
            errors.push(t('coins.superManager.validation.imageFileRequired'));
          }
        } else if (data.uploadMethod === 'url') {
          if (!data.image_url || data.image_url.trim() === '') {
            errors.push(t('coins.superManager.validation.imageUrlRequired'));
          } else if (!data.image_url.startsWith('http://') && !data.image_url.startsWith('https://')) {
            errors.push(t('coins.superManager.validation.imageUrlInvalid'));
          } else {
            // Additional validation: check if URL points to an image
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
            const hasImageExtension = imageExtensions.some(ext => 
              data.image_url.toLowerCase().includes(ext)
            );
            if (!hasImageExtension) {
              errors.push(t('coins.superManager.validation.imageUrlInvalid'));
            } else {
              // Advanced validation: try to load the image
              const isValidImage = await validateImageUrl(data.image_url);
              if (!isValidImage) {
                errors.push(t('coins.superManager.validation.imageUrlInvalid'));
              }
            }
          }
        }
      }
    }
    
    return errors;
  };

  const handleSubmit = async () => {
    setIsValidatingImage(true);
    const errors = await validateForm();
    setIsValidatingImage(false);
    
    if (errors && Array.isArray(errors) && errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationModal(true);
      return;
    }
    
    if (editingItem) {
      if (modalType === 'category') {
        handleEditCategory();
      } else if (modalType === 'package') {
        handleEditPackage();
      } else if (modalType === 'avatar') {
        handleEditAvatar();
      }
    } else {
      if (modalType === 'category') {
        handleCreateCategory();
      } else if (modalType === 'package') {
        handleCreatePackage();
      } else if (modalType === 'avatar') {
        handleCreateAvatar();
      }
    }
  };

  const openCreateModal = (type) => {
    setModalType(type);
    setValidationErrors([]);
    setShowValidationModal(false);
    if (type === 'avatar') {
      setFormData({ uploadMethod: 'file' }); // Default to file upload
    } else {
      setFormData({});
    }
    setShowCreateModal(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm(t('coins.superManager.confirmDeleteCategory'))) {
      return;
    }

    try {
      const response = await axios.delete(`/api/coins/admin/avatar-categories/${categoryId}`);
      
      if (response.data.success) {
        toast.success(t('coins.superManager.categoryDeleted'));
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.superManager.failedToDeleteCategory'));
    }
  };

  const handleDeletePackage = async (packageId) => {
    if (!window.confirm(t('coins.superManager.confirmDeletePackage'))) {
      return;
    }

    try {
      const response = await axios.delete(`/api/coins/admin/coin-packages/${packageId}`);
      
      if (response.data.success) {
        toast.success(t('coins.superManager.packageDeleted'));
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.superManager.failedToDeletePackage'));
    }
  };

  const handleDeleteAvatar = async (avatarId) => {
    if (!window.confirm(t('coins.superManager.confirmDeleteAvatar'))) {
      return;
    }

    try {
      const response = await axios.delete(`/api/coins/admin/avatars/${avatarId}`);
      
      if (response.data.success) {
        toast.success(t('coins.superManager.avatarDeleted'));
        fetchCategoryAvatars(selectedCategory.id);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.superManager.failedToDeleteAvatar'));
    }
  };

  const handleEditCategory = async () => {
    try {
      const response = await axios.put(`/api/coins/admin/avatar-categories/${editingItem.id}`, editFormData);
      
      if (response.data.success) {
        toast.success(t('coins.superManager.categoryUpdated'));
        setEditingItem(null);
        setEditFormData({});
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.superManager.failedToUpdateCategory'));
    }
  };

  const handleEditPackage = async () => {
    try {
      const response = await axios.put(`/api/coins/admin/coin-packages/${editingItem.id}`, editFormData);
      
      if (response.data.success) {
        toast.success(t('coins.superManager.packageUpdated'));
        setEditingItem(null);
        setEditFormData({});
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.superManager.failedToUpdatePackage'));
    }
  };

  const handleEditAvatar = async () => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', editFormData.name);
      formDataToSend.append('description', editFormData.description || '');
      formDataToSend.append('price_coins', editFormData.price_coins);
      
      if (editFormData.uploadMethod === 'file' && editFormData.imageFile) {
        formDataToSend.append('image', editFormData.imageFile);
      } else if (editFormData.uploadMethod === 'url' && editFormData.image_url) {
        formDataToSend.append('image_url', editFormData.image_url);
      }

      const response = await axios.put(`/api/coins/admin/avatars/${editingItem.id}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        toast.success(t('coins.superManager.avatarUpdated'));
        setEditingItem(null);
        setEditFormData({});
        fetchCategoryAvatars(selectedCategory.id);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.superManager.failedToUpdateAvatar'));
    }
  };

  const openEditModal = (item, type) => {
    setEditingItem(item);
    setModalType(type);
    setEditFormData({
      name: item.name,
      description: item.description || '',
      coin_amount: item.coin_amount,
      price_vnd: item.price_vnd,
      price_coins: item.price_coins,
      image_url: item.image_url,
      uploadMethod: 'url'
    });
    setShowCreateModal(true);
  };

  const handleToggleCategory = async (categoryId, currentStatus) => {
    try {
      const response = await axios.patch(`/api/coins/admin/avatar-categories/${categoryId}/toggle`, {
        is_active: !currentStatus
      });
      
      if (response.data.success) {
        toast.success(!currentStatus ? t('coins.superManager.categoryEnabled') : t('coins.superManager.categoryDisabled'));
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.superManager.failedToToggleCategory'));
    }
  };

  const handleTogglePackage = async (packageId, currentStatus) => {
    try {
      const response = await axios.patch(`/api/coins/admin/coin-packages/${packageId}/toggle`, {
        is_active: !currentStatus
      });
      
      if (response.data.success) {
        toast.success(!currentStatus ? t('coins.superManager.packageEnabled') : t('coins.superManager.packageDisabled'));
        fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.superManager.failedToTogglePackage'));
    }
  };

  const openAvatarModal = async (category) => {
    setSelectedCategory(category);
    await fetchCategoryAvatars(category.id);
    setShowAvatarModal(true);
  };

  const fetchCategoryAvatars = async (categoryId) => {
    try {
      const response = await axios.get(`/api/coins/admin/avatar-categories/${categoryId}/avatars`);
      
      if (response.data.success) {
        setCategoryAvatars(response.data.avatars);
      }
    } catch (error) {
      toast.error(t('coins.superManager.failedToFetchCategoryAvatars'));
    }
  };

  const handleCreateAvatar = async () => {
    try {
      let avatarData = {
        ...formData,
        category_id: selectedCategory.id
      };
      
      // Handle file upload if a file was selected
      if (formData.imageFile) {
        const formDataToSend = new FormData();
        formDataToSend.append('image', formData.imageFile);
        formDataToSend.append('name', formData.name);
        formDataToSend.append('description', formData.description || '');
        formDataToSend.append('price_coins', formData.price_coins);
        formDataToSend.append('category_id', selectedCategory.id);
        
        const response = await axios.post('/api/coins/admin/avatars/upload', formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        
        if (response.data.success) {
          toast.success(t('coins.avatarUploaded'));
          setShowCreateModal(false);
          setFormData({});
          setValidationErrors([]);
          setShowValidationModal(false);
          fetchCategoryAvatars(selectedCategory.id);
        }
      } else {
        // Handle URL-based avatar creation
        const response = await axios.post('/api/coins/admin/avatars', avatarData);
        
        if (response.data.success) {
          toast.success(t('coins.avatarCreated'));
          setShowCreateModal(false);
          setFormData({});
          setValidationErrors([]);
          setShowValidationModal(false);
          fetchCategoryAvatars(selectedCategory.id);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('coins.avatarCreateError'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-theme-blue dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-light-gray2 dark:bg-theme-dark-bg pt-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-2">
                {t('coins.manageAvatarsAndCoinPackages')}
              </h1>
              <p className="text-theme-text-secondary dark:text-theme-dark-text-secondary mt-2">
                {t('coins.superManager.description')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-theme-text-primary dark:text-theme-dark-text">
                {t('coins.superManager.welcome', { username: user?.username })}
              </div>
              <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                {t('coins.superManager.role')}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-4 mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('avatars')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center whitespace-normal ${
                activeTab === 'avatars'
                  ? 'bg-theme-blue text-white'
                  : 'text-theme-text-primary dark:text-theme-dark-text hover:bg-theme-bg-hover'
              }`}
            >
              <span className="mr-2">👤</span>
              <span className="text-center">{t('coins.superManager.avatarCategories')}</span>
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center whitespace-normal ${
                activeTab === 'packages'
                  ? 'bg-theme-blue text-white'
                  : 'text-theme-text-primary dark:text-theme-dark-text hover:bg-theme-bg-hover'
              }`}
            >
              <Svg type="coin" className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-center">{t('coins.superManager.coinPackages')}</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-theme-dark-card rounded-lg shadow-md p-6">
          {activeTab === 'avatars' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text">
                  {t('coins.superManager.avatarCategories')}
                </h2>
                <button
                  onClick={() => openCreateModal('category')}
                  className="bg-theme-blue text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  {t('coins.superManager.addCategory')}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {avatarCategories.map((category) => (
                  <div
                    key={category.id}
                    className="bg-theme-bg-primary dark:bg-theme-dark-bg rounded-lg border border-theme-border-light dark:border-theme-dark-border p-4"
                  >
                    <div className="mb-2">
                      <h3 className="text-lg font-bold text-theme-text-primary dark:text-theme-dark-text">
                        {category.name}
                      </h3>
                    </div>
                    <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary mb-2">
                      {category.description || t('coins.noDescription')}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        category.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {category.is_active ? t('coins.superManager.active') : t('coins.superManager.inactive')}
                      </span>
                      <span className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary">
                        {t('coins.superManager.id')} {category.id}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openAvatarModal(category)}
                        className="flex-1 text-xs bg-blue-500 dark:bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                      >
                        {t('coins.manageAvatars')}
                      </button>
                      <button
                        onClick={() => openEditModal(category, 'category')}
                        className="flex-1 text-xs bg-green-500 dark:bg-green-600 text-white px-2 py-1 rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
                      >
                        {t('coins.superManager.edit')}
                      </button>
                      <button
                        onClick={() => handleToggleCategory(category.id, category.is_active)}
                        className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                          category.is_active 
                            ? 'bg-yellow-500 dark:bg-yellow-600 text-white hover:bg-yellow-600 dark:hover:bg-yellow-700' 
                            : 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700'
                        }`}
                      >
                        {category.is_active ? t('coins.superManager.disable') : t('coins.superManager.enable')}
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="flex-1 text-xs bg-red-500 dark:bg-red-600 text-white px-2 py-1 rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                      >
                        {t('coins.superManager.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'packages' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text">
                  {t('coins.superManager.coinPackages')}
                </h2>
                <button
                  onClick={() => openCreateModal('package')}
                  className="bg-theme-blue text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  {t('coins.superManager.addPackage')}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coinPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="bg-theme-bg-primary dark:bg-theme-dark-bg rounded-lg border border-theme-border-light dark:border-theme-dark-border p-4"
                  >
                    <div className="mb-2">
                      <h3 className="text-lg font-bold text-theme-text-primary dark:text-theme-dark-text">
                        {pkg.name}
                      </h3>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                          {t('coins.superManager.coins')}
                        </span>
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold flex items-center">
                          <Svg type="coin" className="w-4 h-4 mr-1" />
                          {pkg.coin_amount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                          {t('coins.superManager.price')}
                        </span>
                        <span className="font-bold">
                          {pkg.price_vnd.toLocaleString()} VND
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        pkg.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {pkg.is_active ? t('coins.superManager.active') : t('coins.superManager.inactive')}
                      </span>
                      <span className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary">
                        {t('coins.superManager.id')} {pkg.id}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(pkg, 'package')}
                        className="flex-1 text-xs bg-green-500 dark:bg-green-600 text-white px-2 py-1 rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
                      >
                        {t('coins.superManager.edit')}
                      </button>
                      <button
                        onClick={() => handleTogglePackage(pkg.id, pkg.is_active)}
                        className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                          pkg.is_active 
                            ? 'bg-yellow-500 dark:bg-yellow-600 text-white hover:bg-yellow-600 dark:hover:bg-yellow-700' 
                            : 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700'
                        }`}
                      >
                        {pkg.is_active ? t('coins.superManager.disable') : t('coins.superManager.enable')}
                      </button>
                      <button
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="flex-1 text-xs bg-red-500 dark:bg-red-600 text-white px-2 py-1 rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                      >
                        {t('coins.superManager.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <Modal showModal={showCreateModal} setShowModal={setShowCreateModal}>
          <div className={`bg-white dark:bg-theme-dark-card rounded-lg p-6 mx-auto w-full max-h-fit overflow-y-auto ${
            modalType === 'avatar' ? 'max-w-6xl' : 'max-w-4xl'
          }`}>
            <h2 className="text-2xl font-bold text-theme-text-primary dark:text-theme-dark-text mb-4">
              {editingItem 
                ? (modalType === 'category' ? t('coins.editAvatarCategory') : 
                   modalType === 'package' ? t('coins.editCoinPackage') : t('coins.editAvatar'))
                : (modalType === 'category' ? t('coins.createAvatarCategory') : 
                   modalType === 'package' ? t('coins.createCoinPackage') : t('coins.uploadAvatar'))
              }
            </h2>
            
            {modalType === 'category' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.categoryName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingItem ? editFormData.name || '' : formData.name || ''}
                    onChange={(e) => editingItem 
                      ? setEditFormData({...editFormData, name: e.target.value})
                      : setFormData({...formData, name: e.target.value})
                    }
                    className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                    placeholder={t('coins.enterCategoryName')}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.description')}
                  </label>
                  <textarea
                    value={editingItem ? editFormData.description || '' : formData.description || ''}
                    onChange={(e) => editingItem 
                      ? setEditFormData({...editFormData, description: e.target.value})
                      : setFormData({...formData, description: e.target.value})
                    }
                    className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                    placeholder={t('coins.enterDescription')}
                    rows="4"
                  />
                </div>
              </div>
            )}

            {modalType === 'package' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.packageName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingItem ? editFormData.name || '' : formData.name || ''}
                    onChange={(e) => editingItem 
                      ? setEditFormData({...editFormData, name: e.target.value})
                      : setFormData({...formData, name: e.target.value})
                    }
                    className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                    placeholder={t('coins.enterPackageName')}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.coinAmount')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingItem ? editFormData.coin_amount || '' : formData.coin_amount || ''}
                    onChange={(e) => editingItem 
                      ? setEditFormData({...editFormData, coin_amount: parseInt(e.target.value)})
                      : setFormData({...formData, coin_amount: parseInt(e.target.value)})
                    }
                    className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                    placeholder={t('coins.enterCoinAmount')}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.priceVND')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingItem ? editFormData.price_vnd || '' : formData.price_vnd || ''}
                    onChange={(e) => editingItem 
                      ? setEditFormData({...editFormData, price_vnd: parseInt(e.target.value)})
                      : setFormData({...formData, price_vnd: parseInt(e.target.value)})
                    }
                    className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                    placeholder={t('coins.enterPriceVND')}
                  />
                </div>
              </div>
            )}

            {modalType === 'avatar' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.avatarName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingItem ? editFormData.name || '' : formData.name || ''}
                    onChange={(e) => editingItem 
                      ? setEditFormData({...editFormData, name: e.target.value})
                      : setFormData({...formData, name: e.target.value})
                    }
                    className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                    placeholder={t('coins.enterAvatarName')}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.description')}
                  </label>
                  <textarea
                    value={editingItem ? editFormData.description || '' : formData.description || ''}
                    onChange={(e) => editingItem 
                      ? setEditFormData({...editFormData, description: e.target.value})
                      : setFormData({...formData, description: e.target.value})
                    }
                    className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                    placeholder={t('coins.enterAvatarDescription')}
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.superManager.avatarImage')} <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="uploadMethod"
                        value="file"
                        checked={(editingItem ? editFormData.uploadMethod : formData.uploadMethod) === 'file'}
                        onChange={(e) => editingItem 
                          ? setEditFormData({...editFormData, uploadMethod: e.target.value})
                          : setFormData({...formData, uploadMethod: e.target.value})
                        }
                        className="w-5 h-5 text-theme-blue"
                      />
                      <span className="text-lg text-theme-text-primary dark:text-theme-dark-text">{t('coins.superManager.fileUpload')}</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="uploadMethod"
                        value="url"
                        checked={(editingItem ? editFormData.uploadMethod : formData.uploadMethod) === 'url'}
                        onChange={(e) => editingItem 
                          ? setEditFormData({...editFormData, uploadMethod: e.target.value})
                          : setFormData({...formData, uploadMethod: e.target.value})
                        }
                        className="w-5 h-5 text-theme-blue"
                      />
                      <span className="text-lg text-theme-text-primary dark:text-theme-dark-text">{t('coins.superManager.urlUpload')}</span>
                    </label>
                  </div>
                  
                  {(editingItem ? editFormData.uploadMethod : formData.uploadMethod) === 'file' ? (
                    <div className="mt-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => editingItem 
                          ? setEditFormData({...editFormData, imageFile: e.target.files[0]})
                          : setFormData({...formData, imageFile: e.target.files[0]})
                        }
                        className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                      />
                    </div>
                  ) : (
                    <div className="mt-3">
                      <input
                        type="url"
                        value={editingItem ? editFormData.image_url || '' : formData.image_url || ''}
                        onChange={(e) => editingItem 
                          ? setEditFormData({...editFormData, image_url: e.target.value})
                          : setFormData({...formData, image_url: e.target.value})
                        }
                        className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                        placeholder={t('coins.superManager.enterImageUrl')}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-lg font-medium text-theme-text-primary dark:text-theme-dark-text mb-3">
                    {t('coins.superManager.priceCoins')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingItem ? editFormData.price_coins || '' : formData.price_coins || ''}
                    onChange={(e) => editingItem 
                      ? setEditFormData({...editFormData, price_coins: parseInt(e.target.value)})
                      : setFormData({...formData, price_coins: parseInt(e.target.value)})
                    }
                    className="w-full px-4 py-3 text-lg border border-theme-border-light dark:border-theme-dark-border rounded-lg bg-theme-bg-primary dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
                    placeholder={t('coins.enterAvatarPrice')}
                  />
                </div>
              </div>
            )}

            <div className="flex space-x-4 mt-6">
              <button
                onClick={editingItem 
                  ? (modalType === 'category' ? handleEditCategory : 
                     modalType === 'package' ? handleEditPackage : handleEditAvatar)
                  : handleSubmit
                }
                disabled={isValidatingImage}
                className={`flex-1 py-3 px-6 rounded-lg transition-colors font-medium text-lg ${
                  isValidatingImage 
                    ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-gray-600 dark:text-gray-400' 
                    : 'bg-theme-blue hover:bg-blue-600 text-white'
                }`}
              >
                {isValidatingImage 
                  ? t('common.loading') 
                  : (editingItem ? t('coins.update') : (modalType === 'avatar' ? t('coins.upload') : t('coins.superManager.create')))
                }
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingItem(null);
                  setEditFormData({});
                  setValidationErrors([]);
                  setShowValidationModal(false);
                }}
                className="flex-1 bg-gray-500 dark:bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors font-medium text-lg"
              >
                {t('coins.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Validation Error Modal */}
      {showValidationModal && validationErrors.length > 0 && (
        <Modal showModal={showValidationModal} setShowModal={setShowValidationModal}>
          <div className="bg-white dark:bg-theme-dark-card rounded-lg p-8 mx-auto w-full max-w-md">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              {t('common.error')}
            </h2>
            <div className="space-y-2 mb-6">
              {validationErrors.map((error, index) => (
                <p key={index} className="text-red-600 dark:text-red-400 text-sm">
                  • {error}
                </p>
              ))}
            </div>
            <button
              onClick={() => setShowValidationModal(false)}
              className="w-full bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800 text-white py-2 px-4 rounded-lg transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </Modal>
      )}

      {/* Avatar Management Modal */}
      {showAvatarModal && selectedCategory && (
        <Modal showModal={showAvatarModal} setShowModal={setShowAvatarModal}>
          <div className="bg-white dark:bg-theme-dark-card rounded-lg p-8 mx-auto w-full h-full max-h-full overflow-y-auto max-w-6xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-theme-text-primary dark:text-theme-dark-text">
                {t('coins.manageAvatarsFor', { categoryName: selectedCategory.name })}
              </h2>
              <button
                onClick={() => {
                  setModalType('avatar');
                  setShowCreateModal(true);
                  setShowAvatarModal(false);
                }}
                className="bg-theme-blue text-white py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors font-medium text-lg"
              >
                + {t('coins.superManager.addAvatar')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {categoryAvatars.map((avatar) => (
                <div
                  key={avatar.id}
                  className="bg-theme-bg-primary dark:bg-theme-dark-bg rounded-lg border border-theme-border-light dark:border-theme-dark-border p-4"
                >
                  <div className="mb-2">
                    <h3 className="text-lg font-bold text-theme-text-primary dark:text-theme-dark-text">
                      {avatar.name}
                    </h3>
                  </div>
                  <div className="text-center mb-3">
                    <img
                      src={avatar.image_url}
                      alt={avatar.name}
                      className="w-20 h-20 mx-auto rounded-lg object-cover"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/80x80?text=Avatar';
                      }}
                    />
                  </div>
                  <p className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary mb-2">
                    {avatar.description || t('coins.noDescription')}
                  </p>
                  <div className="space-y-1 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                        {t('coins.price')}
                      </span>
                      <span className="text-yellow-600 dark:text-yellow-400 font-bold flex items-center">
                        <Svg type="coin" className="w-4 h-4 mr-1" />
                        {avatar.price_coins}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-theme-text-secondary dark:text-theme-dark-text-secondary">
                        {t('coins.status')}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        avatar.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {avatar.is_active ? t('coins.active') : t('coins.inactive')}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-theme-text-secondary dark:text-theme-dark-text-secondary mb-4">
                    {t('coins.id')} {avatar.id}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(avatar, 'avatar')}
                      className="flex-1 text-xs bg-green-500 dark:bg-green-600 text-white px-2 py-1 rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
                    >
                      {t('coins.edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteAvatar(avatar.id)}
                      className="flex-1 text-xs bg-red-500 dark:bg-red-600 text-white px-2 py-1 rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                    >
                      {t('coins.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}