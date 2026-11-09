"""EDUAI SymPy exact engine: structured input only, never parse free-form expressions."""
import re
import sympy as sp
PAT=re.compile(r"^[+-]?\d{1,12}(?:/[+-]?\d{1,12})?$")
def rational(v):
    if isinstance(v,bool) or not isinstance(v,(str,int)) or not PAT.fullmatch(str(v).strip()):
        raise ValueError("INVALID_RATIONAL")
    a,*b=str(v).strip().split("/")
    if b and int(b[0])==0:raise ValueError("DIVISION_BY_ZERO")
    return sp.Rational(int(a),int(b[0]) if b else 1)
def bounded_int(v,low,high):
    if isinstance(v,bool) or not isinstance(v,(str,int)) or not str(v).strip().isdigit():
        raise ValueError("INVALID_INTEGER")
    n=int(v)
    if not low<=n<=high:raise ValueError("OUT_OF_RANGE")
    return n
def fmt(v):
    s=str(v)
    if len(s)>2048:raise ValueError("RESULT_TOO_LONG")
    return s
def result(op,answer,steps):
    return {"supported":True,"verified":True,"engine":"sympy","operation":op,"answer":fmt(answer),"steps":steps}
def solve(p):
    if not isinstance(p,dict):raise ValueError("INVALID_PAYLOAD")
    op=p.get("operation")
    x=sp.Symbol("x")
    if op=="quadratic":
        a,b,c=(rational(p[z]) for z in ("a","b","c"))
        if a==0:raise ValueError("NOT_QUADRATIC")
        e=a*x**2+b*x+c;disc=b*b-4*a*c
        if disc<0:return result(op,"sin raíces reales",["Discriminante = "+fmt(disc)])
        roots=sp.solve(e,x)
        if any(sp.simplify(e.subs(x,r))!=0 for r in roots):raise ValueError("VERIFICATION_FAILED")
        return result(op,", ".join("x="+fmt(r) for r in roots),["Discriminante = "+fmt(disc),"Verificado por sustitución simbólica"])
    if op in ("polynomial_derivative","polynomial_integral"):
        co=p.get("coefficients")
        if not isinstance(co,list) or not 1<=len(co)<=7:raise ValueError("INVALID_COEFFICIENTS")
        expr=sp.Poly.from_list([rational(c) for c in co],gens=x).as_expr()
        val=sp.diff(expr,x) if op=="polynomial_derivative" else sp.integrate(expr,x)
        check=sp.diff(val,x)-expr if op=="polynomial_integral" else val-sp.diff(expr,x)
        if sp.simplify(check)!=0:raise ValueError("VERIFICATION_FAILED")
        return result(op,fmt(val)+(" + C" if op=="polynomial_integral" else ""),["Polinomio: "+fmt(expr),"Identidad verificada"])
    if op=="linear_system3":
        rows=p.get("matrix");values=p.get("values")
        if not isinstance(rows,list) or len(rows)!=3 or not all(isinstance(row,list) and len(row)==3 for row in rows):raise ValueError("INVALID_MATRIX")
        if not isinstance(values,list) or len(values)!=3:raise ValueError("INVALID_VALUES")
        a=sp.Matrix([[rational(v) for v in row] for row in rows]);b=sp.Matrix([rational(v) for v in values])
        if a.det()==0:raise ValueError("SINGULAR_SYSTEM")
        out=a.inv()*b
        if a*out!=b:raise ValueError("VERIFICATION_FAILED")
        return result(op,", ".join(k+"="+fmt(v) for k,v in zip("xyz",out)),["Determinante = "+fmt(a.det()),"Comprobadas las tres ecuaciones"])
    if op=="binomial_exact":
        n=bounded_int(p.get("n"),0,100);k=bounded_int(p.get("k"),0,n)
        prob=rational(p.get("p"))
        if prob<0 or prob>1:raise ValueError("INVALID_PROBABILITY")
        v=sp.binomial(n,k)*prob**k*(1-prob)**(n-k)
        return result(op,fmt(v),["Probabilidad binomial exacta con fracciones"])
    return {"supported":False,"verified":False,"reason":"UNSUPPORTED_OPERATION"}
