import math

import pytest

from filigrane.tiling import auto_size


def test_auto_size_preserves_legacy_default_on_1024_image():
    """Le rendu déjà validé sur une image 1024 px ne doit pas bouger."""
    assert auto_size(1024, 1024, "image") == 24


def test_auto_size_preserves_legacy_default_on_a4():
    assert auto_size(595.28, 841.89, "pdf") == 24


def test_auto_size_scales_with_resolution():
    """Une image 4x plus grande reçoit une police 4x plus grande."""
    assert auto_size(4096, 4096, "image") == pytest.approx(4 * 24, abs=1)


def test_auto_size_keeps_a_floor_on_thumbnails():
    assert auto_size(32, 32, "image") >= 8


def test_auto_size_rejects_unknown_medium():
    with pytest.raises(ValueError):
        auto_size(100, 100, "papyrus")

from filigrane.tiling import (
    DENSITY_GAP,
    diagonal_extent,
    steps_for,
    tile_positions,
)


def test_diagonal_extent_pythagore():
    assert diagonal_extent(3, 4) == 5
    assert diagonal_extent(0, 0) == 0
    assert diagonal_extent(100, 100) == math.ceil(math.hypot(100, 100))


def test_tile_positions_regular_grid():
    pos = tile_positions(100, 50, 50)
    assert pos == [(25.0, 25.0), (75.0, 25.0), (25.0, 75.0), (75.0, 75.0)]


def test_tile_positions_deterministic_order():
    assert tile_positions(200, 30, 40) == tile_positions(200, 30, 40)


def test_tile_positions_rejects_nonpositive_step():
    with pytest.raises(ValueError):
        tile_positions(100, 0, 50)


def test_steps_monotonic_with_density():
    sx_dense, _ = steps_for(100, 24, "dense")
    sx_normal, _ = steps_for(100, 24, "normal")
    sx_sparse, _ = steps_for(100, 24, "sparse")
    assert sx_dense < sx_normal < sx_sparse


def test_steps_rejects_unknown_density():
    with pytest.raises(ValueError):
        steps_for(100, 24, "ultra")


def test_density_keys():
    assert set(DENSITY_GAP) == {"sparse", "normal", "dense"}
