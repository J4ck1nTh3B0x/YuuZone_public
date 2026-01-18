import AuthConsumer from "./AuthContext";
import avatar from "../assets/avatar.png";
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import { toast } from 'react-toastify';

NewThread.propTypes = {
  subThreadName: PropTypes.string,
  setShowModal: PropTypes.func,
  edit: PropTypes.bool,
  ogInfo: PropTypes.object,
};

export function NewThread({ subThreadName, setShowModal, edit = false, ogInfo = {} }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [subName, setSubName] = useState(edit ? ogInfo.name : subThreadName);
  const [description, setDescription] = useState(ogInfo?.description || "");
  const [media, setMedia] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [imageUrl, setImageUrl] = useState("");
  const [nameError, setNameError] = useState("");
  const { user } = AuthConsumer();

  // Validate subthread name
  function validateSubthreadName(name) {
    if (!name || !name.trim()) {
      return t('subthreads.validation.nameRequired');
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 3) {
      return t('subthreads.validation.nameTooShort');
    }

    if (trimmedName.length > 30) {
      return t('subthreads.validation.nameTooLong');
    }

    if (!/^[A-Za-z0-9_]+$/.test(trimmedName)) {
      return t('subthreads.validation.invalidCharacters');
    }

    if (/^_+$/.test(trimmedName)) {
      return t('subthreads.validation.onlyUnderscores');
    }

    return "";
  }

  // Handle name change with validation
  function handleNameChange(value) {
    setSubName(value);
    if (!edit) {
      const error = validateSubthreadName(value);
      setNameError(error);
    }
  }
  async function handleSubmit(e) {
    e?.preventDefault();

    // Validate form before submission
    if (!edit) {
      const nameValidationError = validateSubthreadName(subName);
      if (nameValidationError) {
        setNameError(nameValidationError);
        toast.error(t('alerts.cannotCreateSubthread', { error: nameValidationError }));
        return;
      }
    }

    const formData = new FormData();
    if (!edit) {
      formData.append("name", subName);
    }
    formData.append("content_type", mediaType);
    formData.append("content_url", imageUrl);
    formData.append("description", description);
    if (media) {
      formData.append("media", media, media.name);
    }
    if (!edit) {
      await axios
        .post("/api/new-subthread", formData, { headers: { "Content-Type": "multipart/form-data" } })
        .then(() => setShowModal(false))
        .catch((err) => {
          const errorMessage = err.response?.data?.message || err.message || t('alerts.unknownErrorOccurred');
          toast.error(t('alerts.failedToCreateSubthread', { error: errorMessage }));
        });
    } else {
      await axios
        .patch(`/api/thread/${ogInfo.id}`, formData, { headers: { "Content-Type": "multipart/form-data" } })
        .then((res) => {
          setShowModal(false);
          queryClient.setQueryData(["thread", `${ogInfo.name.slice(2)}`], () => res.data.new_data);
        })
        .catch((err) => {
          const errorMessage = err.response?.data?.message || err.message || t('alerts.unknownErrorOccurred');
          toast.error(t('alerts.failedToUpdateSubthread', { error: errorMessage }));
        });
    }
  }
  useEffect(() => {
    focusManager.setFocused(false);
    return () => focusManager.setFocused(true);
  }, []);
  return (
    <div
      className={`flex flex-col p-5 space-y-5 w-5/6 rounded-md min-h-4/6 ${
        edit ? "md:w-2/4 md:h-4/6" : "md:w-3/4 md:h-5/6"
      }  md:p-10 bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text`}>
      <div className="flex flex-col justify-around items-center p-4 space-y-3 bg-theme-less-white dark:bg-theme-dark-card rounded-lg md:flex-row md:space-y-0">
        <p className="dark:text-theme-dark-text-secondary">{edit ? t('subthreads.editing') : t('subthreads.creating')} {t('subthreads.subthreadAs')}</p>
        <div className="flex items-center space-x-3">
          <img src={user.avatar || avatar} className="object-cover w-9 h-9 rounded-md" alt="" />
          <p className="dark:text-theme-dark-text-secondary">{user.username}</p>
        </div>
      </div>
      <form className="flex flex-col flex-1 justify-around p-3 space-y-5 w-full h-1/2 bg-theme-less-white dark:bg-theme-dark-card rounded-md" onSubmit={handleSubmit}>
        {!edit && (
          <div className="flex flex-col space-y-1">
            <label htmlFor="name" className="flex flex-col space-y-1 md:space-y-0 md:space-x-2 md:flex-row">
              <span className="text-sm font-light dark:text-theme-dark-text-secondary">{t('subthreads.subthreadName')}</span>
              <input
                type="text"
                name="name"
                id="name"
                value={subName}
                placeholder={t('subthreads.enterSubthreadName')}
                onChange={(e) => handleNameChange(e.target.value)}
                className={`w-full border-b focus:outline-none bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text ${nameError ? 'border-red-500' : 'border-gray-800 dark:border-theme-dark-border'} placeholder-theme-text-secondary dark:placeholder-theme-dark-placeholder-80`}
                required={true}
                maxLength={30}
                minLength={3}
              />
            </label>
            {nameError && (
              <span className="text-xs text-red-500 mt-1">{nameError}</span>
            )}
            <span className="text-xs text-gray-500 mt-1 dark:text-theme-dark-text-secondary">
              {t('subthreads.validation.nameConstraints')}
            </span>
          </div>
        )}
        <label
          htmlFor="description"
          className="flex flex-col items-center space-y-1 md:space-y-0 md:space-x-2 md:flex-row">
          <span className="text-sm font-light dark:text-theme-dark-text-secondary">{t('subthreads.description')}</span>
          <textarea
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            name="description"
            id="description"
            className="w-full h-20 max-h-28 border-b border-gray-800 dark:border-theme-dark-border focus:outline-none bg-theme-less-white dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text placeholder-theme-text-secondary dark:placeholder-theme-dark-placeholder-80"
          />
        </label>
        <label htmlFor="media" className="flex flex-col items-center space-y-3 md:space-y-0 md:space-x-5 md:flex-row">
          <div className="flex w-full items-center gap-2 flex-1">
            <select
              className="px-10 py-2 bg-theme-less-white dark:bg-theme-dark-bg rounded-md border border-gray-800 dark:border-theme-dark-border md:px-12 text-theme-text-primary dark:text-theme-dark-text"
              name="type"
              id="media_type"
              onChange={(e) => setMediaType(e.target.value)}>
              <option value="image">{t('subthreads.image')}</option>
              <option value="url">{t('subthreads.url')}</option>
            </select>
            {mediaType === "image" ? (
              <input
                onChange={(e) => {
                  if (e.target.files[0].size > 10485760) {
                    toast.error(t('alerts.fileTooLarge'));
                  } else {
                    setMedia(e.target.files[0]);
                  }
                }}
                type="file"
                name="file"
                accept="image/*"
                id="image"
                className="flex-1 min-w-0 focus:outline-none bg-theme-less-white dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text"
              />
            ) : (
              <input
                type="text"
                name="media_url"
                id="media_url"
                className="p-2 flex-1 rounded-md border border-gray-800 dark:border-theme-dark-border focus:outline-none bg-theme-less-white dark:bg-theme-dark-bg text-theme-text-primary dark:text-theme-dark-text placeholder-theme-text-secondary dark:placeholder-theme-dark-placeholder-80"
                onChange={(e) => setImageUrl(e.target.value)}
              />
            )}
          </div>
        </label>
        {edit && (
          <span className="text-sm font-semibold text-red-500">
            {t('subthreads.onlyAddImageToModify')}
          </span>
        )}
        <button
          type="submit"
          className="py-2 font-semibold text-white rounded-md bg-theme-blue active:scale-95">
          {t('common.submit')}
        </button>
      </form>
    </div>
  );
}
