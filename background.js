/**
 * Event listener to respond to actions from the main screen
 */
chrome.runtime.onMessage.addListener((req, sender, callback) => {
    if (!req) { return; }

    // Request to start the print song routine
    if (req.action === "print_song") {
        printSongRoutine();

    // Manually entered lyrics were set, store them
    } else if (req.action === "submit_lyrics") {
        manuallyEnteredLyrics = req.lyrics;

    // New song is shown, remove any previously set manual lyrics
    } else if (req.action === "reset") {
        manuallyEnteredLyrics = null;
    }
})

/**
 * Scrapes the spotify track webpage to get data about the song and album
 * @returns object containing song data
 */
function getSongData() {
    const titleElement = document.getElementsByClassName('encore-text-headline-large')[0];
    const songDataContainer = titleElement.parentElement.parentElement.parentElement;

    let albumImage = songDataContainer.getElementsByTagName("img")[0].src;
    let title = songDataContainer.lastChild.childNodes[1].firstChild.innerText;

    let extraInfoContainer = songDataContainer.lastChild.lastChild;
    let artist = extraInfoContainer.childNodes[0].lastChild.lastChild.innerText;
    let albumName = extraInfoContainer.childNodes[2].lastChild.innerText;
    let year = extraInfoContainer.childNodes[4].innerText;
    let time = extraInfoContainer.childNodes[6].innerText;

    return {
        title,
        artist,
        year,
        time,
        albumName,
        albumImage
    };
}

/**
 * Scrapes Google search result for the given song descriptors to get lyrics
 * @param title Song title
 * @param artist Song artist
 * @param albumName Song album name
 * @return Promise that will resolve to either the lyrics or an empty string
 *         if the lyric scraping was unsuccessful
 */
async function scrapeSongLyricsFromGoogle(title, artist, albumName) {

    /**
     * Removes any characters that would cause issues with the Google search query
     * @param str String to remove characters from
     * @return Modified string without error-prone characters
     */
    function cleanSearchTerm(str) {
        str = str.replace(/[\.&^#@!*%[\]{}|\\/<>?'";:`~]/g, "");
        str = str.trim().replace(/\s+/g, "+");
        return str;
    }

    // Remove any characters that would mess up the Google search
    title = cleanSearchTerm(title);
    artist = cleanSearchTerm(artist);
    albumName = cleanSearchTerm(albumName);

    // Construct google search term and fetch text results
    const searchTerm = `https://www.google.com/search?q=${title}+${albumName}+${artist}+lyrics`;
    const googleSearch = await fetch(searchTerm);
    const searchDocumentText = await googleSearch.text();

    /**
     * Extract the lyrics from the Google search page DOM
     * @param documentText HTML page text extracted from fetch
     * @return Either text of lyrics if present, or an empty string
     */
    function readLyricsFromDOM(documentText) {
        const parser = new DOMParser();
        const htmlDocument = parser.parseFromString(documentText, "text/html");
        const lyricContainer = htmlDocument.documentElement.querySelectorAll(
            "div[jsname='WbKHeb']"
        )[0];

        try {
            let lyrics = "";
            lyricContainer.childNodes.forEach((child) => {
                if (lyrics !== "") { lyrics += "\n" }

                child.childNodes.forEach((line) => {
                    if (line.tagName === "SPAN") {
                        lyrics += line.innerText + "\n";
                    }
                });
            });

            return lyrics;
        } catch (error) {
            // If any errors are present, then the lyrics DOM element does not exist
            return "";
        }
    }

    // Need to execute the DOM searching from the main Chrome window since
    // need special permissions that are not given to background scripts
    return await executeOnMainScreen(readLyricsFromDOM, [searchDocumentText]);
}

// Song and lyric data to print
let songData;
let manuallyEnteredLyrics = null;

/**
 * Starts the song print routine: scrapes all song data, shows page to print.
 */
async function printSongRoutine() {
    songData = await executeOnMainScreen(getSongData);

    let scrapedLyrics = await scrapeSongLyricsFromGoogle(
        songData.title, songData.artist, songData.albumName);

    // Couldn't scrape lyrics, need to manually get it from the user
    if (scrapedLyrics.trim() === "" && manuallyEnteredLyrics === null) {
        await chrome.windows.create({
            url: './lyricpopupscreen/lyricpopupscreen.html',
            type: 'popup', width: 500, height: 700,
            focused: true
        });

        return; // Exit routine without going to preview screen

    // Manually entered lyrics are here, can insert into songData object
    } else if (manuallyEnteredLyrics !== null) {
        songData.lyrics = manuallyEnteredLyrics.trim();

    // Scraped lyrics are good, can use them
    } else {
        songData.lyrics = scrapedLyrics.trim();
    }

    // Open preview screen
    await chrome.windows.create({
        url: './previewscreen/previewscreen.html',
        type: 'normal', width: 400, height: 600,
        focused: true, left: 300, top: 100
    });

    // Send data to the popup, after a little delay to ensure page is loaded
    setTimeout(() => {
        chrome.runtime.sendMessage({
            action: "populate_song_data",
            data: songData
        });
    }, 800);
}

/**
 * Executes the given function on the main Chrome page for extra permissions.
 * @param fn Function to execute
 * @param args List of any function arguments
 * @return Promise that resolves to whatever the function returns
 */
async function executeOnMainScreen(fn, args=[]) {
    // Get the current tab or exit with an error
    let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) {
        console.error("TAB WAS UNDEFINED, THIS IS BAD AND UNEXPECTED");
        return;
    }

    // Run function on main tab and return result
    return (await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fn,
        args: args
    }))[0].result;
}