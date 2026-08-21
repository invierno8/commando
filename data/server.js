/* ================================================================== */
/* HANGAR API — Express entrypoint. Only /api/health is live for now   */
/* (Step 3 of the backend build-out); every other route module gets    */
/* mounted here as it's built in the following steps.                  */
/* ================================================================== */

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { attachDevUser } from "./middleware/auth.js";
import healthRouter from "./routes/health.js";
import blocksRouter from "./routes/blocks.js";
import notificationsRouter from "./routes/notifications.js";
import adminRouter from "./routes/admin.js";
import draftsRouter from "./routes/drafts.js";
import userPrefsRouter from "./routes/user-prefs.js";
import teamsRouter from "./routes/teams.js";
import brigadesRouter from "./routes/brigades.js";
import brigadeDataRouter from "./routes/brigade-data.js";
import devDataModeRouter from "./routes/dev-data-mode.js";
import devAuthRouter from "./routes/dev-auth.js";
import adminAuthRouter from "./routes/admin-auth.js";
import devUsersRouter from "./routes/dev-users.js";
import annotationsRouter, { hydrateAnnotationsFromGithub } from "./routes/annotations.js";
import jynxFeedbackRouter, { hydrateJynxFeedbackFromGithub } from "./routes/jynx-feedback.js";
import { hydrateDevUsersFromGithub } from "./lib/devUsers.js";
import { hydrateMockDataFromGithub } from "./lib/jsonStore.js";

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
// מגבלה נדיבה יחסית — פריטי קטלוג/פרופילי לוגו נושאים תמונות/סרטון מקודדים
// כ-base64 (FileReader, אין עדיין אחסון קבצים אמיתי — ראו FORCLAUDE.md).
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
app.use(attachDevUser);

app.use("/api", healthRouter);
app.use("/api", blocksRouter);
app.use("/api", notificationsRouter);
app.use("/api", adminRouter);
app.use("/api", draftsRouter);
app.use("/api", userPrefsRouter);
app.use("/api", teamsRouter);
app.use("/api", brigadesRouter);
app.use("/api", brigadeDataRouter);
app.use("/api", devDataModeRouter);
app.use("/api", devAuthRouter);
app.use("/api", adminAuthRouter);
app.use("/api", devUsersRouter);
app.use("/api", annotationsRouter);
app.use("/api", jynxFeedbackRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// אם GITHUB_TOKEN מוגדר (ראו lib/githubPersist.js), מרשם משתמשי-הפיתוח
// והערות ה-QA נמשכים בחזרה מ-git לפני שהשרת עונה לבקשות — כי אחסון בענן
// זול (למשל Render free tier) מאפס את הדיסק המקומי בכל spin-down/redeploy,
// אבל git עצמו כמובן לא. ללא GITHUB_TOKEN (פיתוח מקומי) זו פעולה ריקה.
Promise.all([
  hydrateDevUsersFromGithub(),
  hydrateAnnotationsFromGithub(),
  hydrateJynxFeedbackFromGithub(),
  hydrateMockDataFromGithub(),
]).then(() => {
  app.listen(PORT, () => {
    console.log(`HANGAR API listening on http://localhost:${PORT}`);
  });
});
