// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

// Public: Max width (px) of the printer is PRINT_WIDTH_BYTES * 8
export const PRINT_WIDTH_BYTES = 48;

const BLE_MAX_PACKET_SIZE = 512;
const MAX_BLOCK_LINES = 250;

const HEADER = new Uint8Array([
    0x1b, 0x40,            // command ESC @: initialize printer
    0x1b, 0x61,            // command ESC a: select justification
    0x01,                  // 0: left, 1: centre, 2: right justification
    0x1f, 0x11, 0x02, 0x04 // ???
]);

const FOOTER = new Uint8Array([
    0x1b, 0x64, 0x02, // command ESC d 2: print and feed 2 lines
    0x1b, 0x64, 0x02, // command ESC d 2: print and feed 2 lines
    0x1f, 0x11, 0x08, // ???
    0x1f, 0x11, 0x0e, // ???
    0x1f, 0x11, 0x07, // ???
    0x1f, 0x11, 0x09, // ???
]);

// ----------------------------------------------------------------------------
// Public methods
// ----------------------------------------------------------------------------

/**
 * Prints the given Image to a nearby T02 bluetooth printer, using the appropriate
 * printing protocol.
 * @param {p5 instance} p 
 * @param {Image} img Image to print, must have a width of PRINT_WIDTH_BYTES * 8 px
 */
export const printImageToBluetooth = async (p, img) => {
    // Convert image to the bit buffer needed by the T02 printer
    const imageArray = imageToPrintBitBuffer(p, img);

    // Find and connect to the nearby bluetooth device
    let printer;
    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { name: "T02" }
            ],
            optionalServices: [0xFF00, 0xFF02],
        });

        const gattServer = await device.gatt.connect();
        const primaryService = await gattServer.getPrimaryService(0xFF00); // Custom service on T02
        printer = await primaryService.getCharacteristic(0xFF02);          // Printing sec. service
    } catch (error) {
        // User cancelled finding the bluetooth device, 
        // or had an error in connecting. Rethrow error.
        throw error;
    }

    let dataBlob = new Blob(constructImageBuffer(imageArray));
    let buffer = await dataBlob.arrayBuffer();

    // console.log(dataBlob)
    // console.log(buffer)

    // Send data to printer in stages to print
    sendPrintBuffer(printer, buffer)
}

// ----------------------------------------------------------------------------
// Private methods
// ----------------------------------------------------------------------------

// REQUIRES: bytes is a UInt8 from 0 to 255
const blockMarkerWithLength = (num_lines) => {
    return new Uint8Array([
        0x1d, 0x76, 0x30,        // command GS v 0 : print raster bit image
        0x00,                    // mode: 0 (normal), 1 (2x width), 2 (2x height), 3 (4x)
        PRINT_WIDTH_BYTES, 0x00, // 16bit, little-endian: number of bytes / line
        num_lines, 0x00,         // 16bit, little-endian: number of lines in the image
    ])
}

// REQUIRES imageArray is a multiple of PRINT_WIDTH bytes (UInt8) (width)
const constructImageBuffer = (imageArray) => {
    const TOTAL_IMAGE_LINES = Math.floor(imageArray.length / PRINT_WIDTH_BYTES);

    let constructedArray = [HEADER]
    let chunkLineIndex = 0;

    while (true) {
        const isLast = chunkLineIndex + MAX_BLOCK_LINES >= TOTAL_IMAGE_LINES;

        const endLineIndex = isLast ? TOTAL_IMAGE_LINES : chunkLineIndex + MAX_BLOCK_LINES;
        const segmentNumLines = endLineIndex - chunkLineIndex;
        const arraySegment = imageArray.slice(
            chunkLineIndex * PRINT_WIDTH_BYTES, endLineIndex * PRINT_WIDTH_BYTES);

        // Add block header and image array slice to constructed array
        constructedArray.push(blockMarkerWithLength(segmentNumLines));
        constructedArray.push(arraySegment);

        if (isLast) {
            break;
        } else {
            chunkLineIndex += MAX_BLOCK_LINES;
        }
    }

    constructedArray.push(FOOTER);
    console.log(constructedArray);

    return constructedArray;
}

// REQUIRES: printer is WriteCharacteristic, buffer is ArrayBuffer
const sendPrintBuffer = async (printer, buffer) => {
    let chunkIndex = 0;
    while (true) {
        const isLast = chunkIndex + BLE_MAX_PACKET_SIZE >= buffer.byteLength;

        const endIndex = isLast ? buffer.byteLength : chunkIndex + BLE_MAX_PACKET_SIZE;
        const dataChunk = buffer.slice(chunkIndex, endIndex);

        // Write current chunk
        await printer.writeValueWithoutResponse(dataChunk);
        console.log(`Printing from index ${chunkIndex} to ${endIndex}`);
        
        if (isLast) {
            break;
        } else {
            chunkIndex = chunkIndex + BLE_MAX_PACKET_SIZE;
        }
    }
    console.log("DONE SENDING PRINT DATA");
}

// REQUIRES: img is PRINT_WIDTH wide
const imageToPrintBitBuffer = (p, img) => {
    img.filter(p.THRESHOLD); // Ensure 1 bit colour image
    img.loadPixels();
    let pixels = img.pixels; // UInt8ClampedArray

    let byteArray = []

    for (let byteIndex = 0; byteIndex < pixels.length; byteIndex += 4*8) {
        let byte = 0;

        for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
            let redBitIndex = byteIndex + bitIndex * 4;  // index of R value in RGBA group (grayscale) 
            let bit = pixels[redBitIndex] > 128 ? 0 : 1; // CHANGE TO INVERT

            let bytePosMask = 0b10000000 >> bitIndex; // Mask at new bit position
            byte = byte | (bit * bytePosMask)         // Update byte with new bit
        }

        byteArray.push(byte);
    }

    return new Uint8Array(byteArray);
}