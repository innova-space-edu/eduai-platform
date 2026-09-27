from __future__ import annotations


def _chat_ids(tokenizer, messages: list[dict], add_generation_prompt: bool) -> list[int]:
    encoded = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=add_generation_prompt,
    )
    if isinstance(encoded, dict):
        encoded = encoded.get("input_ids", [])
    return list(encoded)


def _common_prefix(left: list[int], right: list[int]) -> int:
    limit = min(len(left), len(right))
    index = 0
    while index < limit and left[index] == right[index]:
        index += 1
    return index


def build_assistant_only_labels(
    tokenizer,
    messages: list[dict],
    input_ids: list[int],
) -> list[int]:
    labels = [-100] * len(input_ids)

    try:
        encoded = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=False,
            return_dict=True,
            return_assistant_tokens_mask=True,
        )
        mask = encoded.get("assistant_masks") or encoded.get("assistant_tokens_mask")
        masked_input_ids = list(encoded.get("input_ids") or [])
        if (
            mask
            and len(mask) == len(masked_input_ids)
            and masked_input_ids == input_ids
            and any(mask)
        ):
            return [
                token if bool(is_assistant) else -100
                for token, is_assistant in zip(input_ids, mask)
            ]
    except Exception:
        pass

    for index, message in enumerate(messages):
        if message.get("role") != "assistant":
            continue
        before = _chat_ids(
            tokenizer,
            messages[:index],
            add_generation_prompt=True,
        )
        through = _chat_ids(
            tokenizer,
            messages[: index + 1],
            add_generation_prompt=False,
        )
        start = _common_prefix(input_ids, before)
        end = _common_prefix(input_ids, through)
        if end > start:
            labels[start:end] = input_ids[start:end]

    if all(label == -100 for label in labels):
        raise ValueError(
            "No se pudo localizar ningún span assistant en el chat template."
        )
    return labels
