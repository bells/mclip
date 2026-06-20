import { getVersion } from "@tauri-apps/api/app";

import { DEFAULT_APP_VERSION } from "../constants";

export async function getAppVersion() {
  try {
    return await getVersion();
  } catch (error) {
    console.error("获取应用版本失败:", error);
    return DEFAULT_APP_VERSION;
  }
}
