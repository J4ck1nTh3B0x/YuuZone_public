import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import JoinedSubthreadsModal from "./JoinedSubthreadsModal";
import Svg from "./Svg";

export function ThreadsSidebar() {
  const { t } = useTranslation();
  const [showJoinedModal, setShowJoinedModal] = useState(false);

  const { data } = useQuery({
    queryKey: ["threads/all"],
    queryFn: async () => {
      return await axios.get("/api/threads").then((res) => res.data);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary refetches
    gcTime: 10 * 60 * 1000, // 10 minutes - keep data longer
    refetchOnWindowFocus: false, // Prevent refetch when window regains focus
    refetchOnMount: false, // Prevent refetch when component mounts
    refetchOnReconnect: false, // Prevent refetch on network reconnect
  });

  return (
    <>
      {/* Fixed sidebar with full height */}
      <aside className="w-full h-full bg-theme-less-white dark:bg-theme-dark-bg dark:text-theme-dark-text border-r border-theme-border-light dark:border-theme-dark-border shadow-md p-4 overflow-y-auto">
        {data?.subscribed && Array.isArray(data.subscribed) && data.subscribed.length !== 0 && (
          <>
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex justify-between items-center w-full cursor-pointer">
                <h2 className="font-semibold uppercase text-theme-text-primary dark:text-theme-dark-text">{t('subthreads.joinedSubthreads')}</h2>
                <span
                  className="ml-4 px-2 py-1 bg-theme-pale-gray dark:bg-theme-dark-card rounded hover:bg-gray-300 transition-colors text-sm font-medium text-theme-text-secondary dark:text-theme-dark-text"
                  onClick={() => setShowJoinedModal(true)}
                >
                  ALL
                </span>
              </div>
              <SideBarComponent threadList={data?.subscribed} limit={3} />
            </div>
          </>
        )}
        <div className="flex flex-col space-y-4 mb-6">
          <div className="flex items-center w-full">
            <h2 className="font-semibold uppercase text-theme-text-primary dark:text-theme-dark-text">
              {t('subthreads.topSubthreads')}
            </h2>
          </div>
          <SideBarComponent threadList={data?.all} limit={3} />
        </div>
        <div className="flex flex-col space-y-4 mb-6">
          <div className="flex items-center w-full">
            <h2 className="font-semibold uppercase text-theme-text-primary dark:text-theme-dark-text">
              {t('subthreads.popularSubthreads')}
            </h2>
          </div>
          <SideBarComponent threadList={data?.popular} limit={3} />
        </div>
        
        {/* Buy Tier Button */}
        <div className="mt-6 pt-4 border-t border-theme-silver-chalice dark:border-theme-dark-border">
          <Link
            to="/subscriptions"
            className="flex items-center justify-center w-full px-4 py-3 bg-theme-button-primary hover:bg-theme-button-primary-hover text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <Svg type="crown" className="w-5 h-5 mr-2" />
            {t('subscription.buySubscription')}
          </Link>
        </div>
      </aside>

      {showJoinedModal && (
        <JoinedSubthreadsModal
          showModal={showJoinedModal}
          setShowModal={setShowJoinedModal}
        />
      )}
    </>
  );
}

SideBarComponent.propTypes = {
  threadList: PropTypes.array,
  limit: PropTypes.number,
};

function SideBarComponent({ threadList, limit = 10 }) {
  return (
    <div className="flex flex-col space-y-4 w-full list-none">
      {(threadList || []).slice(0, limit).map((thread) => (
        <Link to={`/t/${thread.name.startsWith("t/") ? thread.name.slice(2) : thread.name}`} className="flex justify-between w-full cursor-pointer" key={thread.name}>
            <div className={`flex items-center space-x-3 ${!thread.logo && "pl-9"}`}>
              {thread.logo && <img loading="lazy" width="auto" height="100%" src={thread.logo} alt="" className="object-cover w-6 h-6 rounded-md" />}
              <span className="truncate">{thread.name}</span>
            </div>
            <span className="p-1 px-2 text-sm font-semibold rounded-md dark:text-theme-dark-text">
              {thread.subscriberCount > 9 ? thread.subscriberCount : `0${thread.subscriberCount}`}
            </span>
          </Link>
        ))}
    </div>
  );
}

export default ThreadsSidebar;