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
class BackgroundJobTests(unittest.TestCase):
    def tearDown(self):
        server._JOBS.clear()

    def test_queue_completes_without_real_model_weights(self):
        with patch.object(server, "generate", return_value={
            "model":"nano-r2", "text":"hola", "latency_ms":12,
            "prompt_tokens":4, "completion_tokens":2, "engine":"fake-test"
        }):
            job="fixture_valid_job_123456789012"
            server._JOBS[job]={"state":"running","model":"nano-r2",
                                "created":server.time.monotonic(),
                                "updated":server.time.monotonic()}
            server.execute_job(job,"nano-r2",[{"role":"user","content":"hola"}],24)
            self.assertEqual(server._JOBS[job]["state"],"completed")
            self.assertEqual(server._JOBS[job]["result"]["text"],"hola")

    def test_worker_error_never_exposes_exception_text(self):
        with patch.object(server, "generate", side_effect=RuntimeError("PRIVATE_SECRET")):
            job="fixture_valid_job_123456789012"
            server._JOBS[job]={"state":"running","model":"nano-r2",
                                "created":server.time.monotonic(),
                                "updated":server.time.monotonic()}
            server.execute_job(job,"nano-r2",[{"role":"user","content":"hola"}],24)
            self.assertEqual(server._JOBS[job]["state"],"error")
            self.assertEqual(server._JOBS[job]["error"],"MODEL_INFERENCE_FAILURE")

    def test_access_token_fails_closed(self):
        class Fake:
            headers={"authorization":"Bearer not-the-token"}
        with patch.dict("os.environ",{"EDUAI_MODEL_LAB_TOKEN":"a"*48}):
            with self.assertRaises(HTTPException) as error:
                server.check_token(Fake())
            self.assertEqual(error.exception.status_code,401)

if __name__=="__main__":unittest.main()
