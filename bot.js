import { Client as GradioClient } from "@gradio/client";
import { Client as DiscordClient, GatewayIntentBits } from "discord.js";
import { YtDlp } from 'ytdlp-nodejs';
import dotenv from 'dotenv';

dotenv.config();

import { createWorker } from 'tesseract.js';

const gradioClient = await GradioClient.connect("lixin4ever/VideoLLaMA2");

const ytdlp = new YtDlp();

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

  // Format: YYYY-MM-DD-HH-MM-SS-MS  (colons replaced with dashes)
  return `${year}-${month}-${day}-${hour}-${minute}-${second}-${ms}`;
}

async function downloadVideo(link) {
  try {
    const output = await ytdlp.downloadAsync(
      link,
      {
        onProgress: (progress) => {
          console.log(progress);
        },
        output: `./downloads/${getFormattedDate()}.%(ext)s`,
      }
    );
    console.log('Download completed:', output);
    return true;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

(async () => {
  const worker = await createWorker('eng');
  const ret = await worker.recognize('https://tesseract.projectnaptha.com/img/eng_bw.png');
  console.log(ret.data.text);
  await worker.terminate();
})();

downloadVideo("https://www.instagram.com/reel/DMXQEJzpL5F/?utm_source=ig_web_copy_link");


// const result = await gradioClient.predict("/generate", { 
// 				image: exampleImage, 
// 				video: exampleVideo, 		
// 		chatbot: [["Hello!",None]], 		
// 		textbox_in: "Hello!!", 		
// 		temperature: 0.1, 		
// 		top_p: 0, 		
// 		max_output_tokens: 64, 
// });

// console.log(result.data);

const discordClient = new DiscordClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

discordClient.on('ready', () => {
  console.log(`🤖 Logged in as ${discordClient.user.tag}`);
});

discordClient.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // regex matching for insta reel
  const urlMatch = message.content.match(/https:\/\/www\.instagram\.com\/reel\/[\w-]+/);
  if (urlMatch) {
    message.reply("📥 Downloading the reel...");

    // const outPath = `videos/${Date.now()}.mp4`;
    // const cmd = `yt-dlp -f best -o "${outPath}" "${reelUrl}"`;

    // entire matched string; don't wanna use message.content here just in case of some regex bs where urlMatch is true but message.content isn't the URL or smthng
    url = urlMatch[0];
    downloadVideo(url);





    
    exec(cmd, async (err) => {
      if (err) {
        console.error(err);
        message.reply("❌ Failed to download the video.");
        return;
      }

      message.reply("📊 Vectorizing...");
      const python = exec(`python3 vectorizer.py "${outPath}"`);

      python.stdout.on('data', (data) => {
        console.log(`Vectorizer: ${data}`);
      });

      python.on('close', (code) => {
        message.reply(code === 0 ? "✅ Reel vectorized and stored." : "❌ Vectorization failed.");
        fs.unlinkSync(outPath); // optional: clean up
      });
    });
  }
});






discordClient.login(process.env.DISCORD_TOKEN);

