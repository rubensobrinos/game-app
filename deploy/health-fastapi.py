# Voorbeeld, kopieer naar je app (devkit ADR-0062).
"""Health-endpoints: /health (liveness) en /health/ready (readiness)."""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Awaitable, Callable

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()
log = logging.getLogger(__name__)

DIENST = "rounda"
#: Elke afhankelijkheid krijgt hoogstens zoveel seconden; een traag antwoord telt als 'down'.
CHECK_TIMEOUT_S = 2.0


async def controleer_database() -> bool:
    """Voorbeeld: True als de database antwoordt. Vervang door een echte, goedkope query (SELECT 1)."""
    return True


#: naam -> (check, kritiek). Een kritieke check die faalt maakt de dienst 'down' (503); een andere maakt hem 'degraded' (200).
CHECKS: dict[str, tuple[Callable[[], Awaitable[bool]], bool]] = {
    "database": (controleer_database, True),
}


async def _draai(naam: str, check: Callable[[], Awaitable[bool]]) -> str:
    """'ok', of 'down' bij False, een fout of een time-out. De fout gaat naar het logboek, nooit in het antwoord."""
    taak = asyncio.ensure_future(check())
    klaar, _ = await asyncio.wait({taak}, timeout=CHECK_TIMEOUT_S)
    if not klaar:
        taak.cancel()
        log.warning("health-check %s: geen antwoord binnen %.1f s", naam, CHECK_TIMEOUT_S)
        return "down"
    if taak.cancelled():
        log.warning("health-check %s: afgebroken", naam)
        return "down"
    fout = taak.exception()
    if fout is not None:
        log.warning("health-check %s faalde: %s", naam, type(fout).__name__)
        return "down"
    return "ok" if taak.result() else "down"


@router.get("/health")
async def health() -> JSONResponse:
    """Liveness: leeft het proces? Geen afhankelijkheden, geen I/O."""
    return JSONResponse({"status": "ok"})


@router.get("/health/ready")
async def health_ready() -> JSONResponse:
    """Readiness: kan het werk doen? Zijn de checks duur, cache dit antwoord dan een paar seconden."""
    uitkomsten = await asyncio.gather(*(_draai(naam, check) for naam, (check, _) in CHECKS.items()))
    checks = dict(zip(CHECKS, uitkomsten, strict=True))
    kritiek_down = any(checks[naam] == "down" and CHECKS[naam][1] for naam in CHECKS)
    status = "down" if kritiek_down else ("degraded" if "down" in checks.values() else "ok")
    return JSONResponse(
        {"status": status, "dienst": DIENST, "versie": os.getenv("APP_VERSIE", "onbekend"), "checks": checks},
        status_code=503 if status == "down" else 200,
    )
