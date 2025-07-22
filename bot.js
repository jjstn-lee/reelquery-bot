import { Client as GradioClient } from "@gradio/client";
import { Client as DiscordClient, GatewayIntentBits } from "discord.js";
import { YtDlp } from 'ytdlp-nodejs';
import dotenv from 'dotenv';

dotenv.config();


const gradioClient = await GradioClient.connect("lixin4ever/VideoLLaMA2");

const ytdlp = new YtDlp();


async function downloadVideo(link) {
  try {
    const output = await ytdlp.downloadAsync(
      link,
      {
        onProgress: (progress) => {
          console.log(progress);
        },
        // others args
      }
    );
    console.log('Download completed:', output);
  } catch (error) {
    console.error('Error:', error);
  }
}

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
    const reelUrl = urlMatch[0];
    message.reply("📥 Downloading the reel...");

    const outPath = `videos/${Date.now()}.mp4`;
    const cmd = `yt-dlp -f best -o "${outPath}" "${reelUrl}"`;

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

