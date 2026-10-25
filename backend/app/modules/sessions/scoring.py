from typing import Any


def calculate_session_score(
    workout_snapshot: dict[str, Any],
    results: list[dict[str, Any]],
) -> int:
    """Award one point per recorded repetition, capped by the prescription.

    The score is descriptive gamification data, not a clinical assessment. Unknown
    items contribute zero; the session service rejects them before persistence.
    """
    prescribed = {
        str(item["id"]): int(item["sets"]) * int(item["repetitions"])
        for item in workout_snapshot.get("items", [])
    }
    return sum(
        min(
            max(int(item.get("completed_repetitions", 0)), 0),
            prescribed.get(str(item.get("workout_item_id")), 0),
        )
        for item in results
    )


def maximum_session_score(workout_snapshot: dict[str, Any]) -> int:
    return sum(
        int(item["sets"]) * int(item["repetitions"])
        for item in workout_snapshot.get("items", [])
    )
