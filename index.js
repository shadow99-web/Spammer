console.log("--- SCRIPT STARTING ---");
const { Client } = require("discord.js-selfbot-v13");
const fs = require("fs-extra");
const chalk = require("chalk");
const { tokens } = require("./tokens.js");
const config = require("./config.json");
const http = require("http");

const version = "3.2.1-optimizado";

// ===== KEEP-ALIVE SERVER (Fixes Launch Timeout) =====
http.createServer((req, res) => {
  res.write('Spammer is active and healthy!');
  res.end();
}).listen(7860);

// ===== DELAYS FIJOS (ÓPTIMOS) =====
const RETRY_DELAY = 15000; // 15s para reintentos (fijo)
const ACCOUNT_START_DELAY = 3000; // 3s entre cuentas (fijo)
const COOLDOWN_PERIOD = 5 * 60 * 1000; // 5 minutos en milisegundos

// Variables globales para controlar el estado
let isGlobalCooldown = false;
let activeClients = [];

// ===== FUNCIÓN DELAY ALEATORIO (desde config.json) =====
function getRandomDelay() {
  const min = Number(config.Spamming?.MinDelay) || 1500; // Default: 1.5s
  const max = Number(config.Spamming?.MaxDelay) || 4000; // Default: 4s
  return Math.floor(Math.random() * (max - min)) + min;
}

// Función para desconectar todas las cuentas
async function pauseAllSpam() {
  if (isGlobalCooldown) return;
  
  isGlobalCooldown = true;
  const pauseMin = Math.floor(COOLDOWN_PERIOD / 60000);
  console.log(chalk.yellow.bold(`\n[!] Rate limit detected. Pausing spam for ${pauseMin} minutes (Bots staying online)...`));
  
  // We DO NOT destroy the clients here. They stay connected but idle.
  
  setTimeout(() => {
    console.log(chalk.green.bold(`\n[↻] Pause finished. Resuming Relay...`));
    isGlobalCooldown = false;
    // The masterRelay loop will automatically start sending again 
    // because it checks 'isGlobalCooldown' every few seconds.
  }, COOLDOWN_PERIOD);
}



async function sendMessageSafe(channel, message) {
  try {
    // If we are currently in a pause, don't even try to send
    if (isGlobalCooldown) return false;

    await channel.send(message);
    return true;
  } catch (err) {
    // 429 = Rate Limit | 500 = Discord Server Error
    if (err.code === 429 || err.code === 500) {
      if (!isGlobalCooldown) {
        await pauseAllSpam(); 
      }
      return false;
    }
    console.log(chalk.red(`[✗] Error (${err.code}): ${err.message}`));
    return false;
  }
}



let lastMessageSent = "";

async function startAllAccounts() {
  // 1. Coordinated Login
  for (let i = 0; i < tokens.length; i++) {
    const tokenData = tokens[i];
    const client = new Client({ checkUpdate: false });
    try {
      await client.login(tokenData.token);
      console.log(chalk.cyan(`✅ ${client.user.tag} conectado (Cuenta ${i+1})`));
      client.user.setStatus("invisible");
      activeClients.push({ client, channelIds: tokenData.channelIds });
      await new Promise(r => setTimeout(r, ACCOUNT_START_DELAY));
    } catch (err) {
      console.log(chalk.red(`❌ Error en login cuenta ${i+1}: ${err.message}`));
    }
  }

  // 2. The Team Relay Loop
  let currentAccIndex = 0;
  const messages = fs.readFileSync("./messages.txt", "utf-8").split("\n").filter(m => m.trim().length > 0);

  const masterRelay = async () => {
    if (isGlobalCooldown) return setTimeout(masterRelay, 5000);
    if (activeClients.length === 0) return;

    const currentData = activeClients[currentAccIndex];
    const channelId = currentData.channelIds[0];
    
    try {
      const channel = await currentData.client.channels.fetch(channelId);
      
      // Unique Sentence Logic
      let message = messages[Math.floor(Math.random() * messages.length)];
      while (message === lastMessageSent && messages.length > 1) {
        message = messages[Math.floor(Math.random() * messages.length)];
      }
      lastMessageSent = message;

      // Uses your original safety function
      const sent = await sendMessageSafe(channel, message);
      
      if (sent) {
        // Procedural Delay for 24s spawns
        const delay = 1100 + Math.floor(Math.random() * 400); 
        currentAccIndex = (currentAccIndex + 1) % activeClients.length;
        setTimeout(masterRelay, delay);
      } else {
        setTimeout(masterRelay, RETRY_DELAY);
      }
    } catch (err) {
      console.log(chalk.yellow(`[!] Relay Error: ${err.message}`));
      setTimeout(masterRelay, RETRY_DELAY);
    }
  };
  masterRelay();
}



// Iniciar todas las cuentas al principio
startAllAccounts();

// ===== MANEJO DE ERRORES =====
process.on("unhandledRejection", (err) => {
  console.log(chalk.yellow("[⚠] Error no manejado:"), err.message);
  if (!isGlobalCooldown && (err.code === 429 || err.code === 500)) {
    pauseAllSpam();
  }
});

process.on("uncaughtException", (err) => {
  console.log(chalk.red("[‼] Error crítico:"), err.message);
  if (!isGlobalCooldown) {
    pauseAllSpam();
  }
});