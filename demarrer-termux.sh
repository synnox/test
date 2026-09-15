#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# SN Streaming - Installation + lancement automatique (Termux)
# Usage : bash demarrer-termux.sh
# ============================================================
set -e

cd "$(dirname "$0")"

echo "=================================================="
echo "   SN Streaming - Installation automatique Termux"
echo "=================================================="
echo

# 1) Stockage
if [ ! -d "$HOME/storage" ]; then
  echo "[1/5] Configuration de l'accès au stockage..."
  termux-setup-storage
  sleep 2
else
  echo "[1/5] Accès au stockage déjà configuré."
fi

# 2) Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[2/5] Installation de Node.js..."
  pkg update -y
  pkg install nodejs -y
else
  echo "[2/5] Node.js déjà installé ($(node -v))."
fi

if ! node -v >/dev/null 2>&1; then
  echo "      -> node est cassé, réparation (openssl + réinstallation)..."
  pkg install openssl -y
  pkg uninstall nodejs -y || true
  pkg install nodejs -y
fi

# 3) cloudflared
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[3/5] Installation de cloudflared (tunnel public)..."
  pkg install cloudflared -y || echo "      -> échec, le script utilisera localtunnel en repli."
else
  echo "[3/5] cloudflared déjà installé."
fi

# 4) Anti-veille : empêche Android de couper le CPU/réseau quand l'écran s'éteint
echo "[4/5] Activation du wake-lock (empêche la mise en veille du script)..."
termux-wake-lock
trap 'echo; echo "[stop] Libération du wake-lock..."; termux-wake-unlock' EXIT INT TERM

# 5) Lancement
echo "[5/5] Démarrage du serveur local + tunnel public..."
echo
node public.js
