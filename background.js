console.log("my extension: from background!");

let downloadInProgress = false;
let totalWorkouts;
let currEndoConfig = {};
let userInfo = {};

chrome.extension.onConnect.addListener(function(port) {
    console.log("Connected .....");
    port.onMessage.addListener(function(data) {
        console.log("message recieved: " + data.action);

        if(data.action === "get_user_info") {
            if(!!currEndoConfig.session){
                port.postMessage({
                    action: "set_user_info",
                    "firstName": currEndoConfig.session.firstName,
                    "lastName": currEndoConfig.session.lastName,
                    "userId": currEndoConfig.session.id});
            }
        }

        if(data.action === "get_total_workouts") {
            console.log({
                action: "set_total_workouts",
                total_workouts: totalWorkouts,
            })
            if(!!currEndoConfig.session){
                port.postMessage({
                    action: "set_total_workouts",
                    total_workouts: totalWorkouts,
                });
            }
            // else {
            //         getTotalWorkouts();
            //     }
        }

        // if(data.action === "get_total_workouts_method_2") {
        //     console.log({
        //         action: "get_total_workouts_method_2",
        //         total_workouts: totalWorkouts,
        //     })
        //     if(!!currEndoConfig.session){
        //         port.postMessage({
        //             action: "set_total_workouts_method_2",
        //             total_workouts: totalWorkouts,
        //         });
        //     }
        // }

        if(data.action === "download_in_progress") {
            port.postMessage({
                action: "set_download_in_progress",
                downloadInProgress: downloadInProgress});
        }
    });
})
//
// Versions that works with endoConfig:
function getTotalWorkouts(){
    // User logged in:
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {action: "get_total_workouts_number", userId: currEndoConfig.session.id});
    });
}

// function getTotalWorkouts(userId){
//     // User logged in:
//     chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
//         chrome.tabs.sendMessage(tabs[0].id, {action: "get_total_workouts_number", userId: userId});
//     });
// }

function getXmlsFromContent(){
    console.log("[start] get xmls from content")
    // chrome.runtime.sendMessage({action: "get_xmls_from_content", userId: currEndoConfig.session.id},);
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id,
            {
                        action: "get_xmls_from_content",
                        userId: currEndoConfig.session.id,
                        totalWorkouts: totalWorkouts
                     });
    });
    console.log("[end] get xmls from content")

}

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    console.log("[background] request: ", request);

    // endo config passed from content script
    // NOTE: works with getTotalWorkouts old version
    if (request.action === "endoConfig") {
        console.log("got action: ", request.action)

        if (!request.endoConfig || !request.endoConfig.session) {
            currEndoConfig = {};
            console.log("User not logged in (ignore).")
        } else {
            currEndoConfig = request.endoConfig;
            console.log("User logged in - get endoConfig (first time).");
            console.log("got _endoConfig:", currEndoConfig);
            if (currEndoConfig.session) {
                console.log('try get total workouts');
                getTotalWorkouts();
            }
        }
    }
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("onMessage: got action: ", request.action)

    // if (request.action === "user_info") {
    //     userInfo.userId = request.userId;
    //     userInfo.userName = request.userName;
    // }

    if (request.action === "save_user_info") {
        userInfo = request.userInfo;
        return true;
    }

    // TODO: get user info first!
    if (request.action === "get_total_workouts_from_content") {
        console.log('get_total_workouts_from_content');
        getTotalWorkouts(userInfo.userId);
    }

    if (request.action === "download_file") {
        console.log('File Name to be downlaod: ', request.fileName);
        console.log('skip download ... content: ', request.data.slice(0,50));
        downloadFile({
            filename: request.fileName,
            fileFormat: request.fileFormat,
            content: request.data
        });
        return;
    }

    if (request.action ==="get_user_info") {
        console.log("got action: ", request.action)
        if (!currEndoConfig.session) {
            sendResponse({success: false, msg: "User not logged in, no user info to return"})
        } else {
            console.log("got endoConfig but it already been populated (ignore).")
            sendResponse({success: true, data: {
                    "firstName": currEndoConfig.session.firstName,
                    "lastName": currEndoConfig.session.lastName,
                    "userId": currEndoConfig.session.id
                }});
        }
        return;
    }

    if(request.action === "total_workouts_response"){
        console.log("got action: ", request.action);
        console.log("got data: ", request.data);
        totalWorkouts = request.data;
        return;
    }

    if (request.action === "get_xmls_from_bg") {
        // get all workouts here.
        downloadInProgress = true;
        getXmlsFromContent();
        return;
    }
})







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

// Examples:

// // Download file with custom content
// downloadFile({
//     filename: "foo.txt",
//     content: "bar"
// });

// // Download file from external host
// downloadFile({
//     filename: "foo.txt",
//     url: "http://your.url/to/download"
// });
