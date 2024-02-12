let lyricsField = document.getElementById("lyricsfield");
let submitButton = document.getElementById("submitbutton");

/**
 * Send manually entered lyrics to other processes when complete
 */
submitButton.addEventListener("click", async () => {
    let lyrics = lyricsField.value;

    await chrome.runtime.sendMessage({
        action: "submit_lyrics",
        lyrics: lyrics
    });

    window.close();
});