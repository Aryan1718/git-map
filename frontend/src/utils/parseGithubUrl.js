function stripGitSuffix(value) {
  return value.replace(/\.git$/i, "");
}

function normalizePathParts(value) {
  return value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseGithubUrl(input) {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = stripGitSuffix(input.trim().replace(/\s+/g, ""));
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  candidate = candidate.replace(/^github\.com\//i, "");

  const parts = normalizePathParts(candidate);
  if (parts.length < 2) {
    return null;
  }

  const [owner, repo] = parts;
  if (!owner || !repo) {
    return null;
  }

  const validSegment = /^[A-Za-z0-9_.-]+$/;
  if (!validSegment.test(owner) || !validSegment.test(repo)) {
    return null;
  }

  return {
    owner,
    repo,
    sourceUrl: `https://github.com/${owner}/${repo}`,
    normalizedInput: `${owner}/${repo}`,
  };
}

export default parseGithubUrl;
