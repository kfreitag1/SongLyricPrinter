import { PRINT_WIDTH_BYTES } from "./bluetooth.js";

// ----------------------------------------------------------------------------
// Public methods
// ----------------------------------------------------------------------------

// Returns a p5 instance and Image of the complete lyric image
export const createCompleteLyricImage = async (songData) => {
    let p = new p5();

    // Import fonts, wait to load
    const loadFont = async (filepath) => {
        return new Promise((res, _) => { p.loadFont(filepath, res) });
    }

    const font_sans = await loadFont("../assets/fonts/LeagueSpartan-SemiBold.ttf");
    // let font_serif_reg = await loadFont("../assets/fonts/LibreBaskerville-Regular.ttf");
    const font_serif_bold = await loadFont("../assets/fonts/LibreBaskerville-Bold.ttf");
    const font_serif_italic = await loadFont("../assets/fonts/LibreBaskerville-Italic.ttf");

    // Main graphics canvas to draw on
    const WIDTH = 8 * PRINT_WIDTH_BYTES;
    let height = 0; // Variable current height while building lyric page

    let g = p.createGraphics(WIDTH, 10000); // TODO: Increase max height if needed
    g.pixelDensity(1); // Set standard pixel density to avoid copying high DPI screens
    g.background(255); // White background

    // Draw album art
    let imgSize = WIDTH - 80;
    let albumImg = await getDitheredImageFromUrl(p, songData.albumImage, imgSize, imgSize);
    g.image(albumImg, (WIDTH - imgSize)/2, height); // Place centered on page
    height += imgSize;
    height += 5;

    // Draw title
    g.textFont(font_sans);
    height += drawWrappedText(p, g, height, songData.title, p.CENTER, 45);
    height += 15;

    // Draw album name
    g.textFont(font_serif_italic);
    height += drawWrappedText(p, g, height, songData.albumName, p.CENTER, 25, 0, 15);
    height += 15;

    // Draw artist, year
    g.textFont(font_serif_bold);
    drawWrappedText(p, g, height, songData.year, p.RIGHT, 16); // Same line as artist
    height += drawWrappedText(p, g, height, songData.artist, p.LEFT, 16);
    height += 20; 

    // Draw lyrics
    g.textFont(font_serif_bold);
    let splitLyrics = songData.lyrics.split("\n");
    for (let i = 0; i < splitLyrics.length; i++) {
        let lyric = splitLyrics[i].trim();
        if (lyric === "") {
            height += 15;
            continue;
        }

        // Draw lyric with indenting
        height += drawWrappedText(p, g, height, lyric, p.LEFT, 17, 20);
        height += 8;
    }

    // Extra room on bottom
    height += 60

    return {
        p5: p,
        image: g.get(0, 0, WIDTH, height)
    }
}

// ----------------------------------------------------------------------------
// Private helper methods
// ----------------------------------------------------------------------------

/**
 * Draws text to the given p5 object with appropriate text wrapping.
 * @param {p5 Image or Graphics} canvas Where to draw the text
 * @param {int} y top y-position to draw text
 * @param {string} text the text to draw
 * @param {p5 HorizAlign} alignment Either LEFT, CENTER, or RIGHT
 * @param {int} height Height of text (font size)
 * @param {int} indent Indent on word wrap in LEFT or RIGHT mode, defaults to 0
 * @param {int} extraSpacing Extra spacing to account for, defaults to 0
 * @returns Total height added (in pixels)
 */
function drawWrappedText(p, canvas, y, text, alignment, height, 
                         indent = 0, extraSpacing = 0) {
    const MAX_WIDTH = 8 * PRINT_WIDTH_BYTES;

    text.replace("\n", " ");

    canvas.textSize(height);
    canvas.textAlign(alignment)

    // Create array of text segments that are guarenteed to fit in the display
    let textSegments = [];
    let splitString = text.trim().split(" ");
    for(let i = 0; i < splitString.length; i++) {
        //TODO: Check if need to split up word
        let currentWord = splitString[i];

        if (textSegments.length === 0) {
            // just put first word in to the segments array
            textSegments.push(currentWord);
            continue;
        }

        let currentSegment = textSegments[textSegments.length - 1];
        let tryNewSegment = currentSegment + " " + currentWord;

        // Subtract extra spacing from the allowable maximum width
        let actualMaxWidth = MAX_WIDTH - extraSpacing;
        // On all other lines other than the first line, need to account for indent
        actualMaxWidth -= textSegments.length == 1 ? 0 : indent;

        if (canvas.textWidth(tryNewSegment) <= actualMaxWidth) {
            // Can add in to the current segment
            textSegments[textSegments.length - 1] = tryNewSegment;
        } else {
            // Need to start new segment
            textSegments.push(currentWord);
        }
    }

    // Draw the text segments
    let dy = -4; // y difference
    for (let i = 0; i < textSegments.length; i++) {
        let x = MAX_WIDTH / 2 // CENTER
        if (alignment === p.LEFT) { x = i === 0 ? 0 : indent };
        if (alignment === p.RIGHT) { x = i === 0 ? MAX_WIDTH - indent : MAX_WIDTH };
        
        dy += height + 4; // Spacing
        canvas.text(textSegments[i], x, y + dy);
    }

    return dy
}

async function getDitheredImageFromUrl(p, url, width, height) {
    let img = await new Promise((res, err) => { p.loadImage(url, res, err) });
    img.resize(width, height);
    makeOneBitDithered(p, img)
    return img;
}

/**
 * Transforms the given Image or Graphics instance to a 1 bit dithered version
 * @param {p5 instance} p 
 * @param {p5 Image or Graphics} img 
 */
function makeOneBitDithered(p, img) {
    function imageIndex(img, x, y) {
        return 4 * (x + y * img.width);
    }
    
    function getColourAtIndex(p, img, x, y) {
        let idx = imageIndex(img, x, y);
        let pix = img.pixels;

        let red = pix[idx];
        let green = pix[idx + 1];
        let blue = pix[idx + 2];
        let alpha = pix[idx + 3];

        return p.color(red, green, blue, alpha);
    }
    
    function setColourAtIndex(p, img, x, y, colour) {
        let idx = imageIndex(img, x, y);
    
        let pix = img.pixels;
        pix[idx]     = p.red(colour);
        pix[idx + 1] = p.green(colour);
        pix[idx + 2] = p.blue(colour);
        pix[idx + 3] = p.alpha(colour);
    }
    
    function distributeError(p, img, x, y, errR, errG, errB) {
        addError(p, img, 7 / 16.0, x + 1, y, errR, errG, errB);
        addError(p, img, 3 / 16.0, x - 1, y + 1, errR, errG, errB);
        addError(p, img, 5 / 16.0, x, y + 1, errR, errG, errB);
        addError(p, img, 1 / 16.0, x + 1, y + 1, errR, errG, errB);
    }
    
    function addError(p, img, factor, x, y, errR, errG, errB) {
        if (x < 0 || x >= img.width || y < 0 || y >= img.height) return;
        let colour = getColourAtIndex(p, img, x, y);

        let r = p.red(colour);
        let g = p.green(colour);
        let b = p.blue(colour);

        colour.setRed(r + errR * factor);
        colour.setGreen(g + errG * factor);
        colour.setBlue(b + errB * factor);
    
        setColourAtIndex(p, img, x, y, colour);
    }

    img.filter(p.GRAY); // Convert image to grayscale
    img.loadPixels();

    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            let colour = getColourAtIndex(p, img, x, y);

            let oldR = red(colour);
            let oldG = green(colour);
            let oldB = blue(colour);

            let newR = oldR > 128 ? 255 : 0;
            let newG = oldG > 128 ? 255 : 0;
            let newB = oldB > 128 ? 255 : 0;

            let newColour = p.color(newR, newG, newB);
            setColourAtIndex(p, img, x, y, newColour);

            let errR = oldR - newR;
            let errG = oldG - newG;
            let errB = oldB - newB;

            distributeError(p, img, x, y, errR, errG, errB);
        }
    }

    img.updatePixels();
}

