import { Client as GradioClient } from "@gradio/client";
import { Client as DiscordClient, GatewayIntentBits } from "discord.js";
import { YtDlp } from 'ytdlp-nodejs';

import { exec } from 'child_process';
import { promisify } from 'util';

import cv from '@u4/opencv4nodejs';

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// establish clients/workers from APIs; discord bot login after defining its handlers
const gradioClient = await GradioClient.connect("lixin4ever/VideoLLaMA2");
const ytdlp = new YtDlp();
const discordClient = new DiscordClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// establish tesseract.js (OCR) helper functions
async function initWorker() {
    const worker = await createWorker('eng');
    await worker.setParameters({
        tessedit_pageseg_mode: '6'
    });
    return worker;
}
// image might fail; FIXME: ADD AN ERROR CATCH
async function recognizeImage(image) {
    console.log(`in recognizeImage(), image: ${image}...`);
    const worker = await initWorker();

    const img = cv.imread(image);
    console.log("after cv.imread()...")
    // preprocess image
    const gray = img.bgrToGray();               
    const blurred = gray.gaussianBlur(new cv.Size(5, 5), 1.5);
    const thresholded = blurred.threshold(0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    console.log("after preprocessing...")

    // save preprocessed image
    const parsed = path.parse(image);
    const newFileName = `${parsed.name}_processed${parsed.ext}`;
    const processedPath = path.join(parsed.dir, newFileName);
    const processed = thresholded.cvtColor(cv.COLOR_GRAY2BGR);
    cv.imwrite(processedPath, processed);

    if (!fs.existsSync(processedPath)) {
      throw new Error('❌ Failed to write processed image');
    }
    console.log('✅ Image successfully saved:', processedPath);

    const processed_result = await worker.recognize(processedPath);
    const normal_result = await worker.recognize(image);
    console.log("after recognizing images...");

    await worker.terminate();
    console.log("after terminating worker, returning...");
    
    return {
      processed_result: processed_result.data.text,
      normal_result: normal_result.data.text,
    }
}


async function stopWorker() {
    if (worker) {
        await worker.terminate();
        worker = null;
    }
}

// return date in format: YYYY-MM-DD-HH-MM-SS-MS
function getFormattedDate() {
  const now = new Date();

  const pad = (num, size = 2) => String(num).padStart(size, '0');

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);   // months are 0-based
  const day = pad(now.getDate());

  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  const ms = pad(now.getMilliseconds(), 3);

  return `${year}-${month}-${day}-${hour}-${minute}-${second}-${ms}`;
}

async function downloadVideo(link, movieFile) {
  try {
    const output = await ytdlp.downloadAsync(
      link,
      {
        onProgress: (progress) => {
          console.log(progress);
        },
        output: movieFile,
      }
    );
    console.log('Download completed:', output);
    return {
        success: true,
        file: output,
    }
  } catch (error) {
    console.error('Error:', error);
    return {
        success: false,
        error: error.message,
    }
  }
}


const execPromise = promisify(exec);
async function extractFrames(inputFile, outputDir) {
  const fps = process.env.FPS || 1;
  const outputPath = path.join(outputDir, 'frame_%04d.png');
  const ffmpeg_cmd = `ffmpeg -i "${inputFile}" -vf fps=${fps} "${outputPath}"`;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const { stdout, stderr } = await execPromise(ffmpeg_cmd);
    console.log(`✅ Frames extracted to ${outputDir} at ${fps} fps`);
    if (stderr) console.error(`⚠️ FFmpeg stderr: ${stderr}`);
  } catch (error) {
    console.error(`❌ Error extracting frames: ${error.message}`);
  }
}

discordClient.on('ready', () => {
  console.log(`🤖 Logged in as ${discordClient.user.tag}`);
});

// performs OCR on every frame image in the passed in directory
async function ocrOnFrames(files) {
    // console.log(`in ocrOnFrames: files=${files}`);

    const ocrPromises = files.map(file => recognizeImage(file));
    const ocr_results = await Promise.all(ocrPromises); 
    console.log("in ocrOnFrames, all promises fullfilled; printing ocr_results below")
    
    ocr_results.forEach(result => {
      console.log(`processed: ${result.processed_result}, normal: ${result.normal_result}`);
    });
    
    return ocr_results;
}

// used to delete original movie file, just to keep things nice and neat
async function deleteFile(file) {
  try {
    await fs.promises.unlink(file);
    console.log(`File ${file} has been successfully removed.`);
  } catch (err) {
    console.error(`Error removing file: ${err}`);
  }
}

discordClient.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // regex matching for insta reel
  const urlMatch = message.content.match(/https:\/\/www\.instagram\.com\/reel\/[\w-]+/);
  if (urlMatch) {
    message.reply("📥 Downloading the reel...");

    // entire matched string; don't wanna use message.content here just in case of some regex bs where urlMatch is true but message.content isn't the URL or smthng
    const url = urlMatch[0];
    // unique time will act as the directory and file name
    const id = getFormattedDate();
    const movieDir = `./downloads/${id}`;
    fs.mkdirSync(movieDir, { recursive: true });

    // 'let' because yt-dlp doesn't return which video extension it uses, thus need to change later
    let movieFile = `./downloads/${id}/${id}.%(ext)s`;

    const downloadResult = await downloadVideo(url, movieFile);
    if (downloadResult.success) {
        console.log("SUCCESS in downloading reel, continuing...")
    } else {
        // if failed, don't attempt processing rest
        console.log("FAILED in downloading reel, returning early...")
        return;
    }

    // declare files as list of files in the movie's directory
    let files = [];
    try {
        files = fs.readdirSync(movieDir);  
    } catch (err) {
        console.log(`error in declaring files for ${movieDir}`)
    }

    // need to do this because yt-dlp doesn't return which extension it chose
    movieFile = files.find(file => file.startsWith(id));
    if (!movieFile) {
        throw new Error('downloaded movie file not found');
    }
    movieFile = path.join(movieDir, movieFile)



    await extractFrames(movieFile, movieDir);

    // DEBUG PRINTING
    // let files = []
    // try {
    //     files = fs.readdirSync(`${movieDir}`);
    //     console.log(`Files in ${movieDir}`);
    //     files.forEach(file => {
    //         console.log(file); // Or perform operations on the file
    //     });
    // } catch (err) {
    //     console.error('Error reading directory:', err);
    // }



    // readdirSync doesn't capture updates to the directory
    await deleteFile(movieFile);
    movieFile = null;
    files = fs.readdirSync(movieDir);  

    const framePaths = files.map(file => path.join(movieDir, file));
    await ocrOnFrames(framePaths);
    console.log("after calling ocrOnFrames")
  }
});

discordClient.login(process.env.DISCORD_TOKEN);