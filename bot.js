require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages] });
const app = express();
const PORT = process.env.PORT || 3000;

client.on('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

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

client.login(process.env.DISCORD_TOKEN);

// Optionally serve health check
app.get('/', (_, res) => res.send('🤖 Bot is running'));
app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));
