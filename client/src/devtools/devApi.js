/* ================================================================== */
/* LEGO BLOCK — every dev-mode/admin HTTP call in one place, separate   */
/* from api-client/ (which is the real app's data) since none of this   */
/* is real app functionality — it's the dev/QA tooling layer.           */
/* ================================================================== */

import { http } from "../api-client/http.js";

export async function devLogin(password) {
  return http.post(`/dev/login`, { password });
}
export async function devLogout() {
  await http.post(`/dev/logout`);
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

export async function adminVerify(secret) {
  return http.post(`/admin/verify`, { secret });
}
export async function fetchAdminMe() {
  return http.get(`/admin/me`);
}
export async function adminLogout() {
  await http.post(`/admin/logout`);
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
export async function resolveAnnotation(id, resolved, resolvedBy) {
  return http.patch(`/admin/annotations/${id}`, { resolved, resolvedBy });
}
export async function requestAnnotationAction(id, requestedBy) {
  return http.post(`/admin/annotations/${id}/action`, { requestedBy });
}
export async function exportAnnotationsMarkdown() {
  return http.getText(`/admin/annotations/export`);
}
