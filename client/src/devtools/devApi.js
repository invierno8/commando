/* ================================================================== */
/* LEGO BLOCK — every dev-mode/admin HTTP call in one place, separate   */
/* from api-client/ (which is the real app's data) since none of this   */
/* is real app functionality — it's the dev/QA tooling layer.           */
/* ================================================================== */

import { http, setDevToken, setAdminToken } from "../api-client/http.js";

export async function devLogin(password) {
  const res = await http.post(`/dev/login`, { password });
  setDevToken(res.token);
  if (res.isAdmin) setAdminToken(res.adminToken);
  return res;
}
export async function devLogout() {
  await http.post(`/dev/logout`);
  setDevToken(null);
  setAdminToken(null);
  return true;
}
export async function fetchDevMe() {
  return http.get(`/dev/me`);
}

export async function fetchDataMode() {
  return http.get(`/dev/data-mode`);
}
export async function setDataMode(mode) {
  return http.post(`/dev/data-mode`, { mode });
}

export async function submitAnnotation(data) {
  return http.post(`/dev/annotations`, data);
}
// כל משתמש-פיתוח מחובר (לא רק מנהל) — כל ההערות (כולל שטופלו) על מסך נתון,
// עבור CommentsPanel.jsx.
export async function fetchDevAnnotations(route) {
  return http.get(`/dev/annotations?route=${encodeURIComponent(route)}`);
}
export async function replyToAnnotation(id, text) {
  return http.post(`/dev/annotations/${id}/reply`, { text });
}

// משוב על Jynx עצמו — תור נפרד לגמרי, מנהל בלבד (ראו data/routes/jynx-feedback.js).
export async function submitJynxFeedback(data) {
  return http.post(`/admin/jynx-feedback`, data);
}
export async function fetchJynxFeedback() {
  return http.get(`/admin/jynx-feedback`);
}
export async function resolveJynxFeedback(id, resolved, resolutionNote) {
  return http.patch(`/admin/jynx-feedback/${id}`, { resolved, resolutionNote });
}
export async function replyToJynxFeedback(id, text) {
  return http.post(`/admin/jynx-feedback/${id}/reply`, { text });
}
export async function exportJynxFeedbackMarkdown() {
  return http.getText(`/admin/jynx-feedback/export`);
}

export async function adminVerify(secret) {
  const res = await http.post(`/admin/verify`, { secret });
  setAdminToken(res.token);
  return res;
}
export async function fetchAdminMe() {
  return http.get(`/admin/me`);
}
export async function adminLogout() {
  await http.post(`/admin/logout`);
  setAdminToken(null);
  return true;
}

export async function fetchDevUsers() {
  return http.get(`/admin/dev-users`);
}
export async function createDevUser(data) {
  return http.post(`/admin/dev-users`, data);
}
export async function updateDevUser(id, patch) {
  return http.patch(`/admin/dev-users/${id}`, patch);
}
export async function deleteDevUser(id) {
  await http.delete(`/admin/dev-users/${id}`);
  return true;
}

export async function fetchAnnotations() {
  return http.get(`/admin/annotations`);
}
export async function resolveAnnotation(id, resolved, resolvedBy, resolutionNote) {
  return http.patch(`/admin/annotations/${id}`, { resolved, resolvedBy, resolutionNote });
}
export async function archiveAnnotation(id, archived) {
  return http.patch(`/admin/annotations/${id}`, { archived });
}
export async function requestAnnotationAction(id, requestedBy) {
  return http.post(`/admin/annotations/${id}/action`, { requestedBy });
}
export async function exportAnnotationsMarkdown() {
  return http.getText(`/admin/annotations/export`);
}
