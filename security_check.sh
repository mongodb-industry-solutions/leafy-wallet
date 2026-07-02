#!/bin/bash

# Security Check Script
# Detects MongoDB connection strings with embedded credentials and API keys/secrets
# Usage: ./security_check.sh [--verbose]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verbose mode flag
VERBOSE=false
if [[ "$1" == "--verbose" ]] || [[ "$1" == "-v" ]]; then
    VERBOSE=true
fi

# Track if any issues are found
ISSUES_FOUND=0
GITIGNORE_ISSUES=0
KINGFISHER_ISSUES=0

echo -e "${YELLOW}🔒 Running security check for credentials and API keys...${NC}\n"

# Function to check .gitignore for essential entries
check_gitignore() {
    local gitignore_file=".gitignore"
    local essential_entries=(
        ".env"
        ".venv"
        "env/"
        "venv/"
        "ENV/"
        "env.bak/"
        "venv.bak/"
    )
    
    if [ ! -f "$gitignore_file" ]; then
        echo -e "${RED}❌ .gitignore file not found!${NC}"
        echo -e "   ${YELLOW}⚠️  Creating a .gitignore file is essential for security.${NC}\n"
        GITIGNORE_ISSUES=1
        return
    fi
    
    local missing_entries=()
    local commented_entries=()
    
    for entry in "${essential_entries[@]}"; do
        # Escape dots for regex (but keep / as-is since it's not special in grep -E)
        local escaped_entry=$(echo "$entry" | sed 's/\./\\./g')
        
        # Check if entry exists as active (not commented, may have optional leading/trailing whitespace)
        # Pattern: optional whitespace, entry, optional whitespace, end of line
        if grep -qE "^\s*${escaped_entry}\s*$" "$gitignore_file" 2>/dev/null; then
            # Entry exists and is active, skip
            continue
        fi
        
        # Check if it's commented out (with optional whitespace before #)
        # Pattern: optional whitespace, #, optional whitespace, entry, optional whitespace, end of line
        if grep -qE "^\s*#\s*${escaped_entry}\s*$" "$gitignore_file" 2>/dev/null; then
            commented_entries+=("$entry")
        else
            missing_entries+=("$entry")
        fi
    done
    
    if [ ${#missing_entries[@]} -gt 0 ] || [ ${#commented_entries[@]} -gt 0 ]; then
        GITIGNORE_ISSUES=1
        echo -e "${RED}❌ .gitignore security issues found:${NC}"
        
        if [ ${#missing_entries[@]} -gt 0 ]; then
            echo -e "   ${YELLOW}Missing entries:${NC}"
            for entry in "${missing_entries[@]}"; do
                echo -e "     - ${RED}$entry${NC}"
            done
        fi
        
        if [ ${#commented_entries[@]} -gt 0 ]; then
            echo -e "   ${YELLOW}Commented out entries (should be active):${NC}"
            for entry in "${commented_entries[@]}"; do
                echo -e "     - ${RED}$entry${NC} (currently commented)"
            done
        fi
        
        echo -e "\n   ${YELLOW}⚠️  These entries are essential to prevent committing sensitive files.${NC}"
        echo -e "   ${YELLOW}⚠️  Please add or uncomment them in your .gitignore file.${NC}\n"
    else
        if [ "$VERBOSE" = true ]; then
            echo -e "${GREEN}✅ .gitignore check passed - all essential entries are present and active${NC}\n"
        fi
    fi
}

# Function to check if Kingfisher is installed
check_kingfisher_installed() {
    if ! command -v kingfisher &> /dev/null; then
        KINGFISHER_ISSUES=1
        echo -e "${RED}❌ Kingfisher is not installed!${NC}"
        echo -e "   ${YELLOW}⚠️  Kingfisher is required for comprehensive credential scanning (including git history).${NC}"
        echo -e "\n   ${YELLOW}To install Kingfisher on macOS:${NC}"
        echo -e "   ${GREEN}   brew install kingfisher${NC}\n"
        return 1
    fi
    return 0
}

# Function to run Kingfisher scan
run_kingfisher_scan() {
    if ! check_kingfisher_installed; then
        return 1
    fi
    
    echo -e "${YELLOW}🔍 Running Kingfisher scan (checking git history and current files)...${NC}"
    
    # Run Kingfisher scan on current directory, excluding node_modules and other common false positive dirs
    # Capture both stdout and stderr
    local kingfisher_output
    local kingfisher_exit_code
    
    # Ensure we're inside a git repo before relying on git ls-files
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        KINGFISHER_ISSUES=1
        echo -e "${RED}❌ Not inside a Git repository — cannot determine tracked files for Kingfisher scan.${NC}"
        echo -e "   ${YELLOW}⚠️  Initialize a Git repo (git init) or run this script from within one.${NC}\n"
        return 1
    fi

    # Only scan git-tracked files so .gitignore is automatically respected
    # Use --git-history none since we're passing individual files
    if [ -z "$(git ls-files 2>/dev/null)" ]; then
        echo -e "${GREEN}✅ No tracked files to scan with Kingfisher${NC}"
        echo ""
        return 0
    fi

    # Run kingfisher on only git-tracked files, using NUL-delimited paths
    # to handle filenames with spaces/special chars, and -- to prevent
    # filenames starting with - from being interpreted as options
    if kingfisher_output=$(git ls-files -z 2>/dev/null | xargs -0 kingfisher scan --git-history none -- 2>&1); then
        kingfisher_exit_code=0
    else
        kingfisher_exit_code=$?
    fi
    
    # Check if Kingfisher found any issues
    # Kingfisher typically exits with non-zero if issues are found
    # Also check for common indicators of found secrets in output
    if [ $kingfisher_exit_code -ne 0 ]; then
        KINGFISHER_ISSUES=1
        ISSUES_FOUND=1
        echo -e "${RED}❌ Kingfisher found potential credential leaks!${NC}"
        echo -e "${YELLOW}Kingfisher output:${NC}"
        echo "$kingfisher_output" | sed 's/^/   /'
        echo ""
        return 1
    fi
    
    # Check output for indicators of found secrets (more specific patterns)
    if echo "$kingfisher_output" | grep -qiE "(leaked|exposed|found.*secret|found.*credential|found.*key|vulnerability)" 2>/dev/null; then
        KINGFISHER_ISSUES=1
        ISSUES_FOUND=1
        echo -e "${RED}❌ Kingfisher found potential credential leaks!${NC}"
        echo -e "${YELLOW}Kingfisher output:${NC}"
        echo "$kingfisher_output" | sed 's/^/   /'
        echo ""
        return 1
    else
        if [ "$VERBOSE" = true ]; then
            echo -e "${GREEN}✅ Kingfisher scan passed - no credential leaks detected${NC}"
            if [ -n "$kingfisher_output" ]; then
                echo -e "${YELLOW}Kingfisher output:${NC}"
                echo "$kingfisher_output" | sed 's/^/   /'
            fi
        else
            echo -e "${GREEN}✅ Kingfisher scan passed${NC}"
        fi
        echo ""
        return 0
    fi
}

# Check .gitignore first
check_gitignore

# Get the script's own path to exclude it
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
SCRIPT_RELATIVE="$(basename "$0")"

# Regex pattern 1: MongoDB URIs with username:password
MONGODB_PATTERN='(mongodb(\+srv)?://[^:]+:[^@]+@)'

# Regex pattern 2: API keys and secrets
# Matches: KEY="value" or KEY=value (non-empty value, at least 4 characters to avoid false positives)
# Pattern 2a: Variables ending with _API_KEY, _SECRET, etc.
# Matches: VAR_API_KEY="value" or VAR_API_KEY=value (value at least 4 chars, allows -_ and other chars)
# Handles both quoted and unquoted values
API_KEY_PATTERN_A='([A-Z_]+(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|ACCESS_KEY|SECRET_KEY|AUTH_TOKEN|SESSION_KEY)\s*=\s*(["\x27][^"\x27]{4,}["\x27]|[^"\x27\s\n]{4,}))'
# Pattern 2b: Standalone KEY=, SECRET=, PASSWORD=, TOKEN= (as whole words, not part of another word)
API_KEY_PATTERN_B='\b(KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|ACCESS_KEY|SECRET_KEY|AUTH_TOKEN|SESSION_KEY)\s*=\s*(["\x27][^"\x27]{4,}["\x27]|[^"\x27\s\n]{4,})'
# Combine both API key patterns
API_KEY_PATTERN="($API_KEY_PATTERN_A|$API_KEY_PATTERN_B)"

# Combine patterns with OR
COMBINED_PATTERN="($MONGODB_PATTERN|$API_KEY_PATTERN)"

# Find all files matching either pattern (excluding common directories)
ALL_MATCHING_FILES=$(grep -r -l -E "$COMBINED_PATTERN" \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=__pycache__ \
    --exclude-dir=.venv \
    --exclude-dir=venv \
    --exclude="*.pyc" \
    --exclude="*.lock" \
    --exclude="*.log" \
    . 2>/dev/null || true)

# Note: We don't exit early here even if no files match, because we still need to run Kingfisher scan

# Filter files: only check files that are tracked by git and not ignored
FILES_WITH_ISSUES=""
while IFS= read -r file; do
    # Skip if file doesn't exist
    [ ! -f "$file" ] && continue
    
    # Skip the script itself
    if [[ "$file" == *"$SCRIPT_RELATIVE" ]] || [[ "$file" == "$SCRIPT_PATH" ]]; then
        continue
    fi
    
    # Check if file is ignored by git (.gitignore)
    if git check-ignore -q "$file" 2>/dev/null; then
        # File is ignored, skip it (e.g., .env files, knowledge_base_kanopy/)
        continue
    fi
    
    # Check if file is tracked by git (already committed) or staged for commit
    # Only report on files that are actually in version control or would be committed
    if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
        # File is tracked, include it
        if [ -z "$FILES_WITH_ISSUES" ]; then
            FILES_WITH_ISSUES="$file"
        else
            FILES_WITH_ISSUES="$FILES_WITH_ISSUES"$'\n'"$file"
        fi
    elif git diff --cached --name-only --diff-filter=A | grep -q "^$file$" 2>/dev/null; then
        # File is staged for commit (new file), include it
        if [ -z "$FILES_WITH_ISSUES" ]; then
            FILES_WITH_ISSUES="$file"
        else
            FILES_WITH_ISSUES="$FILES_WITH_ISSUES"$'\n'"$file"
        fi
    fi
done <<< "$ALL_MATCHING_FILES"

# Process each file with issues (if any)
if [ -n "$FILES_WITH_ISSUES" ]; then
    while IFS= read -r file; do
    # Skip if file doesn't exist (can happen with grep)
    [ ! -f "$file" ] && continue
    
    ISSUES_FOUND=1
    
    echo -e "${RED}❌ SECURITY ISSUE FOUND:${NC}"
    echo -e "   File: ${YELLOW}$file${NC}"
    
    if [ "$VERBOSE" = true ]; then
        echo -e "   Matches:"
        # Show MongoDB URI matches (masked)
        grep -n -E "$MONGODB_PATTERN" "$file" 2>/dev/null | while IFS=: read -r line_num line_content; do
            # Mask the password part for display
            masked_line=$(echo "$line_content" | sed -E 's/(mongodb(\+srv)?:\/\/[^:]+:)[^@]+(@)/\1****\2/')
            echo -e "   ${RED}Line $line_num (MongoDB URI):${NC} $masked_line"
        done
        # Show API key matches (masked)
        grep -n -E "$API_KEY_PATTERN" "$file" 2>/dev/null | while IFS=: read -r line_num line_content; do
            # Mask the value part for display - handle both patterns
            # First try pattern A (variables ending with _KEY, etc.) - handles quoted and unquoted
            masked_line=$(echo "$line_content" | sed -E 's/([A-Z_]+(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|ACCESS_KEY|SECRET_KEY|AUTH_TOKEN|SESSION_KEY)\s*=\s*)(["\x27][^"\x27]{4,}["\x27]|[^"\x27\s\n]{4,})/\1****/')
            # If no match, try pattern B (standalone KEY=, etc.) - handles quoted and unquoted
            if [[ "$masked_line" == "$line_content" ]]; then
                masked_line=$(echo "$line_content" | sed -E 's/(\b(KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|ACCESS_KEY|SECRET_KEY|AUTH_TOKEN|SESSION_KEY)\s*=\s*)(["\x27][^"\x27]{4,}["\x27]|[^"\x27\s\n]{4,})/\1****/')
            fi
            echo -e "   ${RED}Line $line_num (API Key/Secret):${NC} $masked_line"
        done
    else
        # Count occurrences
        mongodb_count=$(grep -c -E "$MONGODB_PATTERN" "$file" 2>/dev/null || echo "0")
        api_key_count=$(grep -c -E "$API_KEY_PATTERN" "$file" 2>/dev/null || echo "0")
        total_count=$((mongodb_count + api_key_count))
        
        if [ "$mongodb_count" -gt 0 ] && [ "$api_key_count" -gt 0 ]; then
            echo -e "   ${RED}Found $total_count occurrence(s)${NC} (MongoDB: $mongodb_count, API Keys: $api_key_count)"
        elif [ "$mongodb_count" -gt 0 ]; then
            echo -e "   ${RED}Found $mongodb_count MongoDB credential(s)${NC}"
        else
            echo -e "   ${RED}Found $api_key_count API key/secret(s)${NC}"
        fi
        echo -e "   ${YELLOW}Run with --verbose to see details${NC}"
    fi
    echo ""
    done <<< "$FILES_WITH_ISSUES"
else
    # No files with issues found from pattern matching
    if [ "$VERBOSE" = true ]; then
        echo -e "${GREEN}✅ No credentials or API keys found in tracked files (pattern matching)${NC}\n"
    fi
fi

# Run Kingfisher scan (after other checks to provide comprehensive coverage)
run_kingfisher_scan

# Check if we have any issues (credentials, .gitignore, or Kingfisher)
if [ $ISSUES_FOUND -eq 1 ] || [ $GITIGNORE_ISSUES -eq 1 ] || [ $KINGFISHER_ISSUES -eq 1 ]; then
    echo -e "${RED}🚨 SECURITY CHECK FAILED!${NC}"
    
    if [ $ISSUES_FOUND -eq 1 ]; then
        echo -e "${YELLOW}⚠️  Credentials or API keys detected in source files.${NC}"
        echo -e "${YELLOW}⚠️  Please remove credentials and use environment variables instead.${NC}"
    fi
    
    if [ $GITIGNORE_ISSUES -eq 1 ]; then
        if [ $ISSUES_FOUND -eq 1 ] || [ $KINGFISHER_ISSUES -eq 1 ]; then
            echo ""
        fi
        echo -e "${YELLOW}⚠️  .gitignore file is missing essential entries or has them commented out.${NC}"
    fi
    
    if [ $KINGFISHER_ISSUES -eq 1 ]; then
        if [ $ISSUES_FOUND -eq 1 ] || [ $GITIGNORE_ISSUES -eq 1 ]; then
            echo ""
        fi
        if ! command -v kingfisher &> /dev/null; then
            echo -e "${YELLOW}⚠️  Kingfisher is not installed. Install it with: brew install kingfisher${NC}"
        else
            echo -e "${YELLOW}⚠️  Kingfisher detected potential credential leaks in git history or files.${NC}"
        fi
    fi
    
    echo -e "\n${YELLOW}Best practices:${NC}"
    echo -e "  1. Use environment variables: \${MONGODB_URI}, \${VOYAGE_API_KEY}, etc."
    echo -e "  2. Store credentials in .env files (and make sure .env files are added to the .gitignore)"
    echo -e "  3. Never commit API keys, secrets, or passwords to version control"
    echo -e "  4. Ensure .gitignore includes: .env, .venv, env/, venv/, ENV/, env.bak/, venv.bak/"
    if [ $KINGFISHER_ISSUES -eq 1 ] && ! command -v kingfisher &> /dev/null; then
        echo -e "  5. Install Kingfisher for comprehensive scanning: brew install kingfisher"
    else
        echo -e "  5. Run Kingfisher regularly to check git history: kingfisher scan ."
    fi
    echo ""
    exit 1
fi

# All checks passed
if [ "$VERBOSE" = true ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    echo -e "   - Pattern matching: No credentials found in tracked files"
    if command -v kingfisher &> /dev/null; then
        echo -e "   - Kingfisher scan: No credential leaks detected"
    fi
    echo -e "   - .gitignore: All essential entries present"
else
    echo -e "${GREEN}✅ All security checks passed!${NC}"
fi
exit 0

