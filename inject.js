/**
 * Observe SPA page changes (URL change, DOM loaded) and update UI state accordingly
 */
new MutationObserver(() => {
    updatePrintPanelDisplay(
        // Is on a track screen
        /.*spotify\.com\/track.*/.test(location.href) && 
        // ...and the content is loaded!
        document.getElementsByClassName("NXiYChVp4Oydfxd7rT5r").length !== 0
    );
}).observe(document, {subtree: true, childList: true});

/**
 * Initial setup on page load
 */
// Construct print panel and add it to the document
var previewButton = document.createElement("button");
previewButton.innerText = "Preview & Print"
previewButton.style.display = "none";
previewButton.style.width = "100%";
previewButton.style.fontSize = "2em";
previewButton.style.color = "black";
previewButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "print_song" });
});
document.body.appendChild(previewButton);

/**
 * Shows or hides the print panel, resets background script on change
 * @param {boolean} newState 
 */
function updatePrintPanelDisplay(newState) {
    let currentState = previewButton.style.display === "block";

    if (currentState !== newState) {
        previewButton.style.display = newState ? "block" : "none";

        // Reset the background script
        chrome.runtime.sendMessage({
            action: "reset"
        });
    }
}
  