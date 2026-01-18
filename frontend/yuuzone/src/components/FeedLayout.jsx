import { Outlet } from "react-router-dom";

export default function FeedLayout() {
  return (
    <div className="flex flex-1 max-w-full bg-theme-light-gray2 dark:bg-theme-dark-bg dark:text-theme-dark-text">
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
