"""Unit tests for each invariant in twin/invariants.py, against small
synthetic states (no dependency on the real ingested data, so these are fast
and isolate the logic being tested)."""

from __future__ import annotations

from twin.invariants import (
    check_geometry_validity,
    check_policy_zone_references,
    check_street_network_edits_connect,
    check_street_removal_preserves_connectivity,
    check_transit_stops_on_network,
)
from twin.schema import Edit, PolicyValue, StreetSegment, TransitStop, ZoningParcel
from twin.state import TwinState


def _street(id_: str, coords: list[tuple[float, float]]) -> StreetSegment:
    return StreetSegment(id=id_, geometry={"type": "LineString", "coordinates": coords})


def _empty_state(**overrides) -> TwinState:
    layers = {
        "streets": {},
        "buildings": {},
        "zoning": {},
        "parks": {},
        "transit_stops": {},
        "transit_shapes": {},
    }
    layers.update(overrides.pop("layers", {}))
    return TwinState(layers=layers, policies=overrides.pop("policies", {}), version=0, parent_version=None)


# ---- transit stop / network proximity --------------------------------------


def test_stop_near_street_passes():
    state = _empty_state(
        layers={
            "streets": {"streets:1": _street("streets:1", [(0, 0), (100, 0)])},
            "transit_stops": {
                "transit_stops:1": TransitStop(id="transit_stops:1", geometry={"type": "Point", "coordinates": [10, 5]})
            },
        }
    )
    assert check_transit_stops_on_network(state) == []


def test_stop_far_from_street_fails():
    state = _empty_state(
        layers={
            "streets": {"streets:1": _street("streets:1", [(0, 0), (100, 0)])},
            "transit_stops": {
                "transit_stops:1": TransitStop(
                    id="transit_stops:1", geometry={"type": "Point", "coordinates": [10, 5000]}
                )
            },
        }
    )
    violations = check_transit_stops_on_network(state)
    assert len(violations) == 1
    assert "transit_stops:1" in violations[0]


def test_no_network_at_all_does_not_crash():
    state = _empty_state(
        layers={
            "transit_stops": {
                "transit_stops:1": TransitStop(id="transit_stops:1", geometry={"type": "Point", "coordinates": [0, 0]})
            }
        }
    )
    assert check_transit_stops_on_network(state) == []


# ---- policy / zoning references --------------------------------------------


def test_policy_referencing_existing_zone_passes():
    state = _empty_state(
        layers={"zoning": {"zoning:1": ZoningParcel(id="zoning:1", geometry={"type": "Polygon", "coordinates": [[(0, 0), (1, 0), (1, 1), (0, 0)]]})}},
        policies={"policy:1": PolicyValue(id="policy:1", kind="parking_tax_pct", zone_id="zoning:1", value=5.0)},
    )
    assert check_policy_zone_references(state) == []


def test_policy_referencing_missing_zone_fails():
    state = _empty_state(
        policies={"policy:1": PolicyValue(id="policy:1", kind="parking_tax_pct", zone_id="zoning:nonexistent", value=5.0)}
    )
    violations = check_policy_zone_references(state)
    assert len(violations) == 1
    assert "zoning:nonexistent" in violations[0]


def test_citywide_policy_with_no_zone_id_passes():
    state = _empty_state(policies={"policy:1": PolicyValue(id="policy:1", kind="transit_fare", zone_id=None, value=3.35)})
    assert check_policy_zone_references(state) == []


# ---- geometry validity ------------------------------------------------------


def test_valid_geometries_pass():
    state = _empty_state(layers={"streets": {"streets:1": _street("streets:1", [(0, 0), (10, 0)])}})
    assert check_geometry_validity(state) == []


def test_self_intersecting_polygon_fails():
    bowtie = ZoningParcel(
        id="zoning:bowtie",
        geometry={"type": "Polygon", "coordinates": [[(0, 0), (1, 1), (1, 0), (0, 1), (0, 0)]]},
    )
    state = _empty_state(layers={"zoning": {"zoning:bowtie": bowtie}})
    violations = check_geometry_validity(state)
    assert len(violations) == 1
    assert "zoning:bowtie" in violations[0]


def test_wrong_geometry_type_for_layer_fails():
    # A transit stop is supposed to be a Point, not a LineString.
    bad_stop = TransitStop(id="transit_stops:bad", geometry={"type": "LineString", "coordinates": [(0, 0), (1, 1)]})
    state = _empty_state(layers={"transit_stops": {"transit_stops:bad": bad_stop}})
    violations = check_geometry_validity(state)
    assert len(violations) == 1
    assert "transit_stops:bad" in violations[0]


# ---- street network connectivity on edit -----------------------------------


def test_added_street_connected_to_network_passes():
    state = _empty_state(
        layers={
            "streets": {
                "streets:1": _street("streets:1", [(0, 0), (100, 0)]),
                "streets:2": _street("streets:2", [(100, 0), (200, 0)]),  # shares endpoint with streets:1
            }
        },
        policies={},
    )
    state = TwinState(
        layers=state.layers,
        policies=state.policies,
        version=1,
        parent_version=0,
        edits_applied=(Edit(op="add", layer="streets", feature_id="streets:2", feature={}),),
    )
    assert check_street_network_edits_connect(state) == []


def test_added_street_disconnected_from_network_fails():
    state = _empty_state(
        layers={
            "streets": {
                "streets:1": _street("streets:1", [(0, 0), (100, 0)]),
                "streets:2": _street("streets:2", [(5000, 5000), (5100, 5000)]),  # floating fragment
            }
        }
    )
    state = TwinState(
        layers=state.layers,
        policies=state.policies,
        version=1,
        parent_version=0,
        edits_applied=(Edit(op="add", layer="streets", feature_id="streets:2", feature={}),),
    )
    violations = check_street_network_edits_connect(state)
    assert len(violations) == 1
    assert "streets:2" in violations[0]


def test_unedited_streets_are_not_checked():
    # streets:2 is a pre-existing disconnected fragment (real data has a few
    # of these at clip boundaries); since it wasn't touched by this edit
    # set, it should not block the patch.
    state = _empty_state(
        layers={
            "streets": {
                "streets:1": _street("streets:1", [(0, 0), (100, 0)]),
                "streets:2": _street("streets:2", [(5000, 5000), (5100, 5000)]),
            },
            "parks": {},
        }
    )
    state = TwinState(
        layers=state.layers,
        policies=state.policies,
        version=1,
        parent_version=0,
        edits_applied=(Edit(op="add", layer="parks", feature_id="parks:1", feature={}),),
    )
    assert check_street_network_edits_connect(state) == []


# ---- street removal connectivity (needs parent state) ----------------------


def test_removing_a_bridge_segment_that_disconnects_the_network_fails():
    # Two clusters (streets:1/2 and streets:4/5) joined only by the bridge
    # segment streets:3. Removing streets:3 severs them.
    parent = _empty_state(
        layers={
            "streets": {
                "streets:1": _street("streets:1", [(0, 0), (100, 0)]),
                "streets:2": _street("streets:2", [(100, 0), (200, 0)]),
                "streets:3": _street("streets:3", [(200, 0), (300, 0)]),  # the bridge
                "streets:4": _street("streets:4", [(300, 0), (400, 0)]),
                "streets:5": _street("streets:5", [(400, 0), (500, 0)]),
            }
        }
    )
    edit = Edit(op="remove", layer="streets", feature_id="streets:3", feature=None)
    candidate = parent._apply_edits_unchecked([edit])
    violations = check_street_removal_preserves_connectivity(candidate, parent)
    assert len(violations) == 1
    assert "streets:3" in violations[0]


def test_removing_a_redundant_segment_with_an_alternate_route_passes():
    # A loop: 1-2-3-4 and a shortcut 1-4. Removing any one edge still leaves
    # every node reachable via the rest of the loop.
    parent = _empty_state(
        layers={
            "streets": {
                "streets:1": _street("streets:1", [(0, 0), (100, 0)]),
                "streets:2": _street("streets:2", [(100, 0), (100, 100)]),
                "streets:3": _street("streets:3", [(100, 100), (0, 100)]),
                "streets:4": _street("streets:4", [(0, 100), (0, 0)]),  # closes the loop
            }
        }
    )
    edit = Edit(op="remove", layer="streets", feature_id="streets:4", feature=None)
    candidate = parent._apply_edits_unchecked([edit])
    assert check_street_removal_preserves_connectivity(candidate, parent) == []


def test_removing_a_dead_end_stub_passes():
    # streets:2 is a dead-end stub hanging off streets:1; nothing else routed
    # through its far endpoint, so removing it can't disconnect anything.
    parent = _empty_state(
        layers={
            "streets": {
                "streets:1": _street("streets:1", [(0, 0), (100, 0)]),
                "streets:2": _street("streets:2", [(100, 0), (100, 50)]),  # dead end
            }
        }
    )
    edit = Edit(op="remove", layer="streets", feature_id="streets:2", feature=None)
    candidate = parent._apply_edits_unchecked([edit])
    assert check_street_removal_preserves_connectivity(candidate, parent) == []


def test_no_parent_state_means_no_op():
    parent = _empty_state(layers={"streets": {"streets:1": _street("streets:1", [(0, 0), (100, 0)])}})
    edit = Edit(op="remove", layer="streets", feature_id="streets:1", feature=None)
    candidate = parent._apply_edits_unchecked([edit])
    assert check_street_removal_preserves_connectivity(candidate, None) == []


def test_removal_check_against_the_real_ward_13_network(base_state: TwinState):
    # Exercise the check against the real, large Ward 13 street graph rather
    # than only tiny synthetic fixtures: build a guaranteed bridge (two
    # segments floating far outside the real network, joined only to each
    # other) on top of the real base state, then confirm removing the
    # bridge segment is correctly flagged.
    # Two spurs (each with an extra segment so they're not themselves mere
    # dead ends) joined only by the bridge in the middle -- a genuine
    # two-cluster topology, far from the real network so it can't
    # accidentally touch it.
    fixture_edits = [
        Edit(op="add", layer="streets", feature_id="streets:test-spur-a1", feature={"geometry": {"type": "LineString", "coordinates": [[998800.0, 999000.0], [998900.0, 999000.0]]}}),
        Edit(op="add", layer="streets", feature_id="streets:test-spur-a2", feature={"geometry": {"type": "LineString", "coordinates": [[998900.0, 999000.0], [999000.0, 999000.0]]}}),
        Edit(op="add", layer="streets", feature_id="streets:test-bridge", feature={"geometry": {"type": "LineString", "coordinates": [[999000.0, 999000.0], [999100.0, 999000.0]]}}),
        Edit(op="add", layer="streets", feature_id="streets:test-spur-b1", feature={"geometry": {"type": "LineString", "coordinates": [[999100.0, 999000.0], [999200.0, 999000.0]]}}),
        Edit(op="add", layer="streets", feature_id="streets:test-spur-b2", feature={"geometry": {"type": "LineString", "coordinates": [[999200.0, 999000.0], [999300.0, 999000.0]]}}),
    ]
    with_bridge = base_state._apply_edits_unchecked(fixture_edits)
    # Bypass patch() to build the fixture (these floating segments would
    # themselves fail check_street_network_edits_connect); we only want to
    # test the removal check in isolation here.
    remove_bridge = Edit(op="remove", layer="streets", feature_id="streets:test-bridge", feature=None)
    candidate = with_bridge._apply_edits_unchecked([remove_bridge])
    violations = check_street_removal_preserves_connectivity(candidate, with_bridge)
    assert len(violations) == 1
    assert "streets:test-bridge" in violations[0]
