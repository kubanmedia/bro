#!/bin/bash

# Test script to run before publishing to catch common issues

set -e  # Exit on error

echo "🧪 Testing ANUS bundle before publishing..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if bundle exists
echo "1️⃣  Checking if bundle exists..."
if [ ! -f "bundle/anus.js" ]; then
    echo -e "${RED}❌ Bundle not found! Run 'npm run bundle' first${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Bundle found${NC}"
echo ""

# Test 2: Test bundle can run --version
echo "2️⃣  Testing --version command..."
VERSION_OUTPUT=$(node bundle/anus.js --version 2>&1 || true)
if [[ $VERSION_OUTPUT == *"Error"* ]] || [[ $VERSION_OUTPUT == *"Cannot find"* ]]; then
    echo -e "${RED}❌ Bundle failed to run --version:${NC}"
    echo "$VERSION_OUTPUT"
    exit 1
fi
echo -e "${GREEN}✅ Version command works: $VERSION_OUTPUT${NC}"
echo ""

# Test 3: Check for import errors
echo "3️⃣  Checking for import/require errors..."
TEST_OUTPUT=$(GROK_API_KEY=test node bundle/anus.js --help 2>&1 || true)
if [[ $TEST_OUTPUT == *"Cannot find module"* ]] || [[ $TEST_OUTPUT == *"Cannot find package"* ]] || [[ $TEST_OUTPUT == *"ERR_MODULE_NOT_FOUND"* ]]; then
    echo -e "${RED}❌ Module import error detected:${NC}"
    echo "$TEST_OUTPUT" | grep -E "(Cannot find|ERR_MODULE)" | head -5
    echo ""
    echo -e "${YELLOW}Check your esbuild.config.js external dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✅ No import errors detected${NC}"
echo ""

# Test 4: Check for syntax errors
echo "4️⃣  Checking for syntax errors..."
SYNTAX_CHECK=$(node -c bundle/anus.js 2>&1 || true)
if [[ $SYNTAX_CHECK == *"SyntaxError"* ]]; then
    echo -e "${RED}❌ Syntax error in bundle:${NC}"
    echo "$SYNTAX_CHECK"
    exit 1
fi
echo -e "${GREEN}✅ No syntax errors${NC}"
echo ""

# Test 5: Test global install simulation
echo "5️⃣  Testing global install simulation..."
# Create a temporary directory to simulate global install
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy bundle to temp location
cp -r bundle/* "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"

# Test running from temp location
TEST_RUN=$(cd "$TEMP_DIR" && GROK_API_KEY=test node anus.js --help 2>&1 || true)
if [[ $TEST_RUN == *"Error"* ]] && [[ $TEST_RUN != *"Unknown arguments"* ]]; then
    echo -e "${RED}❌ Bundle failed in simulated global install:${NC}"
    echo "$TEST_RUN" | head -10
    exit 1
fi
echo -e "${GREEN}✅ Global install simulation successful${NC}"
echo ""

# Test 6: Check package.json dependencies
echo "6️⃣  Checking if external dependencies are in package.json..."
MISSING_DEPS=""
for dep in eventsource eventsource-parser pkce-challenge fast-uri; do
    if ! grep -q "\"$dep\"" package.json; then
        MISSING_DEPS="$MISSING_DEPS $dep"
    fi
done

if [ -n "$MISSING_DEPS" ]; then
    echo -e "${RED}❌ Missing dependencies in package.json:${NC}$MISSING_DEPS"
    echo -e "${YELLOW}Add these to the dependencies section${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All external dependencies found in package.json${NC}"
echo ""

# Success!
echo -e "${GREEN}🎉 All tests passed! Ready to publish.${NC}"
echo ""
echo "To publish, run:"
echo "  npm publish --access restricted --otp=YOUR_2FA_CODE"