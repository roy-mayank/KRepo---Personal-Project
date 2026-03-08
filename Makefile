.PHONY: install backend frontend dev typecheck lint format

install:
	cd backend && uv sync --dev
	cd frontend && pnpm install

backend:
	cd backend && uv run uvicorn main:app --reload

frontend:
	cd frontend && pnpm run dev

dev:
	$(MAKE) backend & $(MAKE) frontend

typecheck:
	cd backend && uv run basedpyright .

lint:
	cd backend && uv run pre-commit run --all-files

format:
	cd backend && uv run ruff format . && uv run ruff check --fix .
	cd frontend && npx prettier --write .
