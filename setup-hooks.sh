#!/bin/bash
#
# Setup script for Git hooks
# Run this once after cloning the repository
#

echo "Setting up Git hooks..."

# Get the root of the git repository
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$REPO_ROOT" ]; then
    echo "Error: Not inside a Git repository."
    exit 1
fi

cd "$REPO_ROOT"

# Configure Git to use the .githooks directory
git config core.hooksPath .githooks

# Make hooks executable
chmod +x .githooks/*

echo ""
echo "Git hooks configured successfully!"
echo ""
echo "The following hooks are now active:"
ls -1 .githooks/
echo ""
echo "Pre-commit hook will run security_check.sh before each commit."
