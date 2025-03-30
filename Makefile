.PHONY: dev commit

dev:
	hugo server -D

commit:
	@if [ -n "$(m)" ]; then \
		MSG="$(m)"; \
	else \
		MSG="update content"; \
	fi; \
	echo "Building site with Hugo..."; \
	hugo; \
	cd public && \
	echo "Committing public repository with message: $$MSG"; \
	git add .; \
	git commit -m "$$MSG"; \
	git push origin; \
	cd .. && \
	echo "Committing main repository with message: $$MSG"; \
	git add .; \
	git commit -m "$$MSG"; \
	git push origin; \
	echo "All changes committed and pushed successfully."