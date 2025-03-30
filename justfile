# Default parameters
default_message := "update content"
public_dir := "public"

# Start development server
dev:
    hugo server -D

# Build the site with Hugo
build:
    echo "Building site with Hugo..."
    hugo

# Commit changes to public repository
commit-public message=default_message: build
    cd {{public_dir}} && \
    echo "Committing public repository with message: {{message}}" && \
    git add . && \
    git commit -m "{{message}}" && \
    git push origin

# Commit changes to main repository
commit-main message=default_message: commit-public
    echo "Committing main repository with message: {{message}}" && \
    git add . && \
    git commit -m "{{message}}" && \
    git push origin

# Build site, commit and push changes to both repositories
# Usage: just commit "your commit message"
commit message=default_message: commit-main
    echo "All changes committed and pushed successfully."