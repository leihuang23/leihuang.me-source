dev:
    hugo server -D

# Build site, commit and push changes to both repositories
# Usage: just commit "your commit message"
# Default message: "update content"
commit message="update content":
    echo "Building site with Hugo..."
    hugo
    cd public && \
    echo "Committing public repository with message: {{message}}" && \
    git add . && \
    git commit -m "{{message}}" && \
    git push origin && \
    cd .. && \
    echo "Committing main repository with message: {{message}}" && \
    git add . && \
    git commit -m "{{message}}" && \
    git push origin && \
    echo "All changes committed and pushed successfully."