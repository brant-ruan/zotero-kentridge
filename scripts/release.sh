#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: scripts/release.sh <version>"
  echo "Example: scripts/release.sh 0.0.2"
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: version must be semantic-like (e.g. 0.0.2 or 0.0.2-beta.1)"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree is not clean. Commit or stash changes first."
  exit 1
fi

TAG="v${VERSION}"

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "Error: tag ${TAG} already exists locally."
  exit 1
fi

if git ls-remote --tags origin | grep -q "refs/tags/${TAG}$"; then
  echo "Error: tag ${TAG} already exists on origin."
  exit 1
fi

echo "==> Updating version to ${VERSION}"
npm version "${VERSION}" --no-git-tag-version
npm install --package-lock-only

echo "==> Running checks and build"
npm run lint:check
npm run build

echo "==> Creating commit and tag ${TAG}"
git add package.json package-lock.json
git commit -m "release: ${TAG}"
git tag -a "${TAG}" -m "Release ${TAG}"

echo "==> Pushing main and ${TAG}"
git push origin main
git push origin "${TAG}"

echo "Done. GitHub Release workflow should now run for ${TAG}."
