/**
 * Web search abstraction layer — supports multiple search providers.
 */

export type SearchProvider = "serper" | "serpapi" | "google_custom" | "bing" | "tavily" | "custom";

export type SearchConfig = {
  provider: SearchProvider;
  apiBaseUrl: string;
  apiKey: string;
  extraParams?: Record<string, string>;
};

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  date?: string;
};

/**
 * Execute a web search using the configured provider.
 */
export async function webSearch(
  query: string,
  config: SearchConfig,
  maxResults: number = 5
): Promise<SearchResult[]> {
  switch (config.provider) {
    case "serper":
      return searchViaSerper(query, config, maxResults);
    case "serpapi":
      return searchViaSerpAPI(query, config, maxResults);
    case "tavily":
      return searchViaTavily(query, config, maxResults);
    case "custom":
      return searchViaCustom(query, config, maxResults);
    default:
      throw new Error(`Unsupported search provider: ${config.provider}`);
  }
}

async function searchViaSerper(
  query: string,
  config: SearchConfig,
  limit: number
): Promise<SearchResult[]> {
  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    headers: {
      "X-API-KEY": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: limit,
      gl: config.extraParams?.gl || "cn",
      hl: config.extraParams?.hl || "zh-cn",
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    organic?: Array<{ title: string; link: string; snippet: string; date?: string }>;
  };

  return (data.organic || []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    date: r.date,
  }));
}

async function searchViaSerpAPI(
  query: string,
  config: SearchConfig,
  limit: number
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    num: String(limit),
    api_key: config.apiKey,
    engine: config.extraParams?.engine || "google",
    ...(config.extraParams || {}),
  });

  const response = await fetch(`${config.apiBaseUrl}?${params}`);

  if (!response.ok) {
    throw new Error(`SerpAPI search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    organic_results?: Array<{ title: string; link: string; snippet: string; date?: string }>;
  };

  return (data.organic_results || []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    date: r.date,
  }));
}

async function searchViaTavily(
  query: string,
  config: SearchConfig,
  limit: number
): Promise<SearchResult[]> {
  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      max_results: limit,
      api_key: config.apiKey,
      search_depth: "basic",
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    results?: Array<{ title: string; url: string; content: string }>;
  };

  return (data.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }));
}

async function searchViaCustom(
  query: string,
  config: SearchConfig,
  limit: number
): Promise<SearchResult[]> {
  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ query, limit, ...config.extraParams }),
  });

  if (!response.ok) {
    throw new Error(`Custom search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    results?: Array<{ title: string; url: string; snippet?: string; date?: string }>;
  };

  return (data.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet || "",
    date: r.date,
  }));
}
