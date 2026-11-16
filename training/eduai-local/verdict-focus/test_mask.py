import runpy
m=runpy.run_path("piloto_veredicto.py",run_name="test_module")
m["CFG"]["max_length"]=5000
class Tok:
 def apply_chat_template(self,msgs,tokenize=True,add_generation_prompt=False):
  s="".join("<"+r["role"]+">"+r["content"]+"</end>" for r in msgs)
  if add_generation_prompt:s+="<assistant>"
  return {"input_ids":[ord(c) for c in s]} if tokenize else s
 def __call__(self,s,**kw):return {"input_ids":[ord(c) for c in s],"offset_mapping":[(i,i+1) for i in range(len(s))]}
train,test=m["make_data"](set())
for row in train+test:
 e=m["encode"](Tok(),row)
 assert all(x==-100 for x in e["labels"][:e["boundary"]])
 assert all(x==0 for x in e["weights"][:e["boundary"]])
 assert all(x>=1 for x in e["weights"][e["boundary"]:])
print("ENCODER_OK",len(train)+len(test),"casos; máscara y pesos")
