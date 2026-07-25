// Real GitHub releases API helpers for version checking of BeamMP-Server and playit-agent.

export interface GithubRelease {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  assets: GithubAsset[];
}

export interface GithubAsset {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
}

const BEAMMP_REPO = "BeamMP/BeamMP-Server";
// playit-agent is published under playit-cloud/playit-agent on GitHub.
const PLAYIT_REPO = "playit-cloud/playit-agent";

function mapRelease(json: any): GithubRelease {
  return {
    tagName: json.tag_name ?? "",
    name: json.name ?? json.tag_name ?? "",
    publishedAt: json.published_at ?? "",
    htmlUrl: json.html_url ?? "",
    assets: (json.assets ?? []).map((a: any) => ({
      name: a.name ?? "",
      downloadUrl: a.browser_download_url ?? "",
      sizeBytes: a.size ?? 0,
    })),
  };
}

async function fetchLatest(repo: string): Promise<GithubRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return mapRelease(json);
  } catch {
    return null;
  }
}

export async function fetchBeamMPLatestRelease(): Promise<GithubRelease | null> {
  return fetchLatest(BEAMMP_REPO);
}

export async function fetchPlayitLatestRelease(): Promise<GithubRelease | null> {
  return fetchLatest(PLAYIT_REPO);
}

/**
 * Pick the right BeamMP-Server asset for the current OS.
 * Windows: "BeamMP-Server.exe" (sometimes zip'd)
 * Linux: "BeamMP-Server" or "BeamMP-Server-linux" depending on release naming
 */
export function pickBeamMPAsset(release: GithubRelease, platform: "win" | "linux"): GithubAsset | null {
  const want = platform === "win" ? /\.exe$|windows/i : /linux/i;
  // Prefer exact .exe match on Windows
  if (platform === "win") {
    const exe = release.assets.find((a) => /\.exe$/i.test(a.name));
    if (exe) return exe;
  }
  return release.assets.find((a) => want.test(a.name)) ?? null;
}

/**
 * Pick the right playit-agent asset for the current OS.
 */
export function pickPlayitAsset(release: GithubRelease, platform: "win" | "linux"): GithubAsset | null {
  const want = platform === "win" ? /windows|x86_64-pc/ : /linux/i;
  return release.assets.find((a) => want.test(a.name)) ?? release.assets[0] ?? null;
}

export function compareVersions(a: string, b: string): number {
  const norm = (v: string) => v.replace(/^v/i, "").split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const aa = norm(a);
  const bb = norm(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const av = aa[i] ?? 0;
    const bv = bb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
