import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# ==============================
# CONFIG
# ==============================
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
DATASET_DIR = "dataset"

# ==============================
# DATA GENERATOR
# ==============================
datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    validation_split=0.2,
    rotation_range=20,
    zoom_range=0.2,
    horizontal_flip=True
)

train_generator = datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='training'
)

val_generator = datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation'
)

print("\nClass Order:", train_generator.class_indices)

num_classes = train_generator.num_classes
print("Number of classes:", num_classes)

# ==============================
# MODEL BUILDING (Functional API)
# ==============================
base_model = MobileNetV2(
    weights='imagenet',
    include_top=False,
    input_shape=(224, 224, 3)   # MUST be 3 channels
)

base_model.trainable = False  # freeze base model

inputs = tf.keras.Input(shape=(224, 224, 3))
x = base_model(inputs, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dense(128, activation='relu')(x)
x = layers.Dropout(0.5)(x)
outputs = layers.Dense(num_classes, activation='softmax')(x)

model = tf.keras.Model(inputs, outputs)

print("Model output shape:", model.output_shape)
model.summary()

# ==============================
# COMPILE
# ==============================
model.compile(
    optimizer='adam',
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

# ==============================
# TRAIN
# ==============================
history = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=10
)

# ==============================
# SAVE MODEL
# ==============================
model.save("model.h5")

print("\n✅ Model Trained Successfully!")
