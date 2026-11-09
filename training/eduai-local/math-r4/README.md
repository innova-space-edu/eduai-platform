# EDUAI: exact mathematics + R4

## What changed
- Deterministic TypeScript rational solver: arithmetic, linear equations, 2x2 systems, percentages, Euler and modular recurrences. Strict numeric bounds, exact checks; no arbitrary execution.
- Authenticated POST /api/agents/math-exact. Optional typed SymPy service for quadratics, polynomial differentiation/integration, linear systems 3x3, exact binomial probabilities.
- Existing Math Agent invokes the local verifier for supported prompts; otherwise retains its AI gateway flow. In unsupported cases it does NOT claim a verified exact answer.
- ChatClaw tool solve_math_exact, enabled only with EDUAI_EXACT_MATH_ENABLED=true.
- R4 curriculum generator (trace + final answer), fresh evaluation seeds, an explicit 3-training-seed Kaggle LoRA runner with validation-only model selection and legacy regression checks. No training or production promotion is automatic.

## Safe deployment
1. Review and merge this branch after CI.
2. The local verifier in /api/agents/matematico uses no external dependencies. Test with an authenticated user: "Resuelve -2x+(-24)=12".
3. The optional SymPy service runs outside Vercel. In services/eduai-math-engine run unit tests and configure Docker Compose with a strong EDUAI_MATH_ENGINE_TOKEN. Keep its port on loopback behind trusted HTTPS proxy; do not expose directly.
4. In the Next.js server, set EDUAI_MATH_ENGINE_URL to a fixed HTTPS address; set same EDUAI_MATH_ENGINE_TOKEN. The endpoint never takes a URL from the request.
5. Set EDUAI_EXACT_MATH_ENABLED=true to expose the exact tool in ChatClaw after functional tests; restart/redeploy. No database migrations needed.

## Tests
    node --experimental-strip-types --input-type=module -e "import {solveExactMath} from './lib/math/exact-solver.ts'; console.log(solveExactMath({operation:'linear',a:-2,b:-24,c:12}));"
    cd services/eduai-math-engine && python -m unittest -v test_solver
    python -m unittest discover -s training/eduai-local/math-r4 -p test_*.py

## Kaggle same-notebook R4
The R4 source is NOT yet published to Kaggle. Earlier R2 remains the experimental baseline. Preserve the R3 outputs separately.

    python training/eduai-local/math-r4/build_kaggle_bundle.py --out /tmp/eduai-r4-same-notebook
    # On Dell, use the existing authenticated CLI wrapper (no new notebook):
    ./kaggle-v225.sh kernels push -p /tmp/eduai-r4-same-notebook --accelerator NvidiaTeslaT4
    ./kaggle-v225.sh kernels status esthefano/eduai-nano-lite-refuerzo-corto-v4

If running via the Dell bridge container, copy the folder into its accessible /data directory and use its own path with kaggle-v225.sh. No hardcoded host secret.

R4 will run 3 training seeds per profile (41011,42011,43011) and 3 *separate* evaluation seeds (44021,44031,44041), starting from R2 adapters available in private esthefano/eduai-nano-lite-adapters-r2. It saves only the best validation-loss seed per profile. Each profile report includes baseline and candidate, retention on protected R2/V4 tests, and a conservative preferredOnSyntheticGate. productionReady remains false even if all pass.

**Caveat:** R4 examples are verified, but largely synthetic templates; independent structural-family benchmarks, human scoring, privacy/abuse tests, staging integration, production performance, and GPU execution are still required. The old R2/V4 tests have already influenced prior selection, so cannot serve as fresh final benchmarks. GRPO/reward optimization should be an optional later experiment only after supervised R4 demonstrates transfer.
