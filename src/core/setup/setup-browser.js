import { spawn } from "node:child_process";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function shouldAutoOpenSetup({ env="development", baseUrl, enabled=true, ci=Boolean(process.env.CI) }={}) {
  if (!enabled || ci || env === "test") return false;
  let url;
  try { url = new URL(String(baseUrl)); } catch { return false; }
  return env !== "production" && LOCAL_HOSTS.has(url.hostname);
}

export function openUrlInDefaultBrowser(url, { platform=process.platform, spawnImpl=spawn }={}) {
  const target=String(url);
  let command,args;
  if(platform==="win32") { command="cmd"; args=["/c","start","",target]; }
  else if(platform==="darwin") { command="open"; args=[target]; }
  else { command="xdg-open"; args=[target]; }
  try {
    const child=spawnImpl(command,args,{ detached:true, stdio:"ignore", windowsHide:true });
    child.unref?.();
    return true;
  } catch {
    return false;
  }
}
