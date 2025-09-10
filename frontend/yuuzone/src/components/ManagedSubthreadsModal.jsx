import { useEffect } from "react";
import Modal from "./Modal";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Svg from "./Svg";
import errorImage from "../assets/error.png";
import PropTypes from 'prop-types';

export default function ManagedSubthreadsModal({ showModal, setShowModal }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["managedSubthreads"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/threads/managed-subthread");
        return response.data;
      } catch (err) {
        console.error("Failed to fetch managed subthreads:", err);
        throw err;
      }
    },
    enabled: false, // disable automatic query on mount
  });

  useEffect(() => {
    if (showModal) {
      refetch();
    }
  }, [showModal, refetch]);

  const handleSubthreadClick = (subthreadName) => {
    setShowModal(false);
    navigate(`/t/${subthreadName.replace(/^t\//, "")}`);
  };

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="modal-content bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text p-6 rounded-lg shadow-md w-full max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-4">{t('subthreads.managedSubthreads')}</h2>
        {isLoading && <p>{t('alerts.loading')}</p>}
        {error && (
          <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-md">
            <img
              src={errorImage}
              alt="Error"
              className="w-8 h-8 flex-shrink-0"
            />
            <p className="text-red-600">
              {t('subthreads.unableToLoadManaged')}
            </p>
          </div>
        )}
                    {!isLoading && data && Array.isArray(data) && data.length === 0 && <p>{t('subthreads.notManagingAny')}</p>}
        <ul className="space-y-8 max-h-96 overflow-y-auto">
          {data &&
            data.map((subthread) => (
              <li
                key={subthread.id}
                className="flex items-center space-x-4 p-4 hover:bg-theme-bg-tertiary dark:hover:bg-theme-dark-bg rounded-md cursor-pointer"
                onClick={() => handleSubthreadClick(subthread.name)}
              >
                {subthread.logo ? (
                  <img src={subthread.logo} alt={subthread.name} className="w-12 h-12 rounded-md object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-theme-bg-tertiary dark:bg-theme-dark-bg rounded-md flex items-center justify-center text-theme-text-secondary font-bold">
                    {subthread.name.charAt(2).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <p className="font-semibold text-lg">{subthread.name}</p>
                    {subthread.isAdmin && (
                      <Svg
                        type="crown-admin"
                        external={true}
                        className="w-8 h-8 text-theme-yellow-crown"
                      />
                    )}
                    {subthread.isMod && !subthread.isAdmin && (
                      <Svg
                type="check_managed_subthread"
                external={true}
                className="w-5 h-5 text-theme-blue"
                      />
                    )}
                  </div>
                  <p className="text-sm text-theme-text-secondary">{subthread.description || t('subthreads.noDescriptionAvailable')}</p>
                </div>
              </li>
            ))}
        </ul>
        <button
          onClick={() => setShowModal(false)}
          className="mt-6 px-4 py-2 bg-theme-blue text-white rounded-md hover:bg-theme-blue-dark"
        >
          {t('alerts.close')}
        </button>
      </div>
    </Modal>
  );
}

ManagedSubthreadsModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  setShowModal: PropTypes.func.isRequired,
};
