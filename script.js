/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

/********************************************************************
 * Real-Time-Person-Removal Created by Jason Mayes 2020.
 *
 * Get latest code on my Github:
 * https://github.com/jasonmayes/Real-Time-Person-Removal
 *
 * Got questions? Reach out to me on social:
 * Twitter: @jason_mayes
 * LinkedIn: https://www.linkedin.com/in/creativetech
 ********************************************************************/

const video = document.getElementById('webcam');
const liveView = document.getElementById('liveView');
const demosSection = document.getElementById('demos');
const DEBUG = false;


// An object to configure parameters to set for the bodypix model.
// See github docs for explanations.
const bodyPixProperties = {
  architecture: 'MobileNetV1',
  outputStride: 16,
  multiplier: 0.75,
  quantBytes: 4
};

// An object to configure parameters for detection. I have raised
// the segmentation threshold to 90% confidence to reduce the
// number of false positives.
const segmentationProperties = {
  flipHorizontal: false,
  internalResolution: 'high',
  segmentationThreshold: 0.9,
  scoreThreshold: 0.2
};


// Render returned segmentation data to a given canvas context.
function processSegmentation(canvas, segmentation) {
  var ctx = canvas.getContext('2d');
  console.log(segmentation)
  // Get data from our overlay canvas which is attempting to estimate background.
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
  
  // Get data from the live webcam view which has all data.
  var liveData = videoRenderCanvasCtx.getImageData(0, 0, canvas.width, canvas.height);
  var dataL = liveData.data;
   
  var minX = 100000;
  var minY = 100000;
  var maxX = 0;
  var maxY = 0;
  
  var foundBody = false;
  
  // Go through pixels and figure out bounding box of body pixels.
  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) {
      let n = y * canvas.width + x;
      // Human pixel found. Update bounds.
      if (segmentation.data[n] !== 0) {
        if(x < minX) {
          minX = x;
        }
        
        if(y < minY) {
          minY = y;
        }
        
        if(x > maxX) {
          maxX = x;
        }
        
        if(y > maxY) {
          maxY = y;
        }
        foundBody = true;
      }
    } 
  }
  
  // Calculate dimensions of bounding box.
  var width = maxX - minX;
  var height = maxY - minY;
  
  // Define scale factor to use to allow for false negatives around this region.
  var scale = 1.3;

  //  Define scaled dimensions.
  var newWidth = width * scale;
  var newHeight = height * scale;

  // Caculate the offset to place new bounding box so scaled from center of current bounding box.
  var offsetX = (newWidth - width) / 2;
  var offsetY = (newHeight - height) / 2;

  var newXMin = minX - offsetX;
  var newYMin = minY - offsetY;
  
  
  // Now loop through update backgound understanding with new data
  // if not inside a bounding box.
  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) {
      // If outside bounding box and we found a body, update background.
      if (foundBody && (x < newXMin || x > newXMin + newWidth) || ( y < newYMin || y > newYMin + newHeight)) {
        // Convert xy co-ords to array offset.
        let n = y * canvas.width + x;

        data[n * 4] = dataL[n * 4];
        data[n * 4 + 1] = dataL[n * 4 + 1];
        data[n * 4 + 2] = dataL[n * 4 + 2];
        data[n * 4 + 3] = 255;            

      } else if (!foundBody) {
        // No body found at all, update all pixels.
        let n = y * canvas.width + x;
        data[n * 4] = dataL[n * 4];
        data[n * 4 + 1] = dataL[n * 4 + 1];
        data[n * 4 + 2] = dataL[n * 4 + 2];
        data[n * 4 + 3] = 255;    
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  
  if (DEBUG) {
    ctx.strokeStyle = "#00FF00"
    ctx.beginPath();
    ctx.rect(newXMin, newYMin, newWidth, newHeight);
    ctx.stroke();
  }
}



// Let's load the model with our parameters defined above.
// Before we can use bodypix class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
var modelHasLoaded = false;
var model = undefined;

model = bodyPix.load(bodyPixProperties).then(function (loadedModel) {
  model = loadedModel;
  modelHasLoaded = true;
  // Show demo section now model is ready to use.
  demosSection.classList.remove('invisible');
});


/********************************************************************
// Continuously grab image from webcam stream and classify it.
********************************************************************/

var previousSegmentationComplete = true;

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia);
}


// This function will repeatidly call itself when the browser is ready to process
// the next frame from webcam.
function predictWebcam() {
  if (previousSegmentationComplete) {
    // Copy the video frame from webcam to a tempory canvas in memory only (not in the DOM).
    videoRenderCanvasCtx.drawImage(video, 0, 0);
    previousSegmentationComplete = false;
    // Now classify the canvas image we have available.
    model.segmentPerson(videoRenderCanvas, segmentationProperties).then(function(segmentation) {
      processSegmentation(webcamCanvas, segmentation);
      previousSegmentationComplete = true;
    });
  }

  // Call this function again to keep predicting when the browser is ready.
  window.requestAnimationFrame(predictWebcam);
}


// Enable the live webcam view and start classification.
function enableCam(event) {
  if (!modelHasLoaded) {
    return;
  }
  
  // Hide the button.
  event.target.classList.add('removed');  
  
  // getUsermedia parameters.
  const constraints = {
    video: true
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    video.addEventListener('loadedmetadata', function() {
      // Update widths and heights once video is successfully played otherwise
      // it will have width and height of zero initially causing classification
      // to fail.
      webcamCanvas.width = video.videoWidth;
      webcamCanvas.height = video.videoHeight;
      videoRenderCanvas.width = video.videoWidth;
      videoRenderCanvas.height = video.videoHeight;
      bodyPixCanvas.width = video.videoWidth;
      bodyPixCanvas.height = video.videoHeight;
      let webcamCanvasCtx = webcamCanvas.getContext('2d');
      webcamCanvasCtx.drawImage(video, 0, 0);
    });
    
    video.srcObject = stream;
    
    video.addEventListener('loadeddata', predictWebcam);
  });
}


// We will create a tempory canvas to render to store frames from 
// the web cam stream for classification.
var videoRenderCanvas = document.createElement('canvas');
var videoRenderCanvasCtx = videoRenderCanvas.getContext('2d');

// Lets create a canvas to render our findings to the DOM.
var webcamCanvas = document.createElement('canvas');
webcamCanvas.setAttribute('class', 'overlay');
liveView.appendChild(webcamCanvas);

// Create a canvas to render ML findings from to manipulate.
var bodyPixCanvas = document.createElement('canvas');
bodyPixCanvas.setAttribute('class', 'overlay');
var bodyPixCanvasCtx = bodyPixCanvas.getContext('2d');
bodyPixCanvasCtx.fillStyle = '#FF0000';

liveView.appendChild(bodyPixCanvas);

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  const enableWebcamButton = document.getElementById('webcamButton');
  enableWebcamButton.addEventListener('click', enableCam);
} else {
  console.warn('getUserMedia() is not supported by your browser');
}
