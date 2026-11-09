import pathlib, sys, unittest
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from evaluation import classify, same_answer, summarize, objective, validation_gate
from generate import generate, assert_example_contract

class EvaluationRegressionTests(unittest.TestCase):
    def test_exact_fraction_equivalence(self):
        self.assertTrue(same_answer("-2/4","-1/2"))
        self.assertFalse(same_answer("-2/5","-1/2"))
        self.assertFalse(same_answer("2/0","2"))

    def test_final_only_vs_verbose(self):
        expected="-17"
        a=classify("-17",expected)
        self.assertTrue(a["passed"])
        b=classify("Dividir por -5.\nRespuesta final: -17",expected)
        self.assertFalse(b["passed"])
        self.assertTrue(b["semanticCorrect"])
        self.assertEqual(b["reason"],"format_error")

    def test_truncation_not_counted_as_correct(self):
        a=classify("-17","-17",token_count=128,max_new_tokens=128,eos_seen=False)
        self.assertFalse(a["passed"])
        self.assertEqual(a["reason"],"truncated")
        b=classify("-17","-17",token_count=128,max_new_tokens=128,eos_seen=True)
        self.assertTrue(b["passed"])

    def test_boolean_and_non_numeric(self):
        self.assertTrue(classify("si","sí")["passed"])
        self.assertTrue(classify("HAVING","HAVING")["passed"])
        self.assertFalse(classify("no","sí")["passed"])

    def test_report_contains_disaggregated_reasons(self):
        rows=[{"category":"algebra","answer":"9","response_format":"final"},
              {"category":"algebra","answer":"2","response_format":"final"},
              {"category":"logic","answer":"no","response_format":"final"}]
        got=[{"text":"9","tokens":2,"max_new_tokens":128,"eos_seen":True},
             {"text":"Cálculo hecho.\nRespuesta final: 2","tokens":20,"max_new_tokens":128,"eos_seen":True},
             {"text":"sí","tokens":1,"max_new_tokens":128,"eos_seen":True}]
        report=summarize(rows,got)
        self.assertEqual(report["correct"],1)
        self.assertEqual(report["semanticCorrect"],2)
        self.assertEqual(report["formatErrors"],1)
        self.assertEqual(report["categories"]["algebra"]["total"],2)

    def test_validation_ranking_and_retention_gate(self):
        categories={"algebra":{"correct":10,"total":20},"recurrence":{"correct":4,"total":20},
                    "euler":{"correct":1,"total":20},"rehearsal":{"correct":18,"total":20}}
        baseline={"correct":33,"total":80,"categories":categories}
        boosted={"correct":37,"total":80,"categories":dict(categories)}
        boosted["categories"]["algebra"]={"correct":14,"total":20}
        self.assertGreater(objective(boosted,("algebra","recurrence"))["score"],
                           objective(baseline,("algebra","recurrence"))["score"])
        self.assertTrue(validation_gate(boosted,baseline,("algebra","recurrence")))
        boosted["categories"]["rehearsal"]={"correct":10,"total":20}
        self.assertFalse(validation_gate(boosted,baseline,("algebra","recurrence")))

    def test_full_dataset_output_contract(self):
        train,validation,tests=generate(3000,500,600)
        self.assertEqual(len(train),3000)
        self.assertEqual(len(validation),500)
        self.assertEqual(sum(map(len,tests)),600)
        for row in [*train,*validation,*(r for group in tests for r in group)]:
            assert_example_contract(row)
        traces=[r for r in train if r["mode"]=="trace"]
        self.assertGreater(len(traces),0)
        self.assertLess(len(traces),len(train))
        for row in traces:
            self.assertIn("\nRespuesta final: ",row["completion"])
            self.assertTrue(row["question"].splitlines()[-1].startswith("Explica los pasos"))
        self.assertEqual(sum(row["mode"]=="trace" for row in validation),0)

if __name__=="__main__":
    unittest.main()
