#!/bin/bash

# Sync script to copy anus-private to anus-public (excluding .local files)
# Usage: ./scripts/sync-to-public.sh "commit message"

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PRIVATE_REPO_PATH="/Users/eugeneshilov/Dropbox/5-code/2-startups/anus-project/anus-private"
PUBLIC_REPO_PATH="/Users/eugeneshilov/Dropbox/5-code/2-startups/anus-project/anus-public"

# Check if commit message is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide a commit message${NC}"
    echo "Usage: ./scripts/sync-to-public.sh \"your commit message\""
    exit 1
fi

COMMIT_MESSAGE="$1"

echo -e "${YELLOW}🔄 Starting sync from anus-private to anus-public...${NC}"

# Check if we're in the right directory
if [ ! -d "$PRIVATE_REPO_PATH" ]; then
    echo -e "${RED}Error: Private repo not found at $PRIVATE_REPO_PATH${NC}"
    exit 1
fi

# Check if public repo exists, if not, create it
if [ ! -d "$PUBLIC_REPO_PATH" ]; then
    echo -e "${YELLOW}📁 Creating public repo directory...${NC}"
    mkdir -p "$PUBLIC_REPO_PATH"
    cd "$PUBLIC_REPO_PATH"
    git init
    echo -e "${GREEN}✅ Created new git repository at $PUBLIC_REPO_PATH${NC}"
fi

# Go to private repo
cd "$PRIVATE_REPO_PATH"

echo -e "${YELLOW}📋 Copying files (excluding .git and .local/)...${NC}"

# Copy everything except .git and .local/ folder
rsync -av \
    --exclude='.git/' \
    --exclude='.local/' \
    --exclude='node_modules/' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --delete \
    . "$PUBLIC_REPO_PATH/"

echo -e "${GREEN}✅ Files copied successfully${NC}"

# Go to public repo and commit
cd "$PUBLIC_REPO_PATH"

# Add all files
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo -e "${YELLOW}ℹ️  No changes to commit${NC}"
else
    # Commit changes
    git commit -m "$COMMIT_MESSAGE"
    echo -e "${GREEN}✅ Committed with message: \"$COMMIT_MESSAGE\"${NC}"
fi

echo -e "${GREEN}🎉 Sync completed successfully!${NC}"
echo -e "${YELLOW}📍 Public repo is ready at: $PUBLIC_REPO_PATH${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. cd $PUBLIC_REPO_PATH"
echo "2. git remote add origin https://github.com/nikmcfly/anus-public.git"
echo "3. git push -u origin main"
