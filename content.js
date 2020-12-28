function StopWatch(){
    let startTime, endTime;
    let running = false;


    function start() {
        if (running){
            console.warn(`[stopwatch.start] stopwatch is already running! last startTime: ${startTime}`);
        }
        running = true;
        startTime = new Date();
        console.info(`[stopwatch.start] new startTime was set to: ${startTime}`);
        return startTime;
    }

    function end() {
        if(!running){
            console.warn("[stopwatch.end] no stopwatch to end. Run stopwatch.start before using stopwatch.end");
            return;
        }
        running = false;
        endTime = new Date();
        let timeDiff = endTime - startTime; //in ms
        // strip the ms
        timeDiff /= 1000;

        // get seconds
        const seconds = Math.round(timeDiff);
        console.log(`[stopwatch.end] seconds: ${seconds}`);
        return seconds;
    }

    return {start: start, end:end};
}

console.log("my extension: from content script!");
chrome.runtime.sendMessage({action: "page_reload" });

function getSessionInfo(sessionInfo){
    let profileInfo = document.getElementsByClassName("header-member-profile-name")[0];
    sessionInfo.loggedIn = true;

    if(profileInfo){
        sessionInfo.userId = profileInfo.href.split('/').pop();
        sessionInfo.userName = profileInfo.innerText;
        sessionInfo.loggedIn = true;
        // console.log('found profile info by method 1');
    } else {
        profileInfo = $(".headerRightContent");
        if(profileInfo && profileInfo.length){
            profileInfo = profileInfo.find("a[href*='profile']")[0];
            sessionInfo.userId = profileInfo.href.split('/').pop();
            sessionInfo.userName = profileInfo.innerText;
            sessionInfo.loggedIn = true;
            // console.log('found profile info by method 2');
        } else {
            sessionInfo.loggedIn = false;
        }
    }

    console.debug("[getSessionInfo] search for session info in dom: ", sessionInfo);
    return sessionInfo;
}

function updateSessionInfo(sessionInfo, config){
    getSessionInfo(sessionInfo);
    if(sessionInfo.loggedIn){
        config.sessionInfoTimer = 60000;
        console.debug(`set config.sessionInfoTimer to ${config.sessionInfoTimer} millis`);
    }
    setTimeout(updateSessionInfo, config.totalWorkoutTimer, sessionInfo, config);
}

async function newGetWorkout(userId, limit, offset=0){
    const userErrMsg = "Endomondo Workouts Downloader Extension:\n" +
        "Download failed! Page will be refreshed and please try again";

    if(!userId){
        console.warn("can't get workouts for userId: ", userId);
        return {};
    }
    let response = await fetch("https://www.endomondo.com/rest/v1/users/" + userId +
                                    "/workouts/history?limit=" + limit +
                                    "&offset=" + offset +
                                    "&expand=workout%3Afull", {})
        .catch((error) => {
            console.error("catch error: " , error);
            // Your error is here!
            alert(userErrMsg);
            chrome.runtime.sendMessage({action: "page_reload" });
            location.reload();
        });

    if (response.status >= 400 && response.status < 600) {
        console.error("response error code: " , response.status);
        alert(userErrMsg);
        chrome.runtime.sendMessage({action: "page_reload" });
        location.reload();
    }

    return await response.json();
}

async function getTotalWorkouts(sessionInfo){
    let res = await newGetWorkout(sessionInfo.userId, 1);
    let total = undefined;
    if(res && res.paging){
        sessionInfo.totalWorkouts = res.paging.total;
        console.debug("[getTotalWorkouts]: get total workouts: ", sessionInfo.totalWorkouts);
        total = sessionInfo.totalWorkouts;
    }
    return total;
}

async function updateTotalWorkouts(sessionInfo, config){
    try{
        if(sessionInfo && sessionInfo.loggedIn){
            sessionInfo.totalWorkouts = await getTotalWorkouts(sessionInfo);
            console.debug("sessionInfo.totalWorkouts: ", sessionInfo.totalWorkouts);
            if(sessionInfo.totalWorkouts){
                config.totalWorkoutTimer = 120000;
                console.debug(`set config.totalWorkoutTimer to ${config.totalWorkoutTimer} millis`);
            }
        } else {
            delete(sessionInfo.totalWorkouts);
        }
    } catch (e) {
        // clearInterval(totalWorkoutsTimeout);
        console.error("[totalWorkoutsTimeout2] getTotalWorkouts got an error: ", e);
    }

    setTimeout(updateTotalWorkouts, config.totalWorkoutTimer, sessionInfo, config);
}

let sessionInfo = {};

(async function() {
    let stopwatch = new StopWatch();

    const messageTag = "Message";
    const pictureTag = "Picture";
    const picturesTag = "Pictures";

    let downloadInterval;
    let config = {
        totalWorkoutTimer: 1000,
        sessionInfoTimer: 1000
    };

    updateSessionInfo(sessionInfo, config)
    updateTotalWorkouts(sessionInfo, config);

    async function newGetWorkoutsRaw(userId, limit, offset) {
        return await newGetWorkout(userId, limit, offset);
    }

    /**
     * Endomondo uses the start_time value as the file name, after the following format:
     *
     * strat_time: "2020-11-18T14:46:05.000Z"   =>   exported file name: 20201118_144605
     */
    function formatStartTime(start_time) {
        try {
            return start_time.split(".")[0].replace(/[-|:]/g, "").replace("T", "_")
        } catch (e) {
            console.error("failed to format start_time to a file name");
            return start_time;
        }
    }

    function getWorkoutsInfo(workoutsRaw){
        if(workoutsRaw.data){
            console.log("Got " + workoutsRaw.data.length + " workouts !");
            return workoutsRaw.data.map(workout => {
                return {"id": workout.id,
                        "startTime": formatStartTime(workout.start_time),
                        "title": workout.title,
                        "message": workout.message,
                        "pictures": workout.pictures
                };
            });
        }
        return [];
    }

    async function fetchWorkoutXML(userId, workoutId, fileFormat){
        let woURL = `https://www.endomondo.com/rest/v1/users/${userId}/workouts/${workoutId}/export?format=${fileFormat}`;
        return await fetch(woURL, {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "en-US,en;q=0.9"
            },
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
        }).then(res => res.text());
    }

    function tagNameToExtend(fileFormat){
        let nodeToAppend;
        switch (fileFormat) {
            case "TCX":
                nodeToAppend = "Activity";
                break;
            case "GPX":
                nodeToAppend = "trk";
                break;
        }

        return nodeToAppend;
    }

    function elementToExtend(xmlDoc, tagName) {
        if(tagName){
            const elements = xmlDoc.getElementsByTagName(tagName);
            return elements[0];
        }
        return xmlDoc.children[0];
    }

    function extendXmlString(xmlString, nodeTag, nodeData, fileFormat){
        // const xmlString = res;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml")
        let newElem;

        try {
            switch (nodeTag) {
                case messageTag:
                    newElem = xmlDoc.createElement(messageTag);
                    newElem.setAttribute('text', nodeData)
                    break;

                case picturesTag:
                    newElem = xmlDoc.createElement(picturesTag);
                    nodeData.map(picture => {
                        let pictureNode = xmlDoc.createElement(pictureTag);
                        pictureNode.setAttribute('id', picture.id)
                        pictureNode.setAttribute('picture_token', picture.picture_token)
                        pictureNode.setAttribute('url', picture.url)

                        newElem.appendChild(pictureNode);
                    })
                    break;
            }

            let tagName = tagNameToExtend(fileFormat)
            let elemToExtend = elementToExtend(xmlDoc, tagName);
            elemToExtend.appendChild(newElem);

            xmlString = new XMLSerializer().serializeToString(xmlDoc);
        } catch (e) {
            console.error("Extended XML error: ", e);
        }

        return xmlString;
    }

    async function newPaginateWorkouts(totalWorkouts, userId, fileFormats=["TCX","GPX"]){
        let config = {};
        config.offset = 0;
        config.pageSize = 20;
        config.total = totalWorkouts;
        config.count = 0;

        stopwatch.start();

        async function innerPagination(configs){
            console.log('set timer to get workouts');
            let wosRaw = await newGetWorkoutsRaw(userId, configs.pageSize, configs.offset * configs.pageSize);
            console.log('my timer');
            let wosInfo = {
                "GPX": [],
                "TCX": []
            };

            for (let fileFormat of fileFormats){
                wosInfo[fileFormat] = getWorkoutsInfo(wosRaw).map((wo, index) =>{
                    wo.fileFormat = fileFormat;
                    wo.index = index + 1 + ( config.offset * config.pageSize );
                    return wo;
                });
            }
            let allWorkouts = wosInfo["GPX"].concat(wosInfo["TCX"]);

            await Promise.all(
                allWorkouts.map(async workout => {
                    let fileFormat = workout.fileFormat;
                    let workoutId = workout.id;
                    let title = workout.title;
                    let startTime = workout.startTime;
                    let message = workout.message;
                    let pictures = workout.pictures;

                    let xmlString = await fetchWorkoutXML(userId, workoutId, fileFormat);
                    const msgPrefix = `workout ${workout.index} ID: ${workoutId} (format: ${fileFormat})`;
                    console.info(`${msgPrefix} -> send XML to background to download`);
                    if (message) {
                        xmlString = extendXmlString(xmlString, messageTag, message, fileFormat);
                        console.debug(`${msgPrefix} -> contains a "message": ${message}`);
                    }

                    if (pictures.length > 0) {
                        xmlString = extendXmlString(xmlString, picturesTag, pictures, fileFormat);
                        console.debug(`${msgPrefix} -> contains "pictures": ${JSON.stringify(pictures)}`);

                    }
                    chrome.runtime.sendMessage({
                        action: "download_file",
                        fileName: title || startTime,
                        fileFormat: fileFormat,
                        data: xmlString
                    });

                    workout.xmlString = xmlString;
                    return workout;
                })
            ).then((_ => {
                configs.offset += 1;
                configs.count += configs.pageSize;
                if(configs.count >= configs.total){
                    console.info('Download is done - clear timer to get workouts');
                    clearInterval(downloadInterval);
                    downloadInterval = undefined;
                    let downloadTime = stopwatch.end();
                    const downloadDoneMsg = "Endomondo Workouts Downloader Extension:\n" +
                        "Download is Done - total download time: " + downloadTime + " seconds";

                    alert(downloadDoneMsg);
                } else {
                    setTimeout(innerPagination, 2000, configs);
                }
            }));
        }

        await innerPagination(config);
    }

    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        // console.debug("got action: ", request.action);

        if(request.action === "content.get_session_info") {
            sendResponse({sessionInfo: sessionInfo});
            return;
        }

        if(request.action === "get_xmls_from_content"){
            await newPaginateWorkouts(request.totalWorkouts, request.userId, ["TCX", "GPX"]);
            return true;
        }

        console.warn("[content onMessage] - not handled action: ", request.action)
    });

})();