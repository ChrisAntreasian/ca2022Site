const domainsUsingPath = new Set(["betterlesson.com"]);

export const getDisplayLinkText = (rawUrl?: string | null) => {
  if (!rawUrl) {
    return "";
  }

  try {
    const url = new URL(rawUrl);
    const parts = url.hostname.split(".");
    const domain =
      parts.length >= 2
        ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
        : url.hostname;

    return domainsUsingPath.has(domain) ? `${domain}${url.pathname}` : domain;
  } catch {
    return rawUrl;
  }
};