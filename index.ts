import { ImageResponse } from "workers-og";
import og from "./og.html";

interface RepoDetails {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  archived: boolean;
  default_branch: string;
  pushed_at: string | null;
  created_at: string;
  homepage: string | null;
  topics: string[] | null;
  updated_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

async function fetchRepoDetails(
  token: string | undefined,
  owner: string,
  repo: string,
): Promise<{
  status: number;
  statusText?: string;
  message?: string;
  result?: RepoDetails;
}> {
  const headers: { [key: string]: string } = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-og-image",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const url = `https://api.github.com/repos/${owner}/${repo}`;

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    return {
      status: response.status,
      statusText: response.statusText,
      message: await response.text(),
    };
  }

  const data: RepoDetails = await response.json();

  return { result: data, status: response.status };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const response = new Response(og, {
      headers: { "Content-Type": "text/html" },
    });
    const url = new URL(request.url);
    const [_, owner, repo] = url.pathname.split("/");
    const path = url.searchParams.get("path");
    const tokens = url.searchParams.get("tokens");
    if (!owner || !repo) {
      return new Response("Not found", { status: 404 });
    }

    const details = await fetchRepoDetails(undefined, owner, repo);
    if (!details.result) {
      console.log({ details });
      return new Response("Repo not found", { status: 404 });
    }

    console.log(details.result);

    const pathPart = path ? `/${path}` : "";
    const repoData = {
      title: `${owner}/${repo}${pathPart}`,
      description: details.result.description || "",
      avatarUrl: details.result.owner.avatar_url,
      tokens,
      issues: details.result.open_issues_count,
      stars: details.result.stargazers_count,
      forks: details.result.forks_count,
    };

    const rewrite = new HTMLRewriter()
      .on("#title, #description, #tokens, #issues, #stars, #forks", {
        element(el) {
          el.setInnerContent(repoData[el.getAttribute("id")]);
        },
      })
      .on("#avatar", {
        element(el) {
          el.setAttribute("src", repoData.avatarUrl);
        },
      })
      .transform(response);

    const text = await rewrite.text();

    //  return new Response(text, { headers: { "Content-Type": "text/html" } });
    return new ImageResponse(text, {
      // 2x bigger than needed to prevent it being bad quality
      width: 1200,
      height: 630,
      format: "png",
    });
  },
};
