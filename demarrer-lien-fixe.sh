#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# SN Streaming - Lien public avec nom personnalisé (localtunnel)
# Usage : bash demarrer-lien-fixe.sh [nom-souhaite]
# Exemple : bash demarrer-lien-fixe.sh sn-streaming
#   -> tente https://sn-streaming.loca.lt
#   (si déjà pris par quelqu'un d'autre, un autre nom sera proposé)
# ============================================================
set -e
cd "$(dirname "$0")"

SUBDOMAIN="${1:-sn-streaming}"

echo "=================================================="
echo "   SN Streaming - Lien personnalisé : $SUBDOMAIN.loca.lt"
echo "=================================================="
echo

# Anti-veille
termux-wake-lock
trap 'echo; echo "[stop] Arrêt..."; termux-wake-unlock; kill $SERVER_PID 2>/dev/null || true' EXIT INT TERM

# Démarre le serveur local en arrière-plan
node server.js &
SERVER_PID=$!

# Attend que le serveur local réponde
echo "Attente du serveur local..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8766/_health >/dev/null 2>&1; then
    echo "Serveur local OK."
    break
  fi
  sleep 0.5
done

# Installe le module localtunnel localement si absent
# (on n'utilise PAS "npx localtunnel" car sa commande plante sur Android
#  à cause du module "openurl" qu'elle essaie de charger)
if [ ! -d node_modules/localtunnel ]; then
  echo "Installation de localtunnel (une seule fois)..."
  # --no-bin-links : évite une erreur de symlink si le dossier est sur
  # le stockage partagé Android (/storage/emulated/0/...), qui ne
  # supporte pas les raccourcis symboliques.
  npm install localtunnel --no-save --no-bin-links --silent
fi

echo
echo "Lancement du tunnel avec le nom demandé : $SUBDOMAIN"
echo "(si ce nom est déjà pris, un autre sera utilisé automatiquement)"
echo

node -e '
const localtunnel = require("localtunnel");
const subdomain = process.argv[1];
(async () => {
  const tunnel = await localtunnel({ port: 8766, subdomain });
  console.log("");
  console.log("========================================================");
  console.log("  TA PAGE PUBLIQUE :");
  console.log("");
  console.log("    ▸  " + tunnel.url);
  console.log("");
  console.log("========================================================");
  console.log("");
  console.log("Appuie sur Ctrl+C pour tout arrêter.");
  tunnel.on("close", () => {
    console.log("[lt] Tunnel fermé.");
    process.exit(0);
  });
  tunnel.on("error", (err) => {
    console.error("[lt] Erreur :", err.message);
  });
})().catch((err) => {
  console.error("Erreur tunnel :", err.message);
  process.exit(1);
});
' "$SUBDOMAIN"
