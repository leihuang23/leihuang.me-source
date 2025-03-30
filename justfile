# Default parameters
default_message := "update content"
public_dir := "public"

# Start development server
dev:
    printf "\e[1;36mStarting Hugo development server...\e[0m\n"
    hugo server -D

# Build the site with Hugo
build:
    printf "\e[1;33m🔨 Building site with Hugo...\e[0m\n"
    hugo

# Commit changes to public repository
commit-public message=default_message: build
    cd {{public_dir}} && \
    printf "\e[1;36m📦 Committing public repository with message: {{message}}\e[0m\n" && \
    git add . && \
    git commit -m "{{message}}" && \
    git push origin

# Commit changes to main repository
commit-main message=default_message: commit-public
    printf "\e[1;36m📦 Committing main repository with message: {{message}}\e[0m\n" && \
    git add . && \
    git commit -m "{{message}}" && \
    git push origin

# Build site, commit and push changes to both repositories
# Usage: just commit "your commit message"
commit message=default_message: commit-main
    printf "\e[1;32m✅ All changes committed and pushed successfully!\e[0m\n"