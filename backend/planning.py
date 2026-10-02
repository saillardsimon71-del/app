"""Rétroplanning engine for PGP Glass projects.

Steps are laid out forward in calendar days from day 0 (end = start + duration,
next step starts at end + 1, as in the reference planning), then the whole plan
is anchored so that the last step ends on the MAD date.
"""
from datetime import date, timedelta

TYPE_DEFAULTS = {
    "NPD": {"glass_cycles": 4, "decor_cycles": 3},
    "DUP": {"glass_cycles": 4, "decor_cycles": 3},
    "FLK": {"glass_cycles": 0, "decor_cycles": 3},
    "MLD": {"glass_cycles": 1, "decor_cycles": 3},
}

PHASES = [
    ("etude", "Étude"),
    ("verre", "Verre"),
    ("decoration", "Décoration"),
    ("emballage", "Emballage"),
    ("preserie", "Présérie"),
    ("production", "Production"),
]

REFERENCE_VALIDATION_DAYS = 10
PACKAGING_START_OFFSET = 53  # Emballage starts 53 days after dev start (S10 in reference)


def ordinal(i: int) -> str:
    return "1er" if i == 1 else f"{i}e"


def build_steps(p: dict, validation_delay: int, order_offset: int) -> list[dict]:
    ratio = validation_delay / REFERENCE_VALIDATION_DAYS

    def appr(d: int) -> int:
        return max(1, round(d * ratio))

    steps: list[dict] = []

    def add(key, phase, name, start, dur, milestone=False, client=False):
        end = start + dur
        steps.append({
            "key": key, "phase": phase, "name": name,
            "start_off": start, "end_off": end, "duration": dur,
            "milestone": milestone, "client_validation": client,
        })
        return end

    # ÉTUDE
    t = add("etude_brief", "etude", "Soumission brief / plan 3D / maquette / échantillon existant", 0, 2, True)
    t = add("etude_faisabilite", "etude", "Étude de faisabilité", t + 1, 5)
    t = add("etude_go", "etude", "Go projet / plan 3D validé", t + 1, 3, True)
    dev_start = t + 1

    # VERRE
    glass = int(p.get("glass_cycles", 0))
    verre_end = -1
    if glass > 0:
        first = "Modification du moule existant" if p["type"] == "MLD" else "Fabrication outillages moule pilote"
        t = add("verre_moule", "verre", first, dev_start, 25)
        for i in range(1, glass + 1):
            final = i == glass
            t = add(f"verre_ech_{i}", "verre", f"{ordinal(i)} échantillonnage", t + 1, 15)
            t = add(f"verre_appr_{i}", "verre", "Retour / approbation finale" if final else "Retour / approbation",
                    t + 1, appr(5 if final else 10), True, True)
        t = add("verre_finalisation", "verre", "Finalisation outillages", t + 1, 30)
        t = add("verre_prets", "verre", "Outillages prêts pour production", t + 1, 5)
        verre_end = t

    # DÉCORATION
    decor = int(p.get("decor_cycles", 0))
    decor_end = -1
    if decor > 0:
        t = add("deco_cibles", "decoration", "Réception des cibles + artworks", dev_start, 10, True)
        t = add("deco_bag_soumission", "decoration", "Soumission BAG", t + 1, 5)
        t = add("deco_bag_ok", "decoration", "BAG approuvé", t + 1, appr(5), True, True)
        for i in range(1, decor + 1):
            final = i == decor
            t = add(f"deco_ech_{i}", "decoration", f"{ordinal(i)} échantillonnage", t + 1, 20 if i % 2 == 1 else 15)
            t = add(f"deco_appr_{i}", "decoration", "Retour / approbation finale" if final else "Retour / approbation",
                    t + 1, appr(5), True, True)
        t = add("deco_homologation", "decoration", "Homologation qualité", t + 1, appr(10), False, True)
        decor_end = t

    # EMBALLAGE
    ptf = p.get("packaging_type") == "ptf"
    t = add("emb_fiche_soumission", "emballage", "Fiche emballage — soumission", dev_start + PACKAGING_START_OFFSET, 10)
    t = add("emb_fiche_ok", "emballage", "Fiche emballage — approbation", t + 1, appr(5), True, True)
    t = add("emb_pret", "emballage", "Emballage prêt (sous-traitance PTF)" if ptf else "Emballage prêt",
            t + 1, int(p.get("ptf_lead_days") or 40) if ptf else 40)
    emb_end = t

    ready = max(verre_end, decor_end, emb_end) + 1

    # PRÉSÉRIE (séquentielle)
    preseries = bool(p.get("preseries_needed"))
    parallel = preseries and p.get("preseries_mode") == "parallele"
    prod_start = ready
    if preseries and not parallel:
        add("ps_commande", "preserie", "Commande présérie", max(0, ready - order_offset), 5, True)
        t = add("ps_preserie", "preserie", "Présérie", ready, 10)
        t = add("ps_cq", "preserie", "Contrôle qualité", t + 1, 5)
        t = add("ps_envoi", "preserie", "Envoi de la présérie", t + 1, 15)
        t = add("ps_ok", "preserie", "OK présérie", t + 1, 15, True, True)
        prod_start = t + 1

    # PRODUCTION
    add("prod_commande", "production", "Commande production", max(0, prod_start - order_offset), 5, True)
    t = add("prod_production", "production", "Production", prod_start, 10)
    t = add("prod_cq1", "production", "Contrôle qualité", t + 1, 5)
    if decor > 0:
        t = add("prod_deco", "production", "Décoration", t + 1, 10)
        t = add("prod_cq2", "production", "Contrôle qualité décor", t + 1, 5)
    if parallel:
        a = add("ps_air", "preserie", "Envoi aérien des 1res pièces (présérie)", t + 1, 5)
        add("ps_ok_parallel", "preserie", "OK présérie (en parallèle de la production)", a + 1, 15, True, True)
    t = add("prod_palettisation", "production", "Palettisation", t + 1, 2)
    add("prod_envoi", "production", "Envoi maritime" if parallel else "Envoi", t + 1, 72, True)

    return steps


def anchor(steps: list[dict], mad: date) -> tuple[date, int]:
    total = max(s["end_off"] for s in steps)
    start = mad - timedelta(days=total)
    for s in steps:
        s["start"] = (start + timedelta(days=s.pop("start_off"))).isoformat()
        s["end"] = (start + timedelta(days=s.pop("end_off"))).isoformat()
    return start, total


def compute_plan(p: dict, validation_delay: int, order_offset: int) -> dict:
    steps = build_steps(p, validation_delay, order_offset)
    start, total = anchor(steps, date.fromisoformat(p["mad_date"]))
    return {"steps": steps, "start_date": start.isoformat(), "total_days": total,
            "total_weeks": round(total / 7 + 0.5)}


def lever_suggestions(p: dict, validation_delay: int, order_offset: int) -> list[dict]:
    base = compute_plan(p, validation_delay, order_offset)["total_days"]
    out = []
    candidates = []
    if p["type"] in ("NPD", "DUP") and int(p.get("glass_cycles", 0)) > 2:
        candidates.append(("glass", "Verre — 2 échantillons", "Flacon de forme simple, sans rupture technique",
                           {"glass_cycles": 2}))
    if int(p.get("decor_cycles", 0)) > 2:
        candidates.append(("decor", "Décor — 2 échantillons", "Décor déjà maîtrisé (panoplie existante)",
                           {"decor_cycles": 2}))
    if p.get("preseries_needed") and p.get("preseries_mode") != "parallele":
        candidates.append(("parallel", "Présérie ∥ Production", "Risque accepté par le client",
                           {"preseries_mode": "parallele"}))
    for key, label, cond, patch in candidates:
        alt = compute_plan({**p, **patch}, validation_delay, order_offset)["total_days"]
        out.append({"key": key, "label": label, "condition": cond, "gain_days": base - alt,
                    "gain_weeks": round((base - alt) / 7, 1), "patch": patch})
    return out


def summarize(steps: list[dict], today: date) -> dict:
    total = len(steps)
    done = sum(1 for s in steps if s.get("done"))
    late = [s for s in steps if not s.get("done") and date.fromisoformat(s["end"]) < today]
    soon = [s for s in steps if not s.get("done") and today <= date.fromisoformat(s["end"]) <= today + timedelta(days=7)]
    pending = sorted([s for s in steps if not s.get("done")], key=lambda s: (s["end"], s["start"]))
    if total and done == total:
        status = "termine"
    elif late:
        status = "en_retard"
    elif soon:
        status = "a_risque"
    elif steps and date.fromisoformat(min(s["start"] for s in steps)) > today:
        status = "a_venir"
    else:
        status = "dans_les_temps"

    phases = []
    for key, name in PHASES:
        ps = [s for s in steps if s["phase"] == key]
        if not ps:
            continue
        phases.append({
            "key": key, "name": name,
            "start": min(s["start"] for s in ps), "end": max(s["end"] for s in ps),
            "done": sum(1 for s in ps if s.get("done")), "total": len(ps),
            "late": sum(1 for s in ps if s in late),
        })
    return {
        "progress": round(done / total, 3) if total else 0,
        "done_count": done, "step_count": total, "late_count": len(late),
        "status": status, "next_step": pending[0] if pending else None, "phases": phases,
    }
