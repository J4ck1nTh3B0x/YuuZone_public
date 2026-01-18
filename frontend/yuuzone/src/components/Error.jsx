import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import errorImage from "../assets/error.png";

Error.propTypes = {
  message: PropTypes.string,
  fullScreen: PropTypes.bool,
  developerMessage: PropTypes.string,
};

export default function Error({ message, fullScreen = true, developerMessage = null }) {
  const { t } = useTranslation();
  const defaultMessage = message || t('errors.unexpectedError');
  return (
    <div
      className={`flex flex-col justify-center items-center ${
        fullScreen ? "w-screen h-screen" : "w-full h-full"
      } bg-theme-light-gray2 dark:bg-theme-dark-bg p-4 dark:text-theme-dark-text`}>
      <div className="flex flex-col items-center">
        <img
          src={errorImage}
          alt={t('common.error')}
          className="w-[360px] h-[360px] flex-shrink-0 object-contain"
        />
        <div className="h-[33px]"></div>
        <h1 className="text-2xl font-bold text-center text-theme-text-primary dark:text-theme-dark-text">{defaultMessage}</h1>
      </div>
      {developerMessage && (
        <details className="mt-4 p-4 bg-theme-bg-tertiary dark:bg-theme-dark-bg rounded border border-theme-border-medium dark:border-theme-dark-border w-full max-w-xl text-left text-sm text-theme-text-primary dark:text-theme-dark-text">
          <summary className="cursor-pointer font-semibold">{t('errors.developerDetails')}</summary>
          <pre className="whitespace-pre-wrap">{developerMessage}</pre>
        </details>
      )}
    </div>
  );
}
