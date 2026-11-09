# Optional GRPO math reward experiment (after SFT)

The default R4 campaign uses supervised fine-tuning only. Reward-based optimization is NOT started, and these functions must not use held-out evaluation labels for updates.

- correctness_reward: exact answer matching using Python Fraction and strict boolean labels.
- format_reward: optional small bonus when the model gives an explicit final-answer marker.
- Model training must start fresh from a frozen approved adapter and use only separately generated training prompts.
- Compare with SFT-only under the same fixed independent evaluation and R2/V4 regression controls.
- Never reward unverified chains of reasoning; exact final correctness does not prove that intermediate text is correct.
- Training with GRPO is an optional controlled experiment subject to available GPU time, package compatibility and administrator review.

TRL GRPO expects completion strings or messages and supports custom reward functions. See the installed TRL version documentation before wiring a real trainer.
