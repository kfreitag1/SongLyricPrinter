import { printImageToBluetooth } from "../modules/bluetooth.js";
import { createCompleteLyricImage } from "../modules/imagegeneration.js";

const loadingIndicator = document.getElementById("loadingindicator");
const printButton = document.getElementById("printbutton");
const manualLyricsButton = document.getElementById("manuallyricsbutton");
const previewCanvas = document.getElementById("previewcanvas");

let songData; // {title, artist, year, time, albumName, albumImage, lyrics} 

/**
 * Initialize with songData when sent from the background task, or manually entered lyrics
 */
chrome.runtime.onMessage.addListener(async (req, sender, callback) => {
    if (!req) { return; }

    // On initial page load to receive and store song data
    if (req.action === "populate_song_data") {
        songData = req.data;

        // Disable loading indicator
        loadingIndicator.style.display = "none";

        // Enable print/manual lyrics button
        printButton.disabled = false;
        manualLyricsButton.disabled = false;

        await renderScreen();

    // Update lyrics with new manually entered lyrics
    } else if (req.action === "submit_lyrics") {
        songData.lyrics = req.lyrics;
        await renderScreen()
    }
})

/**
 * Renders the screen with the generated image to print.
 * Requires that songData is set.
 */
async function renderScreen() {
    // Render lyric image from stored data
    const lyricImageData = await createCompleteLyricImage(songData);
    const lyricImage = lyricImageData.image;

    // Set print button to the newly generated image
    printButton.onclick = () => {
        printImageToBluetooth(lyricImageData.p5, lyricImage)
    };

    // Set canvas preview to the lyric image
    const p = new p5();
    p.createCanvas(lyricImage.width, lyricImage.height, previewCanvas);
    p.image(lyricImage, 0, 0);
}

/**
 * User requests to manually enter lyrics, send to other screen
 */
manualLyricsButton.addEventListener("click", async () => {
    console.log("IOSHEFOIHSEO");
    await chrome.windows.create({
        url: './lyricpopupscreen/lyricpopupscreen.html',
        type: 'popup', width: 500, height: 700,
        focused: true
    });
});
