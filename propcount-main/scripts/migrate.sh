#!/bin/sh
set -e

echo "Checking Alembic migrations..."

if ! find alembic/versions -name "*.py" | grep -q .; then
  echo "No migration files found. Generating initial migration..."
  alembic revision --autogenerate -m "init"
fi

echo "Applying Alembic migrations..."
alembic upgrade head

echo "Migrations completed."
