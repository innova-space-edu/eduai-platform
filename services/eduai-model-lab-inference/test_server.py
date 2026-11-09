import tempfile, pathlib, unittest
from unittest.mock import patch
from fastapi import HTTPException
import server

class ModelLabServerTests(unittest.TestCase):
    def test_requires_allowlisted_id(self):
        with self.assertRaises(HTTPException):
            server.model_dir("../../etc/passwd")
    def test_r5_always_locked_by_default(self):
        with patch.dict("os.environ", {"EDUAI_MODEL_LAB_R5_APPROVED":"false"}):
            with self.assertRaises(HTTPException):
                server.model_dir("nano-r5")
    def test_models_require_real_adapter_files(self):
        with tempfile.TemporaryDirectory() as d:
            with patch.object(server,"ROOT",pathlib.Path(d)):
                self.assertFalse(server.available("nano-r2"))
                folder=pathlib.Path(d)/"nano-r2"
                folder.mkdir()
                (folder/"adapter_config.json").write_text("{}")
                self.assertFalse(server.available("nano-r2"))
                (folder/"adapter_model.safetensors").write_bytes(b"fixture")
                self.assertTrue(server.available("nano-r2"))
    def test_rejects_bad_payload(self):
        with patch.object(server,"available",return_value=True):
            with self.assertRaises(HTTPException):
                server.parse_payload({"model":"nano-r2","messages":[{"role":"system","content":"foo"}]})
            with self.assertRaises(HTTPException):
                server.parse_payload({"model":"nano-r2","messages":[{"role":"user","content":"ok"}],"max_new_tokens":9999})
            with self.assertRaises(HTTPException):
                server.parse_payload({"model":"nano-r2","messages":[{"role":"tool","content":"ok"}]})
    def test_accepts_bounded_valid_chat(self):
        with patch.object(server,"available",return_value=True):
            m,messages,tokens=server.parse_payload({"model":"nano-r2","messages":[{"role":"user","content":"Hola"}],"max_new_tokens":32})
            self.assertEqual((m,tokens),("nano-r2",32))
            self.assertEqual(messages[0]["content"],"Hola")
if __name__=="__main__":unittest.main()
