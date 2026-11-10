export type AIProvider = { id: string; name: string; baseUrl: string; apiKey: string; models: string[] };
const KEY = "wf-ai-providers";
export const loadProviders = (): AIProvider[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
export const saveProviders = (p: AIProvider[]) => localStorage.setItem(KEY, JSON.stringify(p));
export const providerNameFromUrl = (url: string) => {
  try {
    const parts = new URL(url).hostname.split(".").filter((p) => !["api", "www", "com", "ai", "io", "dev", "co", "org", "net"].includes(p));
    return (parts[0] || "PROVEDOR").toUpperCase();
  } catch { return "PROVEDOR"; }
};
