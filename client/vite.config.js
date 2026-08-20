import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/commando/",
  server: {
    // מפנה בקשות /api בפיתוח לשרת ה-Express המקומי (data/) — כך שהלקוח
    // וה-API נראים "אותו origin" מבחינת הדפדפן, ועוגיות סשן (dev/admin)
    // עובדות בלי שום הגדרת CORS. בפרודקשן, VITE_API_BASE_URL מפנה ישירות
    // לאתר האמיתי של data/ (ראו http.js).
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
