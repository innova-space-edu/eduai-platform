"""Native fast tokenizer loader; normalize Transformers-5 metadata for 4.57."""
def load_tokenizer(model,revision):
    from transformers import AutoTokenizer,PreTrainedTokenizerFast
    try:
        return AutoTokenizer.from_pretrained(model,revision=revision,trust_remote_code=False)
    except ValueError as error:
        if 'Tokenizer class TokenizersBackend' not in str(error): raise
        # Read only tokenizer artifacts. Do not pass the newer metadata wholesale
        # to 4.x: extra_special_tokens changed from a dict to a list in v5.
        import json
        from pathlib import Path
        from huggingface_hub import hf_hub_download
        config=json.loads(Path(hf_hub_download(model,'tokenizer_config.json',revision=revision)).read_text())
        def token(value): return value.get('content') if isinstance(value,dict) else value
        kwargs={key:token(config[key]) for key in ['bos_token','eos_token','pad_token','unk_token','sep_token','cls_token','mask_token'] if config.get(key) is not None}
        extras=config.get('additional_special_tokens') or []
        extra=config.get('extra_special_tokens') or []
        if isinstance(extra,dict): extra=list(extra.values())
        extras=[token(value) for value in list(extras)+list(extra)]
        kwargs['additional_special_tokens']=list(dict.fromkeys(v for v in extras if isinstance(v,str)))
        template=config.get('chat_template')
        if not isinstance(template,str):
            template=Path(hf_hub_download(model,'chat_template.jinja',revision=revision)).read_text()
        tokenizer=PreTrainedTokenizerFast(tokenizer_file=hf_hub_download(model,'tokenizer.json',revision=revision),chat_template=template,**kwargs)
        tokenizer.model_input_names=['input_ids','attention_mask']
        if not tokenizer.chat_template or tokenizer.eos_token_id is None: raise ValueError('Tokenizer lacks chat template or EOS')
        return tokenizer
