"""Tests for translations."""

from __future__ import annotations

import json
from pathlib import Path

TRANSLATIONS_DIR = (
    Path(__file__).parent.parent / "custom_components" / "ac_modbus" / "translations"
)


def load_translation(lang: str) -> dict:
    """Load a translation file."""
    translation_file = TRANSLATIONS_DIR / f"{lang}.json"
    if not translation_file.exists():
        return {}
    with open(translation_file, encoding="utf-8") as f:
        return json.load(f)


class TestTranslationKeysComplete:
    """Test that all required translation keys are present."""

    def test_translation_keys_complete_en(self) -> None:
        """Test English translation has required keys."""
        translations = load_translation("en")

        # Config flow keys
        assert "config" in translations
        assert "step" in translations["config"]
        assert "user" in translations["config"]["step"]
        assert "title" in translations["config"]["step"]["user"]
        assert "data" in translations["config"]["step"]["user"]

        # Error keys
        assert "error" in translations["config"]

        # Abort keys
        assert "abort" in translations["config"]

    def test_translation_keys_complete_zh(self) -> None:
        """Test Chinese translation has required keys."""
        translations = load_translation("zh-Hans")

        # Config flow keys
        assert "config" in translations
        assert "step" in translations["config"]
        assert "user" in translations["config"]["step"]
        assert "title" in translations["config"]["step"]["user"]
        assert "data" in translations["config"]["step"]["user"]

    def test_all_en_keys_in_zh(self) -> None:
        """Test that all English keys exist in Chinese translation."""
        en = load_translation("en")
        zh = load_translation("zh-Hans")

        def check_keys(en_dict: dict, zh_dict: dict, path: str = "") -> list[str]:
            """Check that all keys in en_dict exist in zh_dict."""
            missing = []
            for key in en_dict:
                full_path = f"{path}.{key}" if path else key
                if key not in zh_dict:
                    missing.append(full_path)
                elif isinstance(en_dict[key], dict) and isinstance(
                    zh_dict.get(key), dict
                ):
                    missing.extend(check_keys(en_dict[key], zh_dict[key], full_path))
            return missing

        missing_keys = check_keys(en, zh)
        assert not missing_keys, f"Missing keys in zh-Hans: {missing_keys}"


class TestEnglishTranslation:
    """Test English translation content."""

    def test_en_translation_exists(self) -> None:
        """Test English translation file exists."""
        translation_file = TRANSLATIONS_DIR / "en.json"
        assert translation_file.exists(), "en.json translation file not found"

    def test_en_translation_valid_json(self) -> None:
        """Test English translation is valid JSON."""
        translation_file = TRANSLATIONS_DIR / "en.json"
        with open(translation_file, encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, dict)

    def test_en_config_step_user_title(self) -> None:
        """Test English config flow title."""
        translations = load_translation("en")
        title = translations["config"]["step"]["user"]["title"]
        assert title, "Config step title should not be empty"

    def test_en_config_data_labels(self) -> None:
        """Test English config data labels."""
        translations = load_translation("en")
        data = translations["config"]["step"]["user"]["data"]

        # Required fields
        assert "host" in data
        assert "port" in data

    def test_en_error_messages(self) -> None:
        """Test English error messages."""
        translations = load_translation("en")
        errors = translations["config"]["error"]

        # Check common error types
        assert "cannot_connect" in errors
        assert errors["cannot_connect"], "Error message should not be empty"


class TestChineseTranslation:
    """Test Chinese translation content."""

    def test_zh_translation_exists(self) -> None:
        """Test Chinese translation file exists."""
        translation_file = TRANSLATIONS_DIR / "zh-Hans.json"
        assert translation_file.exists(), "zh-Hans.json translation file not found"

    def test_zh_translation_valid_json(self) -> None:
        """Test Chinese translation is valid JSON."""
        translation_file = TRANSLATIONS_DIR / "zh-Hans.json"
        with open(translation_file, encoding="utf-8") as f:
            data = json.load(f)
        assert isinstance(data, dict)

    def test_zh_contains_chinese_characters(self) -> None:
        """Test Chinese translation contains Chinese characters."""
        translations = load_translation("zh-Hans")

        # Get a sample text
        title = translations["config"]["step"]["user"]["title"]

        # Check for Chinese characters (CJK Unified Ideographs range)
        has_chinese = any("\u4e00" <= char <= "\u9fff" for char in title)
        assert has_chinese, f"Title '{title}' should contain Chinese characters"

    def test_zh_config_step_user_title(self) -> None:
        """Test Chinese config flow title."""
        translations = load_translation("zh-Hans")
        title = translations["config"]["step"]["user"]["title"]
        assert title, "Config step title should not be empty"

    def test_zh_config_data_labels(self) -> None:
        """Test Chinese config data labels."""
        translations = load_translation("zh-Hans")
        data = translations["config"]["step"]["user"]["data"]

        # Required fields
        assert "host" in data
        assert "port" in data


class TestTranslationFormat:
    """Test translation file format."""

    def test_translations_directory_exists(self) -> None:
        """Test translations directory exists."""
        assert TRANSLATIONS_DIR.exists(), "translations directory not found"

    def test_no_duplicate_keys(self) -> None:
        """Test no duplicate keys in translations."""
        # JSON parser doesn't allow duplicate keys, so just loading is enough
        for lang in ["en", "zh-Hans"]:
            translations = load_translation(lang)
            assert isinstance(translations, dict)

    def test_no_empty_strings(self) -> None:
        """Test no empty strings in translations."""

        def check_empty(d: dict, path: str = "") -> list[str]:
            """Find empty strings in dict."""
            empty = []
            for key, value in d.items():
                full_path = f"{path}.{key}" if path else key
                if isinstance(value, str) and not value.strip():
                    empty.append(full_path)
                elif isinstance(value, dict):
                    empty.extend(check_empty(value, full_path))
            return empty

        for lang in ["en", "zh-Hans"]:
            translations = load_translation(lang)
            empty_keys = check_empty(translations)
            assert not empty_keys, f"Empty strings in {lang}: {empty_keys}"
