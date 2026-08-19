import React from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ theme, setTheme }) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="מצב תצוגה">
      <button
        type="button"
        className={"theme-toggle-opt" + (theme === "light" ? " active" : "")}
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
      >
        <Sun /> בהיר
      </button>
      <button
        type="button"
        className={"theme-toggle-opt" + (theme === "dark" ? " active" : "")}
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
      >
        <Moon /> כהה
      </button>
    </div>
  );
}
