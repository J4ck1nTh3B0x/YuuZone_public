import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

Svg.propTypes = {
  type: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func,
  active: PropTypes.bool,
  defaultStyle: PropTypes.bool,
  external: PropTypes.bool,
};

const svgTypes = {
  moon: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
    />
  ),
  home: (
    <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a.999.999 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 6 6V15l.001 5H16v-5c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v5H6v-9.586l6-6z"></path>
  ),
  popular: <path d="M9 6h2v14H9zm4 2h2v12h-2zm4-4h2v16h-2zM5 12h2v8H5z"></path>,
  all: (
    <path d="M6 21H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1zm7 0h-3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1zm7 0h-3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1z"></path>
  ),
  search: (
    <path d="M10 18a7.952 7.952 0 0 0 4.897-1.688l4.396 4.396 1.414-1.414-4.396-4.396A7.952 7.952 0 0 0 18 10c0-4.411-3.589-8-8-8s-8 3.589-8 8 3.589 8 8 8zm0-14c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6z"></path>
  ),
  close: (
    <path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path>
  ),
  message: (
    <path d="M20 3H4c-1.103 0-2 .897-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5c0-1.103-.897-2-2-2zm-1 9h-3.142c-.446 1.722-1.997 3-3.858 3s-3.412-1.278-3.858-3H4V5h16v7h-1z"></path>
  ),
  translate: (
    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"></path>
  ),
  mail: (
    <path d="M20 4H4c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2zm0 2v.511l-8 6.223-8-6.222V6h16zM4 18V9.044l7.386 5.745a.994.994 0 0 0 1.228 0L20 9.044 20.002 18H4z"></path>
  ),
  "down-arrow": <path d="M16.293 9.293 12 13.586 7.707 9.293l-1.414 1.414L12 16.414l5.707-5.707z"></path>,
  notifications: (
    <>
      <circle cx="18" cy="6" r="3"></circle>
      <path d="M13 6c0-.712.153-1.387.422-2H6c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7.422A4.962 4.962 0 0 1 18 11a5 5 0 0 1-5-5z"></path>
    </>
  ),
  "eye-open": (
    <>
      <path d="M12 5c-7.633 0-9.927 6.617-9.948 6.684L1.946 12l.105.316C2.073 12.383 4.367 19 12 19s9.927-6.617 9.948-6.684l.106-.316-.105-.316C21.927 11.617 19.633 5 12 5zm0 11c-2.206 0-4-1.794-4-4s1.794-4 4-4 4 1.794 4 4-1.794 4-4 4z"></path>
      <path d="M12 10c-1.084 0-2 .916-2 2s.916 2 2 2 2-.916 2-2-.916-2-2-2z"></path>
    </>
  ),
  "eye-close": (
    <path d="M8.073 12.194 4.212 8.333c-1.52 1.657-2.096 3.317-2.106 3.351L2 12l.105.316C2.127 12.383 4.421 19 12.054 19c.929 0 1.775-.102 2.552-.273l-2.746-2.746a3.987 3.987 0 0 1-3.787-3.787zM12.054 5c-1.855 0-3.375.404-4.642.998L3.707 2.293 2.293 3.707l18 18 1.414-1.414-3.298-3.298c2.638-1.953 3.579-4.637 3.593-4.679l.105-.316-.105-.316C21.98 11.617 19.687 5 12.054 5zm1.906 7.546c.187-.677.028-1.439-.492-1.96s-1.283-.679-1.96-.492L10 8.586A3.955 3.955 0 0 1 12.054 8c2.206 0 4 1.794 4 4a3.94 3.94 0 0 1-.587 2.053l-1.507-1.507z"></path>
  ),
  "arrow-right": <path d="m11.293 17.293 1.414 1.414L19.414 12l-6.707-6.707-1.414 1.414L15.586 11H6v2h9.586z"></path>,
  "circle-logout": (
    <>
      <path d="m2 12 5 4v-3h9v-2H7V8z"></path>
      <path d="M13.001 2.999a8.938 8.938 0 0 0-6.364 2.637L8.051 7.05c1.322-1.322 3.08-2.051 4.95-2.051s3.628.729 4.95 2.051S20 10.13 20 12s-.729 3.628-2.051 4.95-3.08 2.051-4.95 2.051-3.628-.729-4.95-2.051l-1.414 1.414c1.699 1.7 3.959 2.637 6.364 2.637s4.665-.937 6.364-2.637c1.7-1.699 2.637-3.959 2.637-6.364s-.937-4.665-2.637-6.364a8.938 8.938 0 0 0-6.364-2.637z"></path>
    </>
  ),
  "circle-login": (
    <>
      <path d="m10.998 16 5-4-5-4v3h-9v2h9z"></path>
      <path d="M12.999 2.999a8.938 8.938 0 0 0-6.364 2.637L8.049 7.05c1.322-1.322 3.08-2.051 4.95-2.051s3.628.729 4.95 2.051S20 10.13 20 12s-.729 3.628-2.051 4.95-3.08 2.051-4.95 2.051-3.628-.729-4.95-2.051l-1.414 1.414c1.699 1.7 3.959 2.637 6.364 2.637s4.665-.937 6.364-2.637C21.063 16.665 22 14.405 22 12s-.937-4.665-2.637-6.364a8.938 8.938 0 0 0-6.364-2.637z"></path>
    </>
  ),
  more: (
    <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
  ),
  share: (
    <path d="M5.5 15a3.51 3.51 0 0 0 2.36-.93l6.26 3.58a3.06 3.06 0 0 0-.12.85 3.53 3.53 0 1 0 1.14-2.57l-6.26-3.58a2.74 2.74 0 0 0 .12-.76l6.15-3.52A3.49 3.49 0 1 0 14 5.5a3.35 3.35 0 0 0 .12.85L8.43 9.6A3.5 3.5 0 1 0 5.5 15zm12 2a1.5 1.5 0 1 1-1.5 1.5 1.5 1.5 0 0 1 1.5-1.5zm0-13A1.5 1.5 0 1 1 16 5.5 1.5 1.5 0 0 1 17.5 4zm-12 6A1.5 1.5 0 1 1 4 11.5 1.5 1.5 0 0 1 5.5 10z"></path>
  ),
  comment: (
    <path d="M20 2H4c-1.103 0-2 .897-2 2v18l5.333-4H20c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2zm0 14H6.667L4 18V4h16v12z"></path>
  ),
  mobileVote: <path d="M13 18v-6h5l-6-7-6 7h5v6z"></path>,
  add: <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"></path>,
  edit: (
    <path d="M19.045 7.401c.378-.378.586-.88.586-1.414s-.208-1.036-.586-1.414l-1.586-1.586c-.378-.378-.88-.586-1.414-.586s-1.036.208-1.413.585L4 13.585V18h4.413L19.045 7.401zm-3-3 1.587 1.585-1.59 1.584-1.586-1.585 1.589-1.584zM6 16v-1.585l7.04-7.018 1.586 1.586L7.587 16H6zm-2 4h16v2H4z"></path>
  ),
  send: (
    <path d="m21.426 11.095-17-8A1 1 0 0 0 3.03 4.242l1.212 4.849L12 12l-7.758 2.909-1.212 4.849a.998.998 0 0 0 1.396 1.147l17-8a1 1 0 0 0 0-1.81z"></path>
  ),
  save: (
    <path d="M5 21h14a2 2 0 0 0 2-2V8l-5-5H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2zM7 5h4v2h2V5h2v4H7V5zm0 8h10v6H7v-6z"></path>
  ),
  delete: (
    <path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z"></path>
  ),
  crown: (
    <path d="M4 19H20M11.2929 5.70711L8.70711 8.2929C8.31658 8.68342 7.68342 8.68342 7.29289 8.2929L5.70711 6.70711C5.07714 6.07714 4 6.52331 4 7.41422V15C4 15.5523 4.44772 16 5 16H19C19.5523 16 20 15.5523 20 15V7.41421C20 6.52331 18.9229 6.07714 18.2929 6.70711L16.7071 8.2929C16.3166 8.68342 15.6834 8.68342 15.2929 8.2929L12.7071 5.70711C12.3166 5.31658 11.6834 5.31658 11.2929 5.70711Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),
  check_managed_subthread: (
    <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" fill="none"/>
    </>
  ),
  coin: (
    <>
      <path fill="currentColor" d="m161.92 580.736 29.888 58.88C171.328 659.776 160 681.728 160 704c0 82.304 155.328 160 352 160s352-77.696 352-160c0-22.272-11.392-44.16-31.808-64.32l30.464-58.432C903.936 615.808 928 657.664 928 704c0 129.728-188.544 224-416 224S96 833.728 96 704c0-46.592 24.32-88.576 65.92-123.264z"></path>
      <path fill="currentColor" d="m161.92 388.736 29.888 58.88C171.328 467.84 160 489.792 160 512c0 82.304 155.328 160 352 160s352-77.696 352-160c0-22.272-11.392-44.16-31.808-64.32l30.464-58.432C903.936 423.808 928 465.664 928 512c0 129.728-188.544 224-416 224S96 641.728 96 512c0-46.592 24.32-88.576 65.92-123.264z"></path>
      <path fill="currentColor" d="M512 544c-227.456 0-416-94.272-416-224S284.544 96 512 96s416 94.272 416 224-188.544 224-416 224zm0-64c196.672 0 352-77.696 352-160S708.672 160 512 160s-352 77.696-352 160 155.328 160 352 160z"></path>
    </>
  ),
  link: (
    <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" fill="none"/>
    </>
  ),
  play: (
    <path d="M8 5v14l11-7z"></path>
  ),
  video: (
    <path d="M18 7c0-1.103-.897-2-2-2H4c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-4l4 2v-8l-4 2V7zM16 17H4V7h12v10z"></path>
  ),
  image: (
    <path d="M19 3H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm0 16H5V5h14v14z"></path>
  ),
  phone: (
    <path d="M17.707 12.293a.999.999 0 0 0-1.414 0l-1.594 1.594c-.739-.22-2.118-.72-2.992-1.594s-1.374-2.253-1.594-2.992l1.594-1.594a.999.999 0 0 0 0-1.414L8.586 3.172a.999.999 0 0 0-1.414 0L5.636 4.708c-.395.395-.408.984-.03 1.391.649 1.162 1.394 2.233 2.809 3.648 1.415 1.415 2.486 2.16 3.648 2.809.407.378.996.365 1.391-.03l1.536-1.536a.999.999 0 0 0 0-1.414l-3.121-3.121z"></path>
  ),
  emoji: (
    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"></path>
  ),
  attachment: (
    <path d="M8.267 14.68c-.184 0-.308.018-.372.036v1.178c.076.018.171.023.302.023.479 0 .774-.242.774-.651 0-.366-.254-.586-.704-.586zm3.487.012c-.2 0-.33.018-.407.036v2.61c.077.018.201.018.313.018.817.006 1.349-.444 1.349-1.396.006-.83-.479-1.268-1.255-1.268z"></path>
  ),
  user: (
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
  ),
  sun: (
    <g>
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" />
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" />
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
};

export function Svg({ type, className, onClick, active, defaultStyle = true, external = false }) {
  const [DynamicSvg, setDynamicSvg] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [pngFallback, setPngFallback] = useState(null);

  // Validate type prop to avoid invalid tag names (e.g., data URIs)
  const isValidType = typeof type === "string" && !type.startsWith("data:");

  useEffect(() => {
    if (!isValidType) {
      setDynamicSvg(null);
      setLoadError(true);
      setPngFallback(null);
      return;
    }

    // If external is true, try to import from assets, otherwise use static svgTypes
    if (external) {
      const importSvg = async () => {
        try {
          setLoadError(false);
          setPngFallback(null);
          // Try different import methods for SVGR compatibility
          let module = null;

          try {
            // Method 1: ?react (recommended for vite-plugin-svgr)
            module = await import(`../assets/${type}.svg?react`);
          } catch {
            try {
              // Method 2: ?component (fallback)
              module = await import(`../assets/${type}.svg?component`);
            } catch {
              try {
                // Method 3: default import
                module = await import(`../assets/${type}.svg`);
              } catch {
                throw new Error(`Could not import ${type}.svg with any method`);
              }
            }
          }

          // Extract the React component from the module
          const Component = module.ReactComponent || module.default || module;
          if (typeof Component === 'function') {
            setDynamicSvg(() => Component);
          } else {
            setLoadError(true);
            setDynamicSvg(null);
          }
        } catch {
          // SVG failed to load, trying PNG fallback
          setLoadError(true);
          setDynamicSvg(null);

          // Try PNG fallback
          try {
            const pngModule = await import(`../assets/${type}.png`);
            setPngFallback(pngModule.default);
          } catch {
            // PNG fallback also failed to load
            setPngFallback(null);
          }
        }
      };
      importSvg();
    } else {
      setDynamicSvg(null);
      setLoadError(false);
      setPngFallback(null);
    }
  }, [type, isValidType, external]);

  if (DynamicSvg && external) {
    return (
      <DynamicSvg
        onClick={onClick}
        className={`${className} ${
          active && defaultStyle ? "text-theme-blue-coral" : "text-inherit"
        } md:cursor-pointer fill-current`}
        aria-hidden="true"
      />
    );
  }

  // If SVG failed but PNG fallback is available
  if (external && pngFallback) {
    // Set specific dimensions for crown-admin PNG fallback
    const pngStyle = {
      filter: active && defaultStyle ? 'brightness(1.2) contrast(1.1)' : undefined,
      ...(type === "crown-admin" ? { width: '8px', height: '8px' } : {})
    };

    return (
      <img
        src={pngFallback}
        alt={`${type} icon`}
        onClick={onClick}
        className={`${className} md:cursor-pointer ${
          active && defaultStyle ? "opacity-80" : ""
        }`}
        aria-hidden="true"
        style={pngStyle}
      />
    );
  }

  // If external SVG failed to load, try to use built-in fallback
  if (external && loadError && !pngFallback) {
    // Try to map external names to built-in equivalents
    const builtInFallback = type === "crown-admin" ? "crown" :
                           type === "wrench-mod" ? "wrench" :
                           type === "check_managed_subthread" ? "check_managed_subthread" :
                           type;

    if (svgTypes[builtInFallback]) {
      // Apply specific theme colors for fallback icons
      let themeColorClass = "";
      let hoverColorClass = "";

      if (type === "crown-admin") {
        themeColorClass = "text-theme-yellow-crown";
        hoverColorClass = ""; // No hover effects - static gold color
      } else if (type === "wrench-mod") {
        themeColorClass = "text-theme-wine-wrench";
        hoverColorClass = ""; // No hover effects - static wine color
      } else if (type === "check_managed_subthread") {
        // Use default navbar button style (like saved post button)
        themeColorClass = active && defaultStyle ? "text-theme-blue-coral" : "text-inherit";
        hoverColorClass = ""; // No hover effects
      } else {
        // Default fallback styling
        themeColorClass = active && (defaultStyle ? "text-theme-blue-coral" : "text-theme-link");
        hoverColorClass = ""; // No hover effects
      }

      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          onClick={onClick}
          className={`${className} ${themeColorClass} md:cursor-pointer fill-current ${hoverColorClass}`}
          aria-hidden="true"
          title={`Fallback: ${builtInFallback}`}
        >
          {svgTypes[builtInFallback]}
        </svg>
      );
    } else {
      // No fallback available, render a placeholder
      return (
        <div
          onClick={onClick}
          className={`${className} ${
            active && defaultStyle ? "text-theme-blue-coral" : "text-inherit"
          } md:cursor-pointer flex items-center justify-center border border-dashed border-theme-text-muted`}
          title={`Icon not found: ${type}`}
          aria-hidden="true"
        >
          <span className="text-xs">?</span>
        </div>
      );
    }
  }

  if (!isValidType) {
    // Render null or fallback for invalid type prop
    return null;
  }

  // Special case for coin SVG which has a different viewBox
  const viewBox = type === "coin" ? "0 0 1024 1024" : "0 0 24 24";
  
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      onClick={onClick}
      className={`${className} ${
        active && (defaultStyle ? "text-theme-blue-coral" : "text-theme-link")
      } md:cursor-pointer fill-current text-inherit`}
      aria-hidden="true"
    >
      {svgTypes[type]}
    </svg>
  );
}

export default Svg;
