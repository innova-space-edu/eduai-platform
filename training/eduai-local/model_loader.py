"""Native LFM2 loader with explicit compatibility checks for newer Hub metadata."""
def load_native_model(model_id,revision,**kwargs):
    from transformers import AutoConfig,AutoModelForCausalLM
    config=AutoConfig.from_pretrained(model_id,revision=revision,trust_remote_code=False)
    rope=getattr(config,'rope_parameters',None)
    if getattr(config,'model_type',None)=='lfm2' and isinstance(rope,dict):
        if rope.get('rope_type','default')!='default': raise ValueError('Unsupported LFM2 RoPE variant')
        config.rope_theta=rope['rope_theta']
    model,info=AutoModelForCausalLM.from_pretrained(model_id,revision=revision,config=config,trust_remote_code=False,output_loading_info=True,**kwargs)
    if info.get('missing_keys') or info.get('unexpected_keys') or info.get('mismatched_keys'):
        raise RuntimeError('Native checkpoint layout mismatch: '+str({k:info.get(k) for k in ['missing_keys','unexpected_keys','mismatched_keys']}))
    return model
