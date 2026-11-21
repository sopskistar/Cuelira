import type { PermissionCheckHandlerHandlerDetails, PermissionRequest, MediaAccessPermissionRequest } from "electron";

export function allowCameraCheck(trustedWindow: boolean, permission: string, consent: boolean,
  entryUrl: string, details: PermissionCheckHandlerHandlerDetails) {
  return trustedWindow && permission === "media" && consent &&
    // Preserve the previous permission-check narrowing correction.
    "mediaType" in details && details.mediaType === "video" &&
    details.isMainFrame && details.requestingUrl === entryUrl;
}

export function allowCameraRequest(trustedWindow: boolean, permission: string, consent: boolean,
  entryUrl: string, details: PermissionRequest | MediaAccessPermissionRequest) {
  const types = ("mediaTypes" in details ? details.mediaTypes : []) ?? [];
  return trustedWindow && permission === "media" && consent &&
    details.isMainFrame && details.requestingUrl === entryUrl &&
    types.length === 1 && types[0] === "video";
}
