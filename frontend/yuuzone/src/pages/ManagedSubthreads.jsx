import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader } from "../components/Loader";

export default function ManagedSubthreads() {
  const { t } = useTranslation();
  const { data: subthreads, isLoading, error } = useQuery({
    queryKey: ["managedSubthreads"],
    queryFn: async () => {
      const response = await axios.get("/api/threads/managed-subthread");
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">{t('subthreads.managedSubthreads')}</h1>
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">{t('subthreads.managedSubthreads')}</h1>
        <div className="text-center text-red-500 py-8">
          {t('subthreads.failedToLoadManaged')}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">{t('subthreads.managedSubthreads')}</h1>
      <ul className="space-y-4">
        {subthreads.map((subthread) => (
          <li key={subthread.id} className="border rounded p-4 hover:shadow-md">
            <Link to={`/t/${subthread.name.replace("t/", "")}`} className="text-xl font-semibold text-blue-600 hover:underline">
              {subthread.name}
            </Link>
            <p className="mt-2 text-gray-700">{subthread.description}</p>
            <div className="mt-1 text-sm text-gray-500">
              {t('subthreads.members')}: {subthread.subscriberCount} | {t('subthreads.posts')}: {subthread.PostsCount} | {t('subthreads.comments')}: {subthread.CommentsCount}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
