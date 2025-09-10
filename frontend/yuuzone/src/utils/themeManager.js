// Theme Manager for applying custom themes
class ThemeManager {
  constructor() {
    this.currentTheme = null;
    this.styleElement = null;
    this.init();
  }

  init() {
    // Create a style element for custom theme CSS variables
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'custom-theme-styles';
    document.head.appendChild(this.styleElement);
  }

  // Apply a custom theme as a third mode
  applyCustomTheme(themeData) {
    if (!themeData || !this.styleElement) return;

    this.currentTheme = themeData;
    
    // Remove dark mode class to ensure custom theme takes precedence
    document.documentElement.classList.remove('dark');
    
    // Generate CSS variables from theme data
    const cssVariables = Object.entries(themeData)
      .map(([key, value]) => `--${key}: ${value};`)
      .join('\n  ');

    // Create CSS with custom properties that override both light and dark mode
    const css = `
      :root {
        ${cssVariables}
      }
      
      /* Ensure custom theme overrides dark mode styles */
      .dark {
        ${cssVariables}
      }
    `;

    this.styleElement.textContent = css;
  }

  // Remove custom theme and return to default light/dark mode
  removeCustomTheme() {
    if (this.styleElement) {
      this.styleElement.textContent = '';
    }
    this.currentTheme = null;
  }

  // Get current theme data
  getCurrentTheme() {
    return this.currentTheme;
  }

  // Check if a custom theme is active
  isCustomThemeActive() {
    return this.currentTheme !== null;
  }

  // Preview a theme without applying it permanently
  previewTheme(themeData) {
    if (!themeData || !this.styleElement) return;

    const cssVariables = Object.entries(themeData)
      .map(([key, value]) => `--${key}: ${value};`)
      .join('\n  ');

    const css = `
      :root {
        ${cssVariables}
      }
      
      .dark {
        ${cssVariables}
      }
    `;

    this.styleElement.textContent = css;
  }

  // Restore the current theme after preview
  restoreCurrentTheme() {
    if (this.currentTheme) {
      this.applyCustomTheme(this.currentTheme);
    } else {
      this.removeCustomTheme();
    }
  }
}

// Create a singleton instance
const themeManager = new ThemeManager();

export default themeManager; 