"""Contract tests without downloading weights, touching GPUs, or speech samples."""
import io
import unittest
import wave
from unittest.mock import patch

import main


class Tests(unittest.TestCase):
    def test_checkpoint_path_is_required(self):
        with patch.object(main, "MODEL_GCS_URI", ""):
            with self.assertRaisesRegex(RuntimeError, "CHATTERBOX_MODEL_GCS_URI"):
                main.install_verified_weights()

    def test_wav_constraints_checked_before_gpu(self):
        stream = io.BytesIO()
        with wave.open(stream, "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(24000)
            wav.writeframes(bytes(24000 * 2 * 2 * 11))
        with self.assertRaisesRegex(ValueError, "WAV mono"):
            main.generate_audio(stream.getvalue(), "texto")

    def test_model_is_not_pulled_from_external_hub(self):
        import inspect
        src = inspect.getsource(main.initialize)
        self.assertIn("from_local", src)
        self.assertNotIn("from_pretrained(", src)


if __name__ == "__main__":
    unittest.main()
