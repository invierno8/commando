export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "לא נמצא" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "שגיאת שרת" });
}
