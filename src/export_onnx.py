"""Export the trained Keras model to ONNX so the website can run it in the browser.

Strips the training-only augmentation layers, converts with tf2onnx and checks that the
ONNX output matches Keras. Output: website/public/model/neuroscan.onnx (served as a static file
and executed by onnxruntime-web on the demo page).

Run:  pip install tf2onnx onnx onnxruntime  &&  python src/export_onnx.py
"""
import os

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import numpy as np
import onnxruntime as ort
import tensorflow as tf
import tf2onnx

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MODEL_PATH = os.path.join(ROOT, "models", "best.keras")
OUT_PATH = os.path.join(ROOT, "website", "public", "model", "neuroscan.onnx")
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

model = tf.keras.models.load_model(MODEL_PATH, compile=False)

# Inference-only graph: raw 0-255 RGB in, 4 class probabilities out (rescaling is inside the model)
inp = tf.keras.Input((224, 224, 3), name="input")
x = inp
for layer in model.layers[1:]:
    if layer.name == "augment":
        continue
    x = layer(x)
infer = tf.keras.Model(inp, x)

fn = tf.function(lambda t: infer(t, training=False))
spec = (tf.TensorSpec((None, 224, 224, 3), tf.float32, name="input"),)
tf2onnx.convert.from_function(fn, input_signature=spec, opset=13, output_path=OUT_PATH)

# Parity check against Keras
sample = np.random.RandomState(1).randint(0, 255, (2, 224, 224, 3)).astype("float32")
sess = ort.InferenceSession(OUT_PATH)
onnx_out = sess.run(None, {sess.get_inputs()[0].name: sample})[0]
diff = float(np.abs(onnx_out - infer.predict(sample, verbose=0)).max())
print(f"wrote {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1e6:.1f} MB), max diff vs Keras: {diff:.2e}")
assert diff < 1e-4, "ONNX output does not match Keras"
