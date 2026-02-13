import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'


import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
import sys
import json
import os

IMG_SIZE = (224, 224)

# Load trained model
model = tf.keras.models.load_model("model.h5")

# Must match training folder order
class_labels = ["Water Leakage", "garbage", "pothole"]

label_map = {
    "Water Leakage": "Water Leakage",
    "garbage": "Garbage",
    "pothole": "Damaged Roads"
}

def predict_image(img_path):
    img = image.load_img(img_path, target_size=IMG_SIZE)
    img_array = image.img_to_array(img)
    img_array = preprocess_input(img_array)
    img_array = np.expand_dims(img_array, axis=0)

    predictions = model.predict(img_array, verbose=0)

    predicted_class = np.argmax(predictions[0])
    confidence = float(np.max(predictions[0])) * 100

    raw_label = class_labels[predicted_class]
    display_label = label_map.get(raw_label, raw_label)

    return display_label, confidence


if __name__ == "__main__":
    img_path = sys.argv[1]

    if not os.path.exists(img_path):
        print(json.dumps({"error": "Image not found"}))
        sys.exit(1)

    label, conf = predict_image(img_path)

    result = {
        "label": label,
        "confidence": round(conf, 2)
    }

    print(json.dumps(result))
