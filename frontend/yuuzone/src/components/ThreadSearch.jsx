import React, { useState, useRef, useLayoutEffect } from "react";
import PropTypes from "prop-types";
import axiosInstance from "../api/axiosInstance";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import useClickOutside from "../hooks/useClickOutside";
import Svg from "./Svg";
import Modal from "./Modal";
import { NewThread } from "./NewThread";
import avatar from "../assets/avatar.png";
import "./loader.css";

export function ThreadSearch({ callBackFunc, forPost = false, onHeightChange }) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const searchRef = useRef();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const queryData = useQuery({
    queryKey: ["combined-search", search],
    queryFn: async ({ signal }) => {
      if (!search || !search.trim() || search.trim().length === 0) return [];
      await new Promise((resolve) => setTimeout(resolve, 500)); // Debounce API call
      return await axiosInstance.get(`/search`, {
        params: { q: search },
        signal,
      }).then((response) => response.data);
    },
    enabled: !!(search && search.length > 0 && search.replace && search.replace(/\s/g, "").length > 0),
  });

  useClickOutside(searchRef, () => {
    setSearch("");
    setSelectedIndex(-1);
  });

  useLayoutEffect(() => {
    if (onHeightChange && searchRef.current) {
      onHeightChange(searchRef.current.offsetHeight);
    }
  }, [onHeightChange, search, showModal]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!queryData.data || !Array.isArray(queryData.data) || queryData.data.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < (queryData.data?.length || 0) - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : (queryData.data?.length || 0) - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < (queryData.data?.length || 0)) {
          const item = queryData.data[selectedIndex];
          if (item.username) {
            // User item
            if (callBackFunc) {
              callBackFunc(`/u/${item.username}`);
            } else {
              window.location.href = `/u/${item.username}`;
            }
          } else if (item.name) {
            // Subthread item
            const threadName = item.name.startsWith("t/") ? item.name.slice(2) : item.name;
            if (callBackFunc) {
              callBackFunc(forPost ? { id: item.id, name: item.name } : `/t/${threadName}`);
            } else {
              window.location.href = `/t/${threadName}`;
            }
          }
          setSearch("");
          setSelectedIndex(-1);
        }
        break;
      case 'Escape':
        setSearch("");
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div
      className="flex items-center py-1 pl-2 md:p-1 space-x-4 rounded-md bg-theme-light-gray2 dark:bg-theme-dark-card relative border border-transparent focus-within:border-theme-blue dark:focus-within:border-theme-blue transition-colors"
      ref={searchRef}
    >
      <Svg type="search" className="w-6 h-6" />
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setSelectedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        type="text"
        name="search"
        id="search"
        className="py-1 w-[520px] md:w-full bg-transparent dark:bg-transparent text-theme-text-primary dark:text-theme-dark-text focus:outline-none rounded-md placeholder-theme-text-secondary dark:placeholder-theme-dark-placeholder-80"
        placeholder={t('subthreads.findCommunityOrUser')}
        autoComplete="off"
      />
      {search && (
        <button
          onClick={() => setSearch("")}
          className="text-theme-text-secondary dark:text-theme-dark-text hover:text-theme-text-primary dark:hover:text-theme-dark-text-secondary transition-colors"
          title="Clear search"
        >
          <Svg type="close" className="w-5 h-5" />
        </button>
      )}
      {search && (
        <ul className="flex absolute right-0 top-full z-50 flex-col p-3 mt-2 space-y-1 w-full list-none bg-theme-less-white dark:bg-theme-dark-card rounded-md border shadow-xl border-y-theme-gray-blue dark:border-theme-dark-border">
          {queryData.isLoading ? (
            <li className="text-center text-sm text-theme-gray-blue dark:text-theme-dark-text select-none py-2">
              <span className="inline-flex items-center">
                {t('common.searching')}
                <span className="ml-1 searching-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </span>
            </li>
          ) : queryData.data && Array.isArray(queryData.data) && queryData.data.length > 0 ? (
            <>
              {/* Subthreads Section */}
              {queryData.data.some(item => item.logo) && (
                <>
                  <li className="font-bold border-b border-gray-300 dark:border-theme-dark-border pb-1 mb-1 select-none text-theme-text-primary dark:text-theme-dark-text">{t('subthreads.subthreads')}</li>
                  {queryData.data.filter(item => item.logo).slice(0, 10).map((item, index) => (
                    <li
                      className={`flex space-x-5 cursor-pointer hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover p-2 rounded-md transition-colors ${selectedIndex === index ? 'bg-theme-pale-gray dark:bg-theme-dark-hover' : ''}`}
                      key={item.id}
                      onClick={() => {
                        const threadName = item.name.startsWith("t/") ? item.name.slice(2) : item.name;
                        if (callBackFunc) {
                          callBackFunc(forPost ? { id: item.id, name: item.name } : `/t/${threadName}`);
                        } else {
                          // Default navigation if no callback provided
                          window.location.href = `/t/${threadName}`;
                        }
                        setSearch("");
                        setSelectedIndex(-1);
                      }}
                    >
                      <img src={item.logo || avatar} className="object-cover w-10 h-10 rounded-md" alt={`${item.name} logo`} />
                      <div className="flex flex-col">
                        <p className="text-sm font-semibold tracking-wide md:text-base text-theme-text-primary dark:text-theme-dark-text">{item.name}</p>
                        <p className="text-xs text-theme-text-secondary dark:text-theme-dark-text">{t('subthreads.membersCount', { count: item.subscriberCount || item.members_count || 0 })}</p>
                      </div>
                    </li>
                  ))}
                </>
              )}

              {/* Users Section */}
              {queryData.data.some(item => item.username) && (
                <>
                  <li className="font-bold border-b border-gray-300 dark:border-theme-dark-border pb-1 mb-1 select-none text-theme-text-primary dark:text-theme-dark-text">{t('navigation.users')}</li>
                  {queryData.data.filter(item => item.username && !item.deleted && !item.username.startsWith("del_")).slice(0, 10).map((item, index) => {
                    const actualIndex = (queryData.data?.filter(item => item.logo) || []).length + index;
                    return (
                    <li
                      className={`flex space-x-5 cursor-pointer hover:bg-theme-pale-gray dark:hover:bg-theme-dark-hover p-2 rounded-md transition-colors ${selectedIndex === actualIndex ? 'bg-theme-pale-gray dark:bg-theme-dark-hover' : ''}`}
                      key={item.username}
                      onClick={() => {
                        if (callBackFunc) {
                          callBackFunc(`/u/${item.username}`);
                        } else {
                          // Default navigation if no callback provided
                          window.location.href = `/u/${item.username}`;
                        }
                        setSearch("");
                        setSelectedIndex(-1);
                      }}
                    >
                      <img src={item.avatar || avatar} className="object-cover w-10 h-10 rounded-md" alt={`${item.username} avatar`} />
                      <div className="flex flex-col">
                        <p className="text-sm font-semibold tracking-wide md:text-base text-theme-text-primary dark:text-theme-dark-text">{item.username}</p>
                      </div>
                    </li>
                  );
                })}
                </>
              )}
            </>
          ) : (
            <li className="text-center text-sm text-theme-gray-blue dark:text-theme-dark-text select-none py-2">
              No results found for &quot;{search}&quot;
            </li>
          )}
        </ul>
      )}
      {showModal && (
        <Modal setShowModal={setShowModal}>
          <NewThread setShowModal={setShowModal} />
        </Modal>
      )}
    </div>
  );
}

ThreadSearch.propTypes = {
  callBackFunc: PropTypes.func,
  forPost: PropTypes.bool,
  onHeightChange: PropTypes.func,
};
