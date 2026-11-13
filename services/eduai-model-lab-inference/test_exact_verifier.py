import asyncio
import json
import os
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from starlette.requests import Request
from exact_verifier import verify_subtraction
import server


def request(payload, token="test-token"):
    async def receive():
        return {"type":"http.request", "body":json.dumps(payload).encode(), "more_body":False}
    return Request({"type":"http", "method":"POST", "path":"/verify-math",
                    "headers":[(b"authorization", ("Bearer "+token).encode())]}, receive)


class ExactVerifierTests(unittest.TestCase):
    def test_rejects_copied_fake_inverse_check(self):
        for question,candidate,answer in [("Resta (35) de (39).","74","4"),
            ("Resta (-391) de (181).","-210","572"),("A (0) réstale (26).","26","-26")]:
            result=verify_subtraction(question,candidate)
            self.assertTrue(result["verified"])
            self.assertFalse(result["candidateCorrect"])
            self.assertEqual(result["answer"],answer)

    def test_all_forms_signs_and_zero(self):
        forms=[lambda a,b:f"Resta ({b}) de ({a}).",lambda a,b:f"Quita ({b}) a ({a}).",
               lambda a,b:f"A ({a}) réstale ({b}).",lambda a,b:f"Parte de ({a}) y resta ({b}).",
               lambda a,b:f"Sustrae ({b}) del número ({a}).",lambda a,b:f"Disminuye ({a}) en ({b})."]
        for a in (-999999999999,-8,0,7,999999999999):
            for b in (-999999999999,-3,0,5,999999999999):
                for form in forms:
                    result=verify_subtraction(form(a,b),str(a-b))
                    self.assertEqual(result["answer"],str(a-b))
                    self.assertTrue(result["candidateCorrect"])
                    self.assertFalse(verify_subtraction(form(a,b),str(a-b+1))["candidateCorrect"])

    def test_terminal_period_is_optional_but_extra_instructions_are_not(self):
        forms = ["Resta (35) de (39)", "Quita (35) a (39)",
                 "A (39) réstale (35)", "Parte de (39) y resta (35)",
                 "Sustrae (35) del número (39)", "Disminuye (39) en (35)"]
        for question in forms:
            self.assertEqual(verify_subtraction(question, "74"),
                             verify_subtraction(question + ".", "74"))
            self.assertEqual(verify_subtraction(question)["answer"], "4")
            self.assertFalse(verify_subtraction(question + " y suma 1")["supported"])
            self.assertFalse(verify_subtraction(question + ". Luego suma 1.")["supported"])

    def test_abstains_instead_of_ignoring_extra_context(self):
        for q in ("Resta (3) de (8). Luego suma 1.","Resta (1/2) de (8).",
                  "Resta (__import__('os')) de (8).","Calcula 3x=12","Resta (3) de (8).\nQuita (2) a (4)."):
            self.assertFalse(verify_subtraction(q)["supported"])
        self.assertFalse(verify_subtraction("Resta (3) de (8).",True)["verified"])

    def test_endpoint_requires_token_without_loading_weights(self):
        with patch.dict(os.environ,{"EDUAI_MODEL_LAB_TOKEN":"test-token"}),patch.object(server,"generate",side_effect=AssertionError("must not load model")):
            result=asyncio.run(server.verify_math(request({"prompt":"Resta (35) de (39).","candidate":"74"})))
            self.assertFalse(result["candidateCorrect"])
            with self.assertRaises(HTTPException) as e:
                asyncio.run(server.verify_math(request({"prompt":"hello"},token="wrong")))
            self.assertEqual(e.exception.status_code,401)
            with self.assertRaises(HTTPException) as e:
                asyncio.run(server.verify_math(request({"prompt":"x"*6001})))
            self.assertEqual(e.exception.status_code,413)

if __name__=="__main__":unittest.main()
