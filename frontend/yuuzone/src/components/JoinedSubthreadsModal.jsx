import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import Modal from "./Modal";

import Svg from "./Svg";
import PropTypes from 'prop-types';

export default function JoinedSubthreadsModal({ showModal, setShowModal }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["joinedSubthreads"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/threads");
        return response.data.subscribed || [];
      } catch (err) {
        console.error("Failed to fetch joined subthreads:", err);
        throw err;
      }
    },
    enabled: false, // disable automatic query on mount
  });

  useEffect(() => {
    if (showModal) {
      refetch();
      setSearchTerm(""); // Reset search when modal opens
    }
  }, [showModal, refetch]);

  const handleSubthreadClick = (subthreadName) => {
    setShowModal(false);
    // Remove "t/" prefix from subthreadName if it exists to prevent duplicate "/t/t/"
    const threadName = subthreadName.startsWith("t/") ? subthreadName.substring(2) : subthreadName;
    navigate(`/t/${threadName}`);
  };

  const filteredSubthreads = data?.filter(subthread =>
    subthread.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (!showModal) return null;

  return (
    <Modal setShowModal={setShowModal}>
      <div className="modal-content bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text p-10 rounded-lg shadow-md w-full max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-semibold text-theme-text-primary dark:text-theme-dark-text">{t('subthreads.joinedSubthreads')}</h2>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-theme-dark-text dark:hover:text-theme-dark-text"
          >
            <Svg type="close" className="w-8 h-8" />
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder={t('subthreads.searchSubthreads')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-4 bg-theme-less-white dark:bg-theme-dark-card dark:text-theme-dark-text border border-theme-border-light dark:border-theme-dark-border rounded text-lg"
          />
        </div>

        <div className="max-h-[70vh] overflow-y-auto scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Hide scrollbar for Webkit browsers */}
          <style>{`
            .scrollbar-none::-webkit-scrollbar { display: none; }
          `}</style>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-12 h-12 border-4 border-theme-blue border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8 text-lg">
              {t('subthreads.failedToLoadSubthreads')}
            </div>
                      ) : filteredSubthreads && Array.isArray(filteredSubthreads) && filteredSubthreads.length > 0 ? (
            <ul className="space-y-2">
              {filteredSubthreads.map((subthread) => (
                <li
                  key={subthread.id}
                  onClick={() => handleSubthreadClick(subthread.name)}
                  className="thread-item text-theme-text-primary dark:text-theme-dark-text p-2 rounded hover:bg-theme-pale-gray dark:hover:bg-theme-dark-card cursor-pointer flex items-center space-x-4"
                >
                  <img
                    src={subthread.logo || "/default-subthread.png"}
                    alt={subthread.name}
                    className="w-12 h-12 rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-lg">{subthread.name}</p>
                    <p className="text-base text-gray-500">
                      {t('subthreads.membersCount', { count: subthread.subscriberCount })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-gray-500 py-8 text-lg">
              {searchTerm ? t('subthreads.noSubthreadsFound') : t('subthreads.noJoinedSubthreads')}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

JoinedSubthreadsModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  setShowModal: PropTypes.func.isRequired,
};
