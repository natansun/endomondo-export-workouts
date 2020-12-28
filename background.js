console.log("my extension: from background!");

let sessionInfo = {};
let endomondoRE = /^https:\/\/www\.endomondo/;

let sessionBgInterval = setInterval(function(){
    try{
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            if(tabs && tabs[0] && endomondoRE.test(tabs[0].url)){
                chrome.tabs.sendMessage(tabs[0].id, {action: "content.get_session_info"}, response => {
                    if(response && response.sessionInfo){
                        Object.assign(sessionInfo, response.sessionInfo);
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
    console.info("[getXmlsFromContent] get xmls from content - start")

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
        console.info("[getXmlsFromContent]: result tabs of chrome.tabs.query: ", tabs);
        if(tabs && tabs[0] && endomondoRE.test(tabs[0].url)) {
            console.info("[getXmlsFromContent] tabs[0]: ", tabs[0].url);
            chrome.tabs.sendMessage(tabs[0].id,
                {
                    action: "get_xmls_from_content",
                    userId: sessionInfo.userId,
                    totalWorkouts: sessionInfo.totalWorkouts
                });
        }
    });
    console.info("[getXmlsFromContent] get xmls from content - end")

}

function downloadFile(options) {
    const subfolder = "endomondo-workouts";
    const fileFormat = options.fileFormat.toLowerCase();
    const contentType = `text/${fileFormat}+xml`;
    if(!options.url) {
        const blob = new Blob([options.content], {type : `${contentType};charset=UTF-8`});
        options.url = window.URL.createObjectURL(blob);
    }
    chrome.downloads.download({
        url: options.url,
        filename: `${subfolder}/${fileFormat}/${options.filename}.${fileFormat}`
    },_ => {
        sessionInfo.currFile++;
        console.debug(sessionInfo.currFile);
    });

    // Debug without downloading:
    // sessionInfo.currFile++;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === "page_reload"){
        console.info("onMessage: got action: ", request.action);
        if(sessionInfo.loggedIn) {
            delete (sessionInfo.currFile);
        }

        return;
    }

    if (request.action === "bg.get_session_info") {
        console.debug("onMessage: got action: ", request.action);

        sendResponse({sessionInfo: sessionInfo});
        return;
    }

    if (request.action === "download_file") {
        console.info("onMessage: got action: ", request.action);

        console.log('File Name to be downlaod: ', request.fileName);
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
        if(sessionInfo.loggedIn){
            delete(sessionInfo.currFile);
            Object.assign(sessionInfo, { currFile: 0 });
            getXmlsFromContent();
        }
        return;
    }

    console.info("onMessage - not handled action: ", request.action)
})