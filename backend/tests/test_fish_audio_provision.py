import unittest
from backend.admin.fish_audio import (
    build_tool_definition,
    DEFAULT_FISH_VOICE_ID,
    get_public_base_url,
)

class TestFishAudioProvision(unittest.TestCase):
    def test_build_tool_definition_get_services(self):
        tool = build_tool_definition("get_services", "biz_test_123", "Test Clinic")
        self.assertIsNotNone(tool)
        self.assertEqual(tool["name"], "get_services")
        self.assertEqual(tool["method"], "GET")
        self.assertIn("biz_test_123", tool["url"])
        self.assertEqual(tool["arguments"], [])
        self.assertEqual(tool["tool_type"], "webhook")
        self.assertTrue(tool["expects_response"])

    def test_build_tool_definition_create_appointment(self):
        tool = build_tool_definition("create_appointment", "biz_test_123", "Test Clinic")
        self.assertIsNotNone(tool)
        self.assertEqual(tool["name"], "create_appointment")
        self.assertEqual(tool["method"], "POST")
        self.assertIn("/appointments", tool["url"])
        arg_names = [a["name"] for a in tool["arguments"]]
        self.assertIn("customer_name", arg_names)
        self.assertIn("customer_phone", arg_names)
        self.assertIn("appointment_date", arg_names)
        self.assertIn("appointment_time", arg_names)
        self.assertIn("biz_test_123", tool["body_template"])
        self.assertIn("{{customer_name}}", tool["body_template"])

    def test_build_tool_definition_search_appointment(self):
        tool = build_tool_definition("search_appointment", "biz_test_123", "Test Clinic")
        self.assertIsNotNone(tool)
        self.assertEqual(tool["name"], "search_appointment")
        self.assertEqual(tool["method"], "POST")
        arg_names = [a["name"] for a in tool["arguments"]]
        self.assertIn("appointment_id", arg_names)
        self.assertIn("customer_phone", arg_names)
        self.assertIn("biz_test_123", tool["body_template"])

    def test_build_tool_definition_reschedule_appointment(self):
        tool = build_tool_definition("reschedule_appointment", "biz_test_123", "Test Clinic")
        self.assertIsNotNone(tool)
        self.assertEqual(tool["name"], "reschedule_appointment")
        self.assertEqual(tool["method"], "PUT")
        arg_names = [a["name"] for a in tool["arguments"]]
        self.assertIn("new_date", arg_names)
        self.assertIn("new_time", arg_names)

    def test_build_tool_definition_cancel_appointment(self):
        tool = build_tool_definition("cancel_appointment", "biz_test_123", "Test Clinic")
        self.assertIsNotNone(tool)
        self.assertEqual(tool["name"], "cancel_appointment")
        self.assertEqual(tool["method"], "PUT")
        arg_names = [a["name"] for a in tool["arguments"]]
        self.assertIn("appointment_id", arg_names)

    def test_default_fish_voice_id(self):
        self.assertEqual(DEFAULT_FISH_VOICE_ID, "e80db686476f4ccda758da35cacfb993")

    def test_public_base_url_fallback(self):
        url = get_public_base_url()
        self.assertTrue(url.startswith("http"))
        self.assertFalse("localhost" in url)

if __name__ == "__main__":
    unittest.main()
