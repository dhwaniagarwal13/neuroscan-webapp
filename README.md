# NeuroScan web app

Flask app that classifies a brain MRI into glioma, meningioma, pituitary macroadenoma or healthy
using a fine-tuned MobileNetV2 model (86.9% test accuracy on 229 held-out images).
For research and education only, not a medical device.

The model, training code and report live in the main project:
https://github.com/dhwaniagarwal13/Brain-tumor-detection-colab

## Run

```
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd webapp
python app.py
```

Open http://127.0.0.1:5000 and upload an MRI slice (JPG or PNG, up to 8 MB).

## Layout

- `webapp/app.py` Flask server and `/predict` endpoint
- `webapp/templates`, `webapp/static` front end
- `models/best.keras` trained model (raw 0-255 pixels in, rescaling is inside the model)
