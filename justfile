# Get current version from package.json
version := `jq -r .version package.json`

# Show current version
current:
    @echo "{{version}}"

# Bump version, commit, tag, and push to trigger release
release kind="patch":
    #!/usr/bin/env bash
    set -euo pipefail

    current="{{version}}"
    IFS='.' read -r major minor patch <<< "$current"

    case "{{kind}}" in
        major) new="$((major + 1)).0.0" ;;
        minor) new="$major.$((minor + 1)).0" ;;
        patch) new="$major.$minor.$((patch + 1))" ;;
        *)     echo "Usage: just release [major|minor|patch]"; exit 1 ;;
    esac

    echo "Bumping $current → $new"

    # Update all version references
    sed -i '' "s/\"version\": \"$current\"/\"version\": \"$new\"/" package.json manifest.json
    sed -i '' "s/version: \"$current\"/version: \"$new\"/" src/server.ts

    # Commit, tag, push
    git add package.json manifest.json src/server.ts
    git commit -m "chore: bump version to $new"
    git tag "v$new"
    git push origin main "v$new"

    echo "Released v$new — GitHub Actions will build and publish the .mcpb"

# Build everything locally
build:
    bun run build

# Run tests
test:
    bun test

# Lint and typecheck
check:
    bun run lint
    bun run format:check
    bun run typecheck

# Pack the mcpb extension locally
pack: build
    npx @anthropic-ai/mcpb@latest validate manifest.json
    npx @anthropic-ai/mcpb@latest pack . build/mcp-eventkit.mcpb
