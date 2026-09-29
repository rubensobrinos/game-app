# caddy/Dockerfile — reverse-proxy-dienst (kaart #100796).
#
# Zelfde afweging als nginx/Dockerfile: caddy/Caddyfile was tot nu toe een
# bind mount vanuit de git-werkmap (~/dev/creative/rounda), hetzelfde gat als
# de frontend-sitebestanden — elke opgeslagen wijziging stond zonder release,
# commit of review live. Caddyfile-wijzigingen zijn zeldzaam (routing), maar
# dat is een argument om release-infra er niet dringend omheen te bouwen,
# niet om het gat open te laten staan naast wat deze kaart net dichtte voor
# frontend.
#
# Optie "bind mount vanuit ~/.devkit/sites/rounda/productie" (devkit
# ADR-0037's amendement) is voor nu geen alternatief: niets in
# release_compose() (deploy/lib.sh) ververst die map — hij bouwt bij elke
# release uit een verse git-archive-checkout in een mktemp-map, niet naar een
# blijvende productie/-map. Die infrastructuur bestaat simpelweg nog niet.
#
# Build-context is de repo-root (docker-compose.yml: build.context: .,
# build.dockerfile: caddy/Dockerfile), zodat Caddyfile via een relatief pad
# gekopieerd kan worden zonder een tweede, geneste .dockerignore-context.

FROM caddy:2

COPY caddy/Caddyfile /etc/caddy/Caddyfile
