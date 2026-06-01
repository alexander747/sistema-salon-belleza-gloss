#!/bin/bash
# POS Final — Start all services
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting POS Final..."

# 1. Seed database (create superadmin user if not exists)
echo "📦 Running database seed..."
cd apps/api
npx tsx src/infrastructure/persistence/seed.ts
cd "$SCRIPT_DIR"

# 2. Start API backend
echo "🔧 Starting API on port 3001..."
cd apps/api
npx tsx src/server.ts &
API_PID=$!
cd "$SCRIPT_DIR"

# 3. Start POS Dashboard frontend
echo "🎨 Starting POS Dashboard on port 5174..."
cd apps/pos-dashboard
npx vite --port 5174 --host &
DASH_PID=$!
cd "$SCRIPT_DIR"

# 4. Start Superadmin frontend
echo "🛡️  Starting Superadmin on port 5173..."
cd apps/superadmin
npx vite --port 5173 --host &
SUPER_PID=$!
cd "$SCRIPT_DIR"

echo ""
echo "✅ All services starting..."
echo "   API:         http://localhost:3001"
echo "   Dashboard:   http://localhost:5174"
echo "   Superadmin:  http://localhost:5173"
echo ""
echo "   Superadmin login: eder@gmail.com / Eder123"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for any process to exit
wait
