import io
import os

os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
from flask import Flask, jsonify, render_template, request
from PIL import Image, UnidentifiedImageError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KERAS_PATH = os.path.join(BASE_DIR, "..", "models", "best.keras")
ONNX_PATH = os.path.join(BASE_DIR, "model", "neuroscan.onnx")
IMAGE_SIZE = 224
# Same order as sorted(os.listdir(train_dir)) in the notebook
CLASS_NAMES = ["Glioma", "Healthy", "Meningioma", "Pituitary Macroadenoma"]
MAX_UPLOAD_BYTES = 8 * 1024 * 1024

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES


def load_predictor():
    """Return (backend name, function) mapping a (1, 224, 224, 3) float32 batch of raw pixels to probabilities.

    Uses the Keras model when TensorFlow is installed (local use). Otherwise it falls back to the ONNX
    export with ONNX Runtime, which is small enough for serverless hosts such as Vercel.
    Set NEUROSCAN_BACKEND=onnx or NEUROSCAN_BACKEND=keras to force one of them.
    """
    forced = os.environ.get("NEUROSCAN_BACKEND", "").lower()
    if forced != "onnx":
        try:
            import tensorflow as tf
        except ImportError:
            if forced == "keras":
                raise
        else:
            keras_model = tf.keras.models.load_model(KERAS_PATH, compile=False)
            return "keras", lambda batch: keras_model.predict(batch, verbose=0)[0]

    import onnxruntime as ort

    session = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    return "onnx", lambda batch: session.run(None, {input_name: batch})[0][0]


BACKEND, predict_probs = load_predictor()


def preprocess(raw_bytes):
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE))
    return np.expand_dims(np.asarray(img, dtype="float32"), axis=0)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/scan")
def scan_page():
    return render_template("scan.html")


@app.route("/analytics")
def analytics_page():
    return render_template("analytics.html")


@app.route("/classes")
def classes_page():
    return render_template("classes.html")


@app.route("/model")
def model_page():
    return render_template("model.html")


@app.route("/healthz")
def healthz():
    return jsonify(status="ok", backend=BACKEND)


@app.route("/predict", methods=["POST"])
def predict():
    file = request.files.get("image")
    if file is None or file.filename == "":
        return jsonify(error="No image uploaded."), 400
    try:
        batch = preprocess(file.read())
    except (UnidentifiedImageError, OSError):
        return jsonify(error="That file is not a readable image."), 400

    probs = predict_probs(batch)
    top = int(np.argmax(probs))
    return jsonify(
        label=CLASS_NAMES[top],
        confidence=float(probs[top]),
        probabilities={name: float(p) for name, p in zip(CLASS_NAMES, probs)},
    )


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="Image is larger than 8 MB."), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
