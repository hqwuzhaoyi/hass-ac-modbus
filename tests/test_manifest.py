"""Tests for manifest.json validation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest


def get_manifest_path() -> Path:
    """Get the path to manifest.json."""
    return (
        Path(__file__).parent.parent
        / "custom_components"
        / "ac_modbus"
        / "manifest.json"
    )


class TestManifest:
    """Test manifest.json structure and content."""

    def test_manifest_exists(self) -> None:
        """Test that manifest.json exists."""
        manifest_path = get_manifest_path()
        assert manifest_path.exists(), f"manifest.json not found at {manifest_path}"

    def test_manifest_is_valid_json(self) -> None:
        """Test that manifest.json is valid JSON."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        assert isinstance(data, dict)

    def test_manifest_has_domain(self) -> None:
        """Test that manifest has correct domain."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        assert data.get("domain") == "ac_modbus"

    def test_manifest_has_name(self) -> None:
        """Test that manifest has a name."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        assert "name" in data
        assert isinstance(data["name"], str)
        assert len(data["name"]) > 0

    def test_manifest_has_version(self) -> None:
        """Test that manifest has version."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        assert "version" in data
        # Version should follow semantic versioning pattern
        version = data["version"]
        assert isinstance(version, str)
        parts = version.split(".")
        assert len(parts) >= 2, "Version should be semver format (major.minor.patch)"

    def test_manifest_has_config_flow(self) -> None:
        """Test that manifest enables config flow."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        assert data.get("config_flow") is True

    def test_manifest_has_requirements(self) -> None:
        """Test that manifest has requirements with pymodbus."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        assert "requirements" in data
        requirements = data["requirements"]
        assert isinstance(requirements, list)
        # Check pymodbus is in requirements
        pymodbus_found = any("pymodbus" in req for req in requirements)
        assert pymodbus_found, "pymodbus should be in requirements"

    def test_manifest_has_documentation(self) -> None:
        """Test that manifest has documentation URL."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        # Documentation is optional but recommended
        if "documentation" in data:
            assert isinstance(data["documentation"], str)
            assert data["documentation"].startswith("http")

    def test_manifest_has_codeowners(self) -> None:
        """Test that manifest has codeowners."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        assert "codeowners" in data
        assert isinstance(data["codeowners"], list)

    def test_manifest_has_iot_class(self) -> None:
        """Test that manifest has iot_class."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        assert "iot_class" in data
        # Valid iot_class values for a polling local device
        valid_classes = [
            "local_polling",
            "local_push",
            "cloud_polling",
            "cloud_push",
            "calculated",
        ]
        assert data["iot_class"] in valid_classes

    def test_manifest_homeassistant_minimum_version(self) -> None:
        """Test that manifest specifies minimum HA version."""
        manifest_path = get_manifest_path()
        with open(manifest_path) as f:
            data = json.load(f)
        # homeassistant key specifies minimum version
        if "homeassistant" in data:
            version = data["homeassistant"]
            assert isinstance(version, str)
            # Should be at least 2024.12.0
            parts = version.split(".")
            year = int(parts[0])
            assert year >= 2024, "Minimum HA version should be 2024.12 or later"
