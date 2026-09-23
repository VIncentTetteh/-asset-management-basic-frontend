#!/usr/bin/env bash
#
# Publish the static export to S3 + CloudFront.
#
# Why this is a script and not two `aws s3 sync` calls
# ----------------------------------------------------
# A naive `aws s3 sync out/ s3://bucket --delete --cache-control max-age=300`
# breaks every browser that already has the site open, and it broke staging:
#
#   * `--delete` removes the PREVIOUS build's hashed chunks the moment the new
#     build lands. Any tab still running the old HTML then asks for a chunk that
#     no longer exists and gets a 403/404, which the app can only report as
#     "This page couldn't load". Reloading fixes it, because the reload fetches
#     the new HTML — which is exactly the symptom users described.
#   * One `--cache-control` for everything is wrong in both directions: HTML is
#     cached for minutes (so the fix is delayed) while immutable, content-hashed
#     assets are needlessly re-fetched.
#
# So: hashed assets are uploaded first, cached forever, and NEVER deleted as
# part of a deploy; HTML is uploaded second and always revalidated. Old chunks
# are cheap — a few MB of unreferenced JS costs far less than a broken session.
# Prune them separately, well after a deploy has settled (see PRUNE below).
set -euo pipefail

BUCKET="${WEB_BUCKET:?set WEB_BUCKET}"
DISTRIBUTION="${WEB_DISTRIBUTION:?set WEB_DISTRIBUTION}"
PROFILE="${AWS_PROFILE_NAME:-assetiq}"
REGION="${AWS_REGION_NAME:-eu-central-1}"
OUT="${1:-out}"

[ -d "$OUT" ] || { echo "no build directory at $OUT — run 'npm run build' first" >&2; exit 1; }
[ -f "$OUT/index.html" ] || { echo "$OUT has no index.html; is it a finished export?" >&2; exit 1; }

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

echo "==> 1/3 immutable assets (no --delete: old chunks must outlive the deploy)"
aws_ s3 sync "$OUT/_next/" "s3://$BUCKET/_next/" \
  --cache-control "public,max-age=31536000,immutable"

echo "==> 2/3 html and everything else (always revalidated)"
aws_ s3 sync "$OUT/" "s3://$BUCKET/" --exclude "_next/*" \
  --cache-control "public,max-age=0,must-revalidate"

# Only the always-revalidated objects need purging; the hashed ones are
# content-addressed, so a new build means a new path.
echo "==> 3/3 invalidating html"
ID=$(aws_ cloudfront create-invalidation --distribution-id "$DISTRIBUTION" \
      --paths '/' '/*.html' '/*.txt' '/*.json' --query 'Invalidation.Id' --output text)
echo "    invalidation $ID"

cat <<'PRUNE'

Done. To prune unreferenced chunks from previous builds, run this only when no
older build can still be in use — hours after a deploy, not minutes:

  aws s3 sync out/_next/ s3://$WEB_BUCKET/_next/ --delete \
    --cache-control "public,max-age=31536000,immutable"
PRUNE
