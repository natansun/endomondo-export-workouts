console.log("my extension: from background!");

let downloadInProgress = false;
let sessionInfo = {};
let endomondoRE = /^https:\/\/www\.endomondo/;

let sessionBgInterval = setInterval(function(){
    try{
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            if(tabs && tabs[0] && endomondoRE.test(tabs[0].url)){
                chrome.tabs.sendMessage(tabs[0].id, {action: "get_session_info"}, response => {
                    if(response && response.sessionInfo){
                        sessionInfo = response.sessionInfo;
                    }
                    console.debug("[sessionBgInterval] sessionInfo: ", sessionInfo);
                });
            }
        });
    } catch (e) {
        // clearInterval(sessionBgInterval);
        console.error("[sessionBgInterval] got an error: ", e);
    }
}, 200);

function getXmlsFromContent(){
    console.log("[start] get xmls from content")

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
        if(tabs && tabs[0] && endomondoRE.test(tabs[0].url)) {
            chrome.tabs.sendMessage(tabs[0].id,
                {
                    action: "get_xmls_from_content",
                    userId: sessionInfo.userId,
                    totalWorkouts: sessionInfo.totalWorkouts
                });
        }
    });
    console.log("[end] get xmls from content")

}

function downloadFile(options) {
    let fileFormat = options.fileFormat.toLowerCase();
    let contentType = `text/${fileFormat}+xml`;
    if(!options.url) {
        var blob = new Blob([options.content], {type : `${contentType};charset=UTF-8`});
        options.url = window.URL.createObjectURL(blob);
    }
    chrome.downloads.download({
        url: options.url,
        filename: `${options.filename}.${fileFormat}`
    })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("onMessage: got action: ", request.action)

    if (request.action === "get_session_info") {
        console.debug("onMessage: got action: ", request.action);

        sendResponse({sessionInfo: sessionInfo});
        return;
    }

    if (request.action === "download_file") {
        console.info("onMessage: got action: ", request.action);

        console.log('File Name to be downlaod: ', request.fileName);
        // console.log('skip download ... content: ', request.data.slice(0,50));
        downloadFile({
            filename: request.fileName,
            fileFormat: request.fileFormat,
            content: request.data
        });
        return;
    }

    if (request.action === "start_download_workouts") {
        console.info("onMessage: got action: ", request.action);

        // get all workouts here.
        downloadInProgress = true;
        if(sessionInfo.loggedIn){
            getXmlsFromContent();
        }
        return;
    }
})


