import path from 'path';
import tf from '@tensorflow/tfjs-node';
import jpeg from 'jpeg-js';

async function loadAndRunModel() {
const MODEL_PATH = 'file://./frozen_east_text_detection_tfjs/model.json'; // Or 'file:///path/to/your/saved_model_directory' for SavedModel

function preprocessImageWithPadding(imagePath, modelSize = 512) {
  const buf = fs.readFileSync(imagePath);
  const pixels = jpeg.decode(buf, true);
  const { width, height, data } = pixels;

  // Create tensor
  let imageTensor = tf.tensor3d(data, [height, width, 3], 'int32');

  // Resize with aspect ratio preserved
  const scale = Math.min(modelSize / width, modelSize / height);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  imageTensor = tf.image.resizeBilinear(imageTensor, [newHeight, newWidth]);

  // Pad to square
  const padTop = Math.floor((modelSize - newHeight) / 2);
  const padBottom = modelSize - newHeight - padTop;
  const padLeft = Math.floor((modelSize - newWidth) / 2);
  const padRight = modelSize - newWidth - padLeft;

  const padded = tf.pad(imageTensor, [
    [padTop, padBottom],
    [padLeft, padRight],
    [0, 0]
  ], 0); // Padding with 0 (black)

  const input = padded.div(255.0).expandDims(0); // [1, 512, 512, 3]

  return {
    tensor: input,
    scale,
    pad: { top: padTop, left: padLeft },
    originalSize: { width, height },
    resizedSize: { width: newWidth, height: newHeight }
  };
}


try {
    const model = await tf.loadGraphModel(MODEL_PATH);
    console.log('Model loaded successfully!');

    // Example: Perform inference (replace with your actual input data)
    const inputTensor = tf.zeros([1, 224, 224, 3]); // Example input shape
    const prediction = model.predict(inputTensor);
    prediction.print();

    } catch (error) {
        console.error('Error loading or running model:', error);
    }
}

loadAndRunModel();