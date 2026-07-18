"""Shared SFT prompt builder (no freesolo dep). Used by Flash env + local smoke."""


def build_user_content(inp: dict) -> str:
    parts = []
    persona = inp.get("persona_text") or ""
    policy = inp.get("policy_text") or ""
    spatial = inp.get("spatial_features_text")
    if persona:
        parts.append(f"PERSONA:\n{persona}")
    if policy:
        parts.append(f"POLICY:\n{policy}")
    if spatial:
        # spatial block already has SPATIAL: prefix from twin.features sometimes
        parts.append(spatial if str(spatial).startswith("SPATIAL:") else f"SPATIAL:\n{spatial}")
    parts.append(
        "Write your opinion on this policy in first person, in your own voice. "
        "Be concrete about how it affects you."
    )
    return "\n\n".join(parts)
