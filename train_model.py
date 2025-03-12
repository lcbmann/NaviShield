import pandas as pd
from sklearn.model_selection import train_test_split
import tensorflow as tf
from transformers import DistilBertTokenizer
from transformers import TFDistilBertForSequenceClassification


# Load the dataset
df = pd.read_csv('data/phishing_legitimate_full.csv')


# Using only URLs as text
texts = df['URL'].values
labels = df['label'].values


# Split the dataset into training and testing sets
texts_train, texts_test, labels_train, labels_test = train_test_split(
    texts, labels, test_size=0.2, random_state=42
)


# Load DistilBERT tokenizer
tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')    

# Tokenize datasets
train_encodings = tokenizer(list(texts_train), truncation=True, padding=True)
test_encodings = tokenizer(list(texts_test), truncation=True, padding=True)



# Convert encodings to TensorFlow dataset
train_dataset = tf.data.Dataset.from_tensor_slices((
    dict(train_encodings),
    labels_train
)).batch(32)

test_dataset = tf.data.Dataset.from_tensor_slices((
    dict(test_encodings),
    labels_test
)).batch(32)


# Load DistilBERT model
model = TFDistilBertForSequenceClassification.from_pretrained('distilbert-base-uncased', num_labels=2)


# Compile the model
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=5e-5),
    loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
    metrics=['accuracy']
)

# Train the model
model.fit(train_dataset, epochs=3, validation_data=test_dataset)

# Save the model
model.save_pretrained('distilbert_phishing_detector')
tokenizer.save_pretrained('distilbert_phishing_detector')

