# nginx/Dockerfile — frontend-dienst (singleplayer, statisch), fase 1 (kaart #100796).
#
# Vervangt de bind mounts die docker-compose.yml's frontend-dienst tot nu toe
# rechtstreeks uit de git-werkmap (~/dev/creative/rounda) las: elke opgeslagen
# wijziging — door wie dan ook, inclusief een agent — stond zo onmiddellijk
# live op rounda.io, zonder release, commit of review. Bevestigd via
# `docker inspect aseso-game-frontend-1`: de Source-velden van die mounts
# waren letterlijk /Users/ruben/dev/creative/rounda/... . Zelfde patroon als
# ../server/Dockerfile (dat had al een eigen image; deze dienst nog niet).
#
# Build-context is de REPO-ROOT (zie docker-compose.yml: build.context: .,
# build.dockerfile: nginx/Dockerfile) — nodig omdat de sitebestanden hieronder
# allemaal in de repo-root staan, niet onder nginx/.

FROM nginx:alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY app.js /usr/share/nginx/html/app.js
COPY hint.js /usr/share/nginx/html/hint.js
COPY public-mode.js /usr/share/nginx/html/public-mode.js
COPY favicon.svg /usr/share/nginx/html/favicon.svg
COPY apple-touch-icon.png /usr/share/nginx/html/apple-touch-icon.png
COPY og-image.png /usr/share/nginx/html/og-image.png
COPY flaginfo.js /usr/share/nginx/html/flaginfo.js
COPY geo.js /usr/share/nginx/html/geo.js
COPY geo-facts.js /usr/share/nginx/html/geo-facts.js
COPY docs/progress/ /usr/share/nginx/html/docs/progress/
COPY docs/design-documentation/ /usr/share/nginx/html/docs/design-documentation/
COPY data/ /usr/share/nginx/html/data/
COPY flags/ /usr/share/nginx/html/flags/

# LET OP (juridisch, docs/multiplayer/PRODUCT.md — zie ook
# docs/archief/fase1-runbook.md, openstaand punt 1, "Niet vergeten"):
# merk-/clublogo's mogen niet zonder vrijgave publiek gaan. logos/ en
# football/ zitten hier nog steeds in (de singleplayer-UI verwacht ze, net
# als toen ze een bind mount waren) — dit COPY-blok maakt het gat NIET groter
# of kleiner dan het al was, maar LET WEL OP: eenmaal in dit image gebakken
# is verwijderen niet meer zo simpel als een bind mount weghalen uit
# docker-compose.yml — het vergt een nieuwe build. Vóór de publieke launch
# nog steeds: logospellen uitschakelen in de build óf deze twee COPY-regels
# weghalen.
COPY logos/ /usr/share/nginx/html/logos/
COPY football/ /usr/share/nginx/html/football/

# Leesrechten normaliseren (zelfde voorzorg als ../server/Dockerfile, dat
# hierdoor een echte EACCES-bug op één bestand met mode 600 heeft opgelost,
# "livegang-debug" 2026-08-02): COPY neemt de bestandsrechten van de host
# mee. nginx:alpine's worker-processen draaien als de `nginx`-gebruiker (de
# master-node zelf als root, maar leest de site-bestanden niet — dat doen de
# workers), dus een bestand dat op de host met een strikte umask is
# weggeschreven (mode 600) zou anders alleen door root leesbaar zijn.
RUN chmod -R a+rX /usr/share/nginx/html /etc/nginx/conf.d/default.conf

EXPOSE 80
